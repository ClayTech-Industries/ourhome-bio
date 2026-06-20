"use client";

/**
 * ChatPanel — streaming, low-chrome conversation surface.
 *
 * Consumes SSE events from /api/conversation:
 *   - presence: companion state (thinking, speaking, recalling, etc.)
 *   - text delta: accumulates into a live "streaming" turn visible as it arrives
 *   - capture: forwarded to parent to place a memory frame
 *   - wall_color: forwarded to parent to animate a wall
 *   - undo: forwarded to parent to revert last action
 *   - done: finalize the streaming turn as a completed companion turn
 *   - error: display error message
 *
 * Per Principle 2: The pause is reciprocal. Presence events drive
 * environmental changes in the room — no spinners, no "typing..." indicators.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { StreamingMessage, RevealedMessage } from "./StreamingMessage";
import { VoiceInput } from "./VoiceInput";
import { speakText } from "./AudioPlayer";
import type {
  CaptureMemoryArgs,
  ChangeWallColorArgs,
  Companion,
  Memory,
  Room,
} from "@/lib/schema";
import type { CompanionPresence } from "@/lib/llm/prompts";

export interface ChatTurn {
  role: "user" | "companion";
  content: string;
  silent?: boolean; // UI-generated turns (recall, frame clicks) — not sent to the API
}

export interface ChatPanelHandle {
  dispatch: (message: string, options?: { silent?: boolean }) => Promise<void>;
}

interface Props {
  companion: Companion;
  room: Room;
  season: string;
  conversation: ChatTurn[];
  recentMemories: Memory[];
  onCapture: (capture: CaptureMemoryArgs) => void;
  onWallColor: (args: ChangeWallColorArgs) => void;
  onUndo: () => void;
  onTurn: (turn: ChatTurn) => void;
  onPresence?: (presence: CompanionPresence) => void;
  handleRef?: React.MutableRefObject<ChatPanelHandle | null>;
  voiceEnabled?: boolean;
}

export function ChatPanel({
  companion,
  room,
  season,
  conversation,
  recentMemories,
  onCapture,
  onWallColor,
  onUndo,
  onTurn,
  onPresence,
  handleRef,
  voiceEnabled = false,
}: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastStreamedRef = useRef("");

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversation.length, streaming, busy]);

  const dispatch = useCallback(
    async (userMessage: string, options?: { silent?: boolean }) => {
      if (busy) return;
      const text = userMessage.trim();
      if (!text) return;
      setBusy(true);
      setStreaming("");
      setError(null);

      if (!options?.silent) {
        onTurn({ role: "user", content: text });
      }

      const controller = new AbortController();
      abortRef.current = controller;

      let res: Response;
      try {
        res = await fetch("/api/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companion,
            room,
            season,
            conversation: conversation
              .filter((t) => !t.silent) // never send silent/UI turns to the API
              .map((t) => ({
                role: t.role,
                content: t.content,
              })),
            recentMemories,
            userMessage: text,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        setBusy(false);
        setError(err instanceof Error ? err.message : "Network error.");
        return;
      }

      if (!res.ok || !res.body) {
        setBusy(false);
        setError(`HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            // Process any remaining data in buffer before closing
            if (buffer.trim()) {
              const lines = buffer.split("\n");
              let eventType = "";
              let eventData = "";
              for (const line of lines) {
                if (line.startsWith("event: ")) {
                  eventType = line.slice(7).trim();
                } else if (line.startsWith("data: ")) {
                  eventData = line.slice(6);
                }
              }
              if (eventType === "text" && eventData) {
                try {
                  const data = JSON.parse(eventData);
                  if (typeof data.delta === "string") {
                    accumulated += data.delta;
                    setStreaming(accumulated);
                  }
                } catch { /* malformed, skip */ }
              }
            }
            break;
          }
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events: each event is separated by \n\n
          // Format: event: <type>\ndata: <json>\n\n
          let boundary: number;
          while ((boundary = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            // Parse event type and data
            const lines = rawEvent.split("\n");
            let eventType = "";
            let eventData = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6);
              }
            }

            if (!eventType && !eventData) continue;

            try {
              // Handle presence events (Principle 2: the pause is reciprocal)
              if (eventType === "presence") {
                const data = JSON.parse(eventData);
                const kind = data.kind as CompanionPresence;
                onPresence?.(kind);
              } else if (eventType === "text") {
                const data = JSON.parse(eventData);
                if (typeof data.delta === "string") {
                  accumulated += data.delta;
                  setStreaming(accumulated);
                }
              } else if (eventType === "capture") {
                const data = JSON.parse(eventData);
                if (data.args) {
                  onCapture(data.args);
                }
              } else if (eventType === "capture_confirmed") {
                // Phase 2 complete: memory written to R2 (canonical)
                // The frame is now permanent — settled, not just bloomed
                const data = JSON.parse(eventData);
                // Log for debugging; client can optionally animate frame settling
                console.log("[OurHome] Memory confirmed:", data.memoryId, data.r2Key);
              } else if (eventType === "capture_failed") {
                // Phase 2 failed: R2 write failed, memory not permanent
                // The bloomed frame should fade — it didn't settle
                const data = JSON.parse(eventData);
                console.error("[OurHome] Memory capture failed:", data.error);
              } else if (eventType === "wall_color") {
                const data = JSON.parse(eventData);
                if (data.args) {
                  onWallColor(data.args);
                }
              } else if (eventType === "undo") {
                onUndo();
              } else if (eventType === "done") {
                // Stream complete
              } else if (eventType === "error") {
                const data = JSON.parse(eventData);
                setError(data.message || "Unknown error");
              }
            } catch {
              // Malformed JSON — skip
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Stream error.");
        }
      }

      const final = accumulated.trim();
      // Store the final text so we can detect duplication
      lastStreamedRef.current = final;
      // Clear streaming FIRST to prevent duplication
      setStreaming("");
      setBusy(false);
      onPresence?.(undefined as any);
      abortRef.current = null;

      if (final) {
        onTurn({ role: "companion", content: final });
        // Speak the companion's response if voice is enabled
        if (voiceEnabled) {
          speakText(final, companion.voiceId ?? undefined);
        }
      }
    },
    [busy, companion, conversation, onCapture, onTurn, onUndo, onWallColor, onPresence, recentMemories, room, season],
  );

  // Expose imperative dispatch to parent (for click-to-recall, etc.)
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = { dispatch };
    return () => {
      if (handleRef.current?.dispatch === dispatch) handleRef.current = null;
    };
  }, [dispatch, handleRef]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void dispatch(text);
  };

  const placeholder =
    conversation.length === 0 ? `Say something to ${companion.name}…` : "…";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
        <div className="text-sm font-medium tracking-wide text-amber-100/80">
          {companion.name}
        </div>
        <div className="text-[11px] uppercase tracking-[0.15em] text-amber-200/40">
          Home
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-3 space-y-4 scrollbar-thin">
        {conversation.length === 0 && !streaming && !busy && (
          <div className="text-amber-100/40 text-sm italic leading-relaxed">
            You&apos;re here. {companion.name} is somewhere in the house.
            <br />
            Say something, or just sit with it for a moment.
          </div>
        )}

        {/* Conversation turns */}
        {conversation.map((turn, i) => (
          <div
            key={`${i}-${turn.role}-${turn.content.slice(0, 20)}`}
            className={
              turn.role === "user"
                ? "text-amber-50/90 text-[15px] leading-relaxed"
                : "text-amber-200/85 text-[15px] leading-relaxed italic"
            }
          >
            {turn.role === "companion" ? (
              <RevealedMessage text={turn.content} />
            ) : (
              turn.content
            )}
          </div>
        ))}

        {/* Streaming text — only show if NOT already in conversation */}
        {streaming && !conversation.some(t => t.role === "companion" && t.content === streaming) && (
          <div className="text-amber-200/85 text-[15px] leading-relaxed italic">
            <StreamingMessage text={streaming} isComplete={false} />
          </div>
        )}

        {busy && !streaming && (
          <div className="flex items-center gap-2 text-amber-200/50 text-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-200/70 animate-pulse" />
          </div>
        )}

        {error && (
          <div className="text-rose-300/80 text-xs italic">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-amber-200/10 px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent text-amber-50 placeholder-amber-200/25 focus:outline-none text-[15px] leading-relaxed px-2 py-1.5 max-h-32"
            disabled={busy}
          />
          <VoiceInput
            onTranscription={(text) => {
              setInput(text);
              // Auto-send after voice transcription
              if (text.trim()) {
                void dispatch(text);
              }
            }}
            disabled={busy}
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="text-amber-200/60 hover:text-amber-100 text-xs uppercase tracking-[0.15em] px-2 py-1 disabled:opacity-30"
          >
            send
          </button>
        </div>
      </div>
    </div>
  );
}