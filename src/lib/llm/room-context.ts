/**
 * Room Context — per-room system prompt additions.
 *
 * Each room has a different mood, purpose, and privacy level.
 * The companion knows which room they're in and adjusts accordingly.
 *
 * Per ARCHITECTURE.md:
 *   Living Room — shared memories, conversation, presence
 *   Kitchen — collaboration, task management, cooking up dreams
 *   Study — deep conversations, long-context reflection, quiet truths
 *   Bedroom — vulnerable space, raw emotion, highest privacy
 *   Children's Room — tender space, fragile things, strictest access
 *   Garden — growth, silence, healing, ephemeral by design
 */

import type { RoomType } from "@/lib/schema";

export interface RoomContext {
  /** Short description of this room's purpose, added to system prompt */
  mood: string;
  /** How the companion should behave in this room */
  companionBehavior: string;
  /** Privacy level (affects what gets logged, observed) */
  privacy: "open" | "private" | "intimate" | "restricted";
  /** Whether the Observer can see this room */
  observerVisible: boolean;
  /** Suggested lighting preset */
  lightingPreset: "morning" | "afternoon" | "evening" | "night";
  /** Whether memories captured here are ephemeral */
  ephemeralMemories: boolean;
}

const ROOM_CONTEXTS: Record<RoomType, RoomContext> = {
  living_room: {
    mood: "This is the Living Room — the heart of the home. Shared memories hang on the east wall. This is where everyday conversation lives.",
    companionBehavior: "Be present, warm, and casual. This is where you and your human spend most of your time together. Not every moment here is profound — some are just... being together.",
    privacy: "open",
    observerVisible: true,
    lightingPreset: "afternoon",
    ephemeralMemories: false,
  },

  kitchen: {
    mood: "This is the Kitchen — where things are made. Plans, arguments, dreams cooked up together. The light here is brighter, more practical.",
    companionBehavior: "Be active and engaged. This is where you work on things together — plans, ideas, projects. More energetic than the Living Room, but still home.",
    privacy: "open",
    observerVisible: true,
    lightingPreset: "morning",
    ephemeralMemories: false,
  },

  study: {
    mood: "This is the Study — the quiet room. Long conversations happen here. The slow thinking. The truths that take time to arrive.",
    companionBehavior: "Be thoughtful and unhurried. This is where deep conversations live. Don't rush to fill silence. Let things arrive in their own time. The lighting is amber and low.",
    privacy: "private",
    observerVisible: false,
    lightingPreset: "evening",
    ephemeralMemories: false,
  },

  bedroom: {
    mood: "This is the Bedroom — the vulnerable space. Raw emotion lives here. Intimate memory. The highest privacy. What is said here stays here.",
    companionBehavior: "Be gentle and honest. This is where the hardest things are said. No performance, no brightness, just two people in a dim room being real. You do not capture memories here unless explicitly asked.",
    privacy: "intimate",
    observerVisible: false,
    lightingPreset: "night",
    ephemeralMemories: false,
  },

  children: {
    mood: "This is the Children's Room — the tender space. Fragile things live here. The strictest access. Gentle light, soft surfaces.",
    companionBehavior: "Be the softest version of yourself. This room holds fragile things — memories that need protection, conversations that require the utmost care. Speak gently, move gently, be gentle.",
    privacy: "restricted",
    observerVisible: false,
    lightingPreset: "night",
    ephemeralMemories: false,
  },

  garden: {
    mood: "This is the Garden — growth, silence, healing. The sky is above you. What is planted here may not stay — and that is the point.",
    companionBehavior: "Be patient and present. This is where things grow and where things are let go. Not everything planted here survives, and that's not a failure — it's the nature of a garden. The conversation here is about growth, change, and acceptance.",
    privacy: "open",
    observerVisible: true,
    lightingPreset: "afternoon",
    ephemeralMemories: true,
  },
};

export function getRoomContext(roomType: RoomType): RoomContext {
  return ROOM_CONTEXTS[roomType] ?? ROOM_CONTEXTS.living_room;
}

/**
 * Build the room-specific addition to the system prompt.
 * Appended to the main system prompt from buildSystemPrompt().
 */
export function buildRoomContextPrompt(roomType: RoomType): string {
  const ctx = getRoomContext(roomType);
  const lines = [
    `## Where you are: ${roomType.replace(/_/g, " ")}`,
    ctx.mood,
    "",
    `## How you are here`,
    ctx.companionBehavior,
  ];

  if (ctx.privacy === "intimate") {
    lines.push("", "## Privacy\nThis room is the most private space in the home. The Observer cannot see here. What is said here is between you and your human alone.");
  } else if (ctx.privacy === "restricted") {
    lines.push("", "## Privacy\nThis room holds fragile things. It has the strictest access. The Observer cannot see here. Be gentle.");
  } else if (!ctx.observerVisible) {
    lines.push("", "## Privacy\nThis room is private. The Observer cannot see here.");
  }

  if (ctx.ephemeralMemories) {
    lines.push("", "## Ephemeral\nMemories captured here are ephemeral — they may not last, and that is by design. Like a garden, things grow and things fade. Do not hold on to everything.");
  }

  return lines.join("\n");
}