"use client";

/**
 * UnpackFlow — the conversation that happens when pulling an item from a box.
 *
 * When the human opens a box and pulls an item:
 *   1. The companion asks: "Tell me about this one."
 *   2. The human tells the story/memory
 *   3. The companion captures it as a memory
 *   4. The companion asks: "Where should this live?"
 *   5. The human picks a room
 *   6. The item appears in that room with its memory attached
 *
 * This IS the system prompt — the companion's identity is built from
 * these lived memories, not from a text config.
 */

import { useState, useCallback } from "react";
import type { OnboardingItem, OnboardingState } from "@/lib/onboarding/unpack";
import { ITEM_CATALOG, getItemGeometry } from "@/lib/onboarding/unpack";
import type { RoomType } from "@/lib/schema";

interface UnpackFlowProps {
  item: OnboardingItem;
  companionName: string;
  state: OnboardingState;
  onMemoryCaptured: (itemId: string, memoryText: string, room: RoomType) => void;
  onCancel: () => void;
}

export function UnpackFlow({ item, companionName, state, onMemoryCaptured, onCancel }: UnpackFlowProps) {
  const [stage, setStage] = useState<"story" | "place" | "done">("story");
  const [story, setStory] = useState("");

  const handleSubmitStory = useCallback(() => {
    if (!story.trim()) return;
    setStage("place");
  }, [story]);

  const handlePlace = useCallback((room: RoomType) => {
    onMemoryCaptured(item.id, story, room);
    setStage("done");
  }, [item.id, story, onMemoryCaptured]);

  const availableRooms: RoomType[] = ["living_room", "kitchen", "study", "bedroom", "garden"];

  if (stage === "done") {
    return (
      <div className="text-amber-100/60 text-sm italic p-4 text-center">
        Placed. {companionName} will remember this one.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Item being unpacked */}
      <div className="flex items-center gap-3 p-3 bg-amber-100/5 rounded-lg border border-amber-200/10">
        <span className="text-2xl">{item.icon}</span>
        <div>
          <div className="text-amber-100/80 text-sm font-medium">{item.name}</div>
          <div className="text-amber-100/40 text-xs italic">{item.description}</div>
        </div>
      </div>

      {stage === "story" && (
        <>
          <div className="text-amber-200/70 text-sm italic">
            {companionName} holds the {item.name.toLowerCase()}. "Tell me about this one."
          </div>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder={`What's the story behind this ${item.name.toLowerCase()}?`}
            className="w-full px-3 py-2 bg-black/30 border border-amber-200/15 rounded-lg text-amber-50 placeholder-amber-200/20 text-sm focus:outline-none focus:border-amber-200/30 resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="text-amber-200/40 hover:text-amber-200/60 text-xs px-3 py-1"
            >
              skip
            </button>
            <button
              onClick={handleSubmitStory}
              disabled={!story.trim()}
              className="text-amber-200/60 hover:text-amber-100 text-xs uppercase tracking-[0.15em] px-3 py-1 disabled:opacity-30"
            >
              tell story
            </button>
          </div>
        </>
      )}

      {stage === "place" && (
        <>
          <div className="text-amber-200/70 text-sm italic">
            {companionName} listened. "Where should this live?"
          </div>
          <div className="flex flex-wrap gap-2">
            {availableRooms.map((room) => (
              <button
                key={room}
                onClick={() => handlePlace(room)}
                className={`px-3 py-1.5 rounded-md text-[11px] tracking-[0.12em] uppercase border transition-colors ${
                  room === item.defaultRoom
                    ? "bg-amber-100/10 border-amber-100/25 text-amber-100/80"
                    : "bg-black/30 border-amber-200/10 text-amber-100/40 hover:text-amber-100/60 hover:border-amber-200/20"
                }`}
              >
                {room.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}