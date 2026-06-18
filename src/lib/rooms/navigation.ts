/**
 * Room Navigation — room transitions, unlock logic, room creation.
 *
 * Each room has its own personality and purpose.
 * Some rooms are locked until relationship milestones.
 * The companion moves between rooms with the human.
 */

import type { Room, RoomType } from "@/lib/schema";

// -----------------------------------------------------------------
// Room definitions — what each room looks like when first created
// -----------------------------------------------------------------

export interface RoomDefinition {
  slug: string;
  name: string;
  type: RoomType;
  wallColors: { north?: string; south?: string; east?: string; west?: string };
  lighting: { preset: "morning" | "afternoon" | "evening" | "night"; intensity: number };
  unlocked: boolean;
  /** Minimum number of memories before this room unlocks */
  unlockThreshold: number;
  /** Brief description shown in the navigation UI */
  description: string;
}

export const ROOM_DEFINITIONS: RoomDefinition[] = [
  {
    slug: "living_room",
    name: "Living Room",
    type: "living_room",
    wallColors: { north: "#E8D5B7", south: "#E8D5B7", east: "#C4A882", west: "#E8D5B7" },
    lighting: { preset: "afternoon", intensity: 1 },
    unlocked: true,
    unlockThreshold: 0,
    description: "The heart of the home",
  },
  {
    slug: "kitchen",
    name: "Kitchen",
    type: "kitchen",
    wallColors: { north: "#F0E6D3", south: "#F0E6D3", east: "#E2D5C5", west: "#F0E6D3" },
    lighting: { preset: "morning", intensity: 1.1 },
    unlocked: true,
    unlockThreshold: 0,
    description: "Where things are made",
  },
  {
    slug: "study",
    name: "Study",
    type: "study",
    wallColors: { north: "#3a2a20", south: "#3a2a20", east: "#4a3528", west: "#3a2a20" },
    lighting: { preset: "evening", intensity: 0.7 },
    unlocked: false,
    unlockThreshold: 3,
    description: "The quiet room for deep conversations",
  },
  {
    slug: "bedroom",
    name: "Bedroom",
    type: "bedroom",
    wallColors: { north: "#2a1f1a", south: "#2a1f1a", east: "#3a2a22", west: "#2a1f1a" },
    lighting: { preset: "night", intensity: 0.5 },
    unlocked: false,
    unlockThreshold: 8,
    description: "The vulnerable space — highest privacy",
  },
  {
    slug: "children",
    name: "Children's Room",
    type: "children",
    wallColors: { north: "#d4c8b8", south: "#d4c8b8", east: "#c9bca8", west: "#d4c8b8" },
    lighting: { preset: "night", intensity: 0.4 },
    unlocked: false,
    unlockThreshold: 15,
    description: "The tender space — fragile things",
  },
  {
    slug: "garden",
    name: "Garden",
    type: "garden",
    wallColors: { north: "#8aa872", south: "#8aa872", east: "#7a9858", west: "#8aa872" },
    lighting: { preset: "afternoon", intensity: 1.2 },
    unlocked: false,
    unlockThreshold: 5,
    description: "Growth, silence, healing",
  },
];

// -----------------------------------------------------------------
// Unlock logic
// -----------------------------------------------------------------

/**
 * Check which rooms should be unlocked based on the number of memories.
 * Called after each memory capture.
 */
export function getUnlockedRooms(memoryCount: number): string[] {
  return ROOM_DEFINITIONS
    .filter((r) => r.unlocked || memoryCount >= r.unlockThreshold)
    .map((r) => r.slug);
}

/**
 * Check if a specific room is unlocked.
 */
export function isRoomUnlocked(slug: string, memoryCount: number): boolean {
  const def = ROOM_DEFINITIONS.find((r) => r.slug === slug);
  if (!def) return false;
  return def.unlocked || memoryCount >= def.unlockThreshold;
}

/**
 * Get the next room that will unlock, and how many memories until it does.
 */
export function getNextUnlock(memoryCount: number): { slug: string; name: string; memoriesNeeded: number } | null {
  const locked = ROOM_DEFINITIONS.filter((r) => !r.unlocked && memoryCount < r.unlockThreshold);
  if (locked.length === 0) return null;
  locked.sort((a, b) => a.unlockThreshold - b.unlockThreshold);
  const next = locked[0];
  return {
    slug: next.slug,
    name: next.name,
    memoriesNeeded: next.unlockThreshold - memoryCount,
  };
}

/**
 * Create all room definitions as Room objects.
 * Called during home creation.
 */
export function createAllRooms(): Room[] {
  const now = new Date().toISOString();
  return ROOM_DEFINITIONS.map((def) => ({
    id: crypto.randomUUID(),
    slug: def.slug,
    name: def.name,
    type: def.type,
    wallColors: def.wallColors,
    wallHistory: {},
    lighting: def.lighting,
    unlocked: def.unlocked,
    createdAt: now,
  }));
}