"use client";

/**
 * ChatPanel — intimate, low-chrome conversation surface.
 *
 * Deliberately not a "chatbot UI". No avatars, no "AI thinking" indicator beyond
 * a single pulsing dot. Designed to recede into the room.
 */

import { useEffect, useRef, useState } from "react";
import type { CaptureMemoryArgs, Companion, Memory, Room } from "@/lib/schema";

export interface ChatTurn {
  role: "user" | "companion";
  content: string;
}

interface Props {
  companion: Companion;
  room: Room;
  season: string;
  conversation: ChatTurn[];
  recentMemories: Memory[];
  onSend: (userMessage: string) => Promise<{
    reply: string;
    captures: CaptureMemoryArgs[];
    error?: string;
  }>;
  onCapture: (capture: CaptureMemoryArgs) => void;
  onTurn: (turn: ChatTurn) => void;
}

export function ChatPanel({
  companion,
  conversation,
  onSend,
  onCapture,
  onTurn,
}: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.length, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    onTurn({ role: "user", content: text });

    try {
      const { reply, captures, error: apiError } = await onSend(text);
      if (apiError) {
        setError(apiError);
        return;
      }
      onTurn({ role: "companion", content: reply });
      for (const c of captures) onCapture(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const placeholder =
    conversation.length === 0
      ? `Say something to ${companion.name}…`
      : "…";

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

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-5 py-3 space-y-4 scrollbar-thin"
      >
        {conversation.length === 0 && (
          <div className="text-amber-100/40 text-sm italic leading-relaxed">
            You're here. {companion.name} is somewhere in the house.
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
            {turn.content}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-amber-200/50 text-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-200/70 animate-pulse" />
            <span className="italic">…</span>
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
