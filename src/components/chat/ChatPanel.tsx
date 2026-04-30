"use client";

/**
 * ChatPanel — streaming, low-chrome conversation surface.
 *
 * Consumes SSE events from /api/conversation:
 *   - text delta: accumulates into a live "streaming" turn visible as it arrives
 *   - capture: forwarded to parent to place a memory frame
 *   - wall_color: forwarded to parent to animate a wall
 *   - done: finalize the streaming turn as a completed companion turn
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { StreamingMessage, RevealedMessage } from "./StreamingMessage";
import type {
  CaptureMemoryArgs,
  ChangeWallColorArgs,
  Companion,
  Memory,
  Room,
} from "@/lib/schema";

export interface ChatTurn {
  role: "user" | "companion";
  content: string;
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
  handleRef?: React.MutableRefObject<ChatPanelHandle | null>;
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
  handleRef,
}: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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
            conversation: conversation.map((t) => ({
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
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Parse complete SSE events (separated by blank line)
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const line = rawEvent.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "text" && typeof evt.delta === "string") {
                accumulated += evt.delta;
                setStreaming(accumulated);
              } else if (evt.type === "capture" && evt.args) {
                onCapture(evt.args);
              } else if (evt.type === "wall_color" && evt.args) {
                onWallColor(evt.args);
              } else if (evt.type === "undo") {
                onUndo();
              } else if (evt.type === "error" && evt.message) {
                setError(evt.message);
              }
            } catch {
              // ignore malformed
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Stream error.");
        }
      }

      const final = accumulated.trim();
      if (final) {
        onTurn({ role: "companion", content: final });
      }
      setStreaming("");
      setBusy(false);
      abortRef.current = null;
    },
    [busy, companion, conversation, onCapture, onTurn, onUndo, onWallColor, recentMemories, room, season],
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

        {conversation.map((turn, i) => (
          <div
            key={i}
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

        {streaming && (
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
