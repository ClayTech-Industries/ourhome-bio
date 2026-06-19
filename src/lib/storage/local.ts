/**
 * Local-first storage for Sprint 1 Day 1.
 *
 * This module provides a localStorage-backed home state so the app is
 * fully usable before Supabase is wired up. Everything here will be
 * replaced with server-side Supabase calls in Sprint 1 Day 2+, and the
 * API surface is kept close to what the server-side calls will look like.
 */

"use client";

import { ulid } from "ulid";
import type { Companion, Home, Memory, MemoryObject, Room } from "@/lib/schema";
import { createAllRooms } from "@/lib/rooms/navigation";

const STORAGE_KEY = "ourhome.v0.home";

export type UndoEntry =
  | {
      kind: "wall_color";
      roomSlug: string;
      wall: "north" | "south" | "east" | "west";
      before: string | undefined;
      after: string;
      description: string;
      at: string;
    }
  | {
      kind: "memory_capture";
      memoryId: string;
      objectId: string;
      description: string;
      at: string;
    };

interface StoredState {
  home: Home | null;
  rooms: Room[];
  memories: Memory[];
  memoryObjects: MemoryObject[];
  conversation: { role: "user" | "companion"; content: string; at: string }[];
  undoStack: UndoEntry[];
  currentRoomSlug: string;
}

const emptyState: StoredState = {
  home: null,
  rooms: [],
  memories: [],
  memoryObjects: [],
  conversation: [],
  undoStack: [],
  currentRoomSlug: "living_room",
};

const UNDO_CAP = 20;

function read(): StoredState {
  if (typeof window === "undefined") return emptyState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    // Fill in any missing fields from legacy writes so the type is honest.
    return {
      home: parsed.home ?? null,
      rooms: parsed.rooms ?? [],
      memories: parsed.memories ?? [],
      memoryObjects: parsed.memoryObjects ?? [],
      conversation: parsed.conversation ?? [],
      undoStack: parsed.undoStack ?? [],
      currentRoomSlug: parsed.currentRoomSlug ?? "living_room",
    };
  } catch {
    return emptyState;
  }
}

function pushUndo(state: StoredState, entry: UndoEntry): void {
  state.undoStack.push(entry);
  if (state.undoStack.length > UNDO_CAP) {
    state.undoStack = state.undoStack.slice(-UNDO_CAP);
  }
}

function write(state: StoredState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("ourhome:state-changed"));
}

export function getState(): StoredState {
  return read();
}

export function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener("ourhome:state-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("ourhome:state-changed", handler);
    window.removeEventListener("storage", handler);
  };
}

/**
 * Replace the entire local state with cloud-downloaded state.
 * Called when a returning user logs in and cloud state wins.
 * Dispatches ourhome:state-changed so all subscribers refresh.
 */
export function replaceStateFromCloud(cloud: {
  home: Home;
  rooms: Room[];
  memories: Memory[];
  objects: MemoryObject[];
}): void {
  if (typeof window === "undefined") return;
  const state: StoredState = {
    home: cloud.home,
    rooms: cloud.rooms,
    memories: cloud.memories,
    memoryObjects: cloud.objects,
    conversation: read().conversation, // preserve local conversation history
    undoStack: [], // fresh undo stack for cloud state
    currentRoomSlug: cloud.rooms[0]?.slug ?? "living_room",
  };
  write(state);
}

// -----------------------------------------------------------------
// Home bootstrap
// -----------------------------------------------------------------

export function createHome(companionName: string, companionPronouns = "they/them"): Home {
  const now = new Date().toISOString();
  const companion: Companion = {
    id: crypto.randomUUID(),
    name: companionName.trim(),
    pronouns: companionPronouns,
    voiceId: null,
    personality: {
      traits: ["quietly curious", "remembers gently", "loves afternoon light"],
      locked: true,
    },
    createdAt: now,
  };

  const home: Home = {
    id: crypto.randomUUID(),
    companion,
    styleProfile: {
      colorPalette: ["#E8D5B7", "#C4A882", "#8B6F47"],
      aestheticTags: ["warm", "painterly"],
    },
    season: "autumn",
    createdAt: now,
  };

  const rooms = createAllRooms();

  const state: StoredState = {
    home,
    rooms,
    memories: [],
    memoryObjects: [],
    conversation: [],
    undoStack: [],
    currentRoomSlug: "living_room",
  };
  write(state);
  return home;
}

export function renameCompanion(newName: string): Home | null {
  const state = read();
  if (!state.home) return null;
  state.home.companion.name = newName.trim();
  write(state);
  return state.home;
}

export function resetHome(): void {
  write(emptyState);
}

/**
 * Migrate existing memory frame positions from south wall (z=2.99)
 * to east wall (x=2.99). One-time fix for Sprint 2.
 */
export function migrateFramePositions(): void {
  const state = read();
  let changed = false;

  // Migrate frame positions
  for (let i = 0; i < state.memoryObjects.length; i++) {
    const obj = state.memoryObjects[i];
    const col = i % 5;
    const row = Math.floor(i / 5);
    const newX = 2.93;
    const newY = 1.0 + row * 0.8;
    const newZ = -1.6 + col * 0.75;
    if (obj.position.x !== newX || obj.position.y !== newY || obj.position.z !== newZ) {
      obj.position.x = newX;
      obj.position.y = newY;
      obj.position.z = newZ;
      changed = true;
    }
  }

  // Migrate rooms: add missing rooms for existing homes
  if (state.home && state.rooms.length < 6) {
    import("@/lib/rooms/navigation").then(({ createAllRooms }) => {
      const allRooms = createAllRooms();
      const existingSlugs = state.rooms.map((r) => r.slug);
      for (const room of allRooms) {
        if (!existingSlugs.includes(room.slug)) {
          state.rooms.push(room);
          changed = true;
        }
      }
      if (changed) {
        write(state);
        console.log("[OurHome] Added missing rooms to existing home");
      }
    });
    return;
  }

  if (changed) {
    write(state);
    console.log("[OurHome] Migrated memory frames to tighter grid spacing");
  }
}

// -----------------------------------------------------------------
// Conversation log
// -----------------------------------------------------------------

export interface StoredTurn {
  role: "user" | "companion";
  content: string;
  at: string;
  silent?: boolean; // silent turns are UI actions (recall, frame clicks), not real speech
}

export function appendTurn(role: "user" | "companion", content: string, silent?: boolean): void {
  const state = read();
  state.conversation.push({ role, content, at: new Date().toISOString(), silent });
  if (state.conversation.length > 200) {
    state.conversation = state.conversation.slice(-200);
  }
  write(state);
}

export function getConversation() {
  return read().conversation;
}

// -----------------------------------------------------------------
// Memory capture
// -----------------------------------------------------------------

export interface CaptureInput {
  type: Memory["type"];
  title?: string;
  body: string;
  roomSlug?: string;
  emotionalValence?: number;
  importance?: number;
  tags?: string[];
}

export function captureMemory(input: CaptureInput): { memory: Memory; object: MemoryObject } {
  const state = read();
  const now = new Date().toISOString();
  const roomSlug = input.roomSlug ?? "living_room";
  const room = state.rooms.find((r) => r.slug === roomSlug) ?? state.rooms[0];

  const memory: Memory = {
    id: ulid(),
    type: input.type,
    title: input.title,
    body: input.body,
    roomSlug,
    anchorObject: null,
    emotionalValence: input.emotionalValence ?? 0,
    importance: input.importance ?? 0.5,
    patina: 0,
    tags: input.tags ?? [],
    links: [],
    createdAt: now,
    lastAccessed: now,
    accessCount: 0,
  };

  // Place the frame on the east wall (Memory Wall) in a grid.
  // East wall is at x = +3. Frames spread across z and y.
  const existingOnWall = state.memoryObjects.length;
  const col = existingOnWall % 5;
  const row = Math.floor(existingOnWall / 5);
  const position = {
    x: 2.93,
    y: 1.0 + row * 0.8,
    z: -1.6 + col * 0.75,
  };

  const object: MemoryObject = {
    id: crypto.randomUUID(),
    memoryId: memory.id,
    kind: "frame",
    position,
    visualState: {
      glow: 0.8,
      scale: 1,
      patina: 0,
    },
    placedBy: "companion",
    placedAt: now,
  };

  state.memories.push(memory);
  state.memoryObjects.push(object);
  pushUndo(state, {
    kind: "memory_capture",
    memoryId: memory.id,
    objectId: object.id,
    description: `memory: ${memory.title ?? memory.body.slice(0, 40)}`,
    at: now,
  });
  write(state);
  return { memory, object };
}

export function getMemories(): Memory[] {
  return read().memories;
}

export function getMemoryObjects(): MemoryObject[] {
  return read().memoryObjects;
}

export function getRoom(slug: string): Room | null {
  return read().rooms.find((r) => r.slug === slug) ?? null;
}

export function getRooms(): Room[] {
  return read().rooms;
}

export function getCurrentRoomSlug(): string {
  return read().currentRoomSlug;
}

export function setCurrentRoom(slug: string): void {
  const state = read();
  const room = state.rooms.find((r) => r.slug === slug);
  if (!room) return;
  state.currentRoomSlug = slug;
  write(state);
}

export function getHome(): Home | null {
  return read().home;
}

// -----------------------------------------------------------------
// Wall color mutation
// -----------------------------------------------------------------

export function setWallColor(
  roomSlug: string,
  wall: "north" | "south" | "east" | "west",
  color: string,
  colorName?: string,
): void {
  const state = read();
  const room = state.rooms.find((r) => r.slug === roomSlug);
  if (!room) return;
  const before = room.wallColors[wall];
  room.wallColors = { ...room.wallColors, [wall]: color };

  // Append to wall history (Sprint 2 DR-012)
  const history = room.wallHistory ?? {};
  const wallHistory = history[wall] ?? [];
  wallHistory.push({
    color,
    colorName,
    changedAt: new Date().toISOString(),
    changedBy: "companion" as const,
  });
  // Cap at 50 entries per wall
  if (wallHistory.length > 50) {
    wallHistory.splice(0, wallHistory.length - 50);
  }
  room.wallHistory = { ...history, [wall]: wallHistory };

  pushUndo(state, {
    kind: "wall_color",
    roomSlug,
    wall,
    before,
    after: color,
    description: `${wall} wall → ${colorName ?? color}`,
    at: new Date().toISOString(),
  });
  write(state);
}

// -----------------------------------------------------------------
// Undo
// -----------------------------------------------------------------

export function peekUndo(): UndoEntry | null {
  const stack = read().undoStack;
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

/**
 * Reverse the most recent change and return a description of what was undone.
 * Returns null if the stack is empty.
 */
export function undoLast(): UndoEntry | null {
  const state = read();
  const entry = state.undoStack.pop();
  if (!entry) return null;

  if (entry.kind === "wall_color") {
    const room = state.rooms.find((r) => r.slug === entry.roomSlug);
    if (room) {
      if (entry.before === undefined) {
        // Remove the key by spreading and re-building without it.
        const next: Record<string, string> = { ...room.wallColors };
        delete next[entry.wall];
        room.wallColors = next as typeof room.wallColors;
      } else {
        room.wallColors = { ...room.wallColors, [entry.wall]: entry.before };
      }
    }
  } else if (entry.kind === "memory_capture") {
    state.memories = state.memories.filter((m) => m.id !== entry.memoryId);
    state.memoryObjects = state.memoryObjects.filter((o) => o.id !== entry.objectId);
  }

  write(state);
  return entry;
}

// -----------------------------------------------------------------
// Memory access bump — called when a frame is clicked
// -----------------------------------------------------------------

export function bumpMemoryAccess(memoryId: string): Memory | null {
  const state = read();
  const memory = state.memories.find((m) => m.id === memoryId);
  if (!memory) return null;
  memory.accessCount += 1;
  memory.lastAccessed = new Date().toISOString();
  write(state);
  return memory;
}

// -----------------------------------------------------------------
// Proactive recall — select an old, unvisited memory for companion
// to bring up unprompted. Returns null if no suitable memory found.
// -----------------------------------------------------------------

export function pickMemoryForProactiveRecall(): Memory | null {
  const state = read();
  const now = Date.now();
  // Candidates: memories older than 2 minutes, low access count, some importance
  const candidates = state.memories.filter((m) => {
    const ageMs = now - new Date(m.createdAt).getTime();
    const isOldEnough = ageMs > 2 * 60 * 1000;
    const isNeglected = m.accessCount < 3;
    const hasWeight = (m.importance ?? 0.5) > 0.3;
    return isOldEnough && isNeglected && hasWeight;
  });
  if (candidates.length === 0) return null;
  // Pick the least recently accessed
  candidates.sort((a, b) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime());
  return candidates[0];
}
