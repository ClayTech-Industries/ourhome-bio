"use client";

/**
 * The home experience — Living Room + Memory Wall + Chat, all client-side
 * for Day 1. Home state persists in localStorage; the conversation API is
 * the only server call.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { SceneCanvas } from "@/components/scene/SceneCanvas";
import { LivingRoom } from "@/components/scene/LivingRoom";
import { ChatPanel, type ChatTurn } from "@/components/chat/ChatPanel";
import type { CaptureMemoryArgs, Memory } from "@/lib/schema";
import {
  appendTurn,
  captureMemory,
  getConversation,
  getHome,
  getMemories,
  getMemoryObjects,
  getRoom,
  subscribe,
  resetHome,
} from "@/lib/storage/local";

export function HomeExperience() {
  const [tick, setTick] = useState(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [justPlaced, setJustPlaced] = useState<string | null>(null);

  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

  const home = getHome();
  const room = getRoom("living_room");
  const memories = getMemories();
  const memoryObjects = getMemoryObjects();
  const conversation = getConversation();

  const memoriesById = useMemo(() => {
    const map: Record<string, Memory> = {};
    for (const m of memories) map[m.id] = m;
    return map;
  }, [memories]);

  const chatTurns: ChatTurn[] = useMemo(
    () =>
      conversation.map((t) => ({
        role: t.role,
        content: t.content,
      })),
    [conversation],
  );

  const handleSend = useCallback(
    async (userMessage: string) => {
      if (!home || !room) {
        return { reply: "…", captures: [], error: "No home yet." };
      }

      const recent = memories.slice(-8);
      const convoPayload = conversation.slice(-20).map((t) => ({
        role: t.role,
        content: t.content,
        createdAt: t.at,
      }));

      try {
        const res = await fetch("/api/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companion: home.companion,
            room,
            season: home.season,
            conversation: convoPayload,
            recentMemories: recent,
            userMessage,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return {
            reply: "…",
            captures: [],
            error: body.message ?? body.error ?? `HTTP ${res.status}`,
          };
        }
        const data: { reply: string; captures: CaptureMemoryArgs[] } = await res.json();
        return data;
      } catch (err) {
        return {
          reply: "…",
          captures: [],
          error: err instanceof Error ? err.message : "Network error.",
        };
      }
    },
    [conversation, home, memories, room],
  );

  const handleTurn = useCallback((turn: ChatTurn) => {
    appendTurn(turn.role, turn.content);
  }, []);

  const handleCapture = useCallback((capture: CaptureMemoryArgs) => {
    const { memory } = captureMemory({
      type: capture.type,
      title: capture.title,
      body: capture.body,
      roomSlug: capture.roomSlug,
      emotionalValence: capture.emotionalValence,
      importance: capture.importance,
      tags: capture.tags,
    });
    setJustPlaced(memory.id);
    window.setTimeout(() => setJustPlaced((v) => (v === memory.id ? null : v)), 1200);
  }, []);

  const handleFrameClick = useCallback((memoryId: string) => {
    setHighlighted(memoryId);
    window.setTimeout(() => setHighlighted((v) => (v === memoryId ? null : v)), 2400);
  }, []);

  if (!home || !room) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex">
      {/* Scene */}
      <div className="absolute inset-0">
        <SceneCanvas>
          <LivingRoom
            room={room}
            memoryObjects={memoryObjects}
            memoriesById={memoriesById}
            onFrameClick={handleFrameClick}
            highlightedMemoryId={highlighted}
            recentlyPlacedMemoryId={justPlaced}
            key={tick}
          />
        </SceneCanvas>
      </div>

      {/* Top-left: home name + small meta */}
      <div className="pointer-events-none absolute left-6 top-5 text-amber-100/60 text-xs tracking-[0.18em] uppercase">
        {home.name ?? "Home"} · {home.season}
      </div>

      {/* Top-right: reset button (dev convenience, removed post-MVP) */}
      <button
        onClick={() => {
          if (confirm("Start over? This erases your local home.")) {
            resetHome();
            window.location.reload();
          }
        }}
        className="absolute right-5 top-5 text-amber-100/30 hover:text-amber-100/70 text-[10px] tracking-[0.18em] uppercase"
      >
        reset
      </button>

      {/* Chat — lower right, semi-translucent */}
      <div className="absolute bottom-6 right-6 w-[min(420px,calc(100vw-3rem))] h-[min(560px,calc(100vh-5rem))] rounded-lg border border-amber-200/10 bg-black/55 backdrop-blur-md shadow-2xl">
        <ChatPanel
          companion={home.companion}
          room={room}
          season={home.season}
          conversation={chatTurns}
          recentMemories={memories.slice(-8)}
          onSend={handleSend}
          onCapture={handleCapture}
          onTurn={handleTurn}
        />
      </div>
    </div>
  );
}
