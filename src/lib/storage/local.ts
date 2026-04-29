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

const STORAGE_KEY = "ourhome.v0.home";

interface StoredState {
  home: Home | null;
  rooms: Room[];
  memories: Memory[];
  memoryObjects: MemoryObject[];
  conversation: { role: "user" | "companion"; content: string; at: string }[];
}

const emptyState: StoredState = {
  home: null,
  rooms: [],
  memories: [],
  memoryObjects: [],
  conversation: [],
};

function read(): StoredState {
  if (typeof window === "undefined") return emptyState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    return JSON.parse(raw) as StoredState;
  } catch {
    return emptyState;
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

  const livingRoom: Room = {
    id: crypto.randomUUID(),
    slug: "living_room",
    name: "Living Room",
    type: "living_room",
    wallColors: {
      north: "#E8D5B7",
      south: "#E8D5B7",
      east: "#C4A882",
      west: "#E8D5B7",
    },
    lighting: { preset: "afternoon", intensity: 1 },
    unlocked: true,
    createdAt: now,
  };

  const state: StoredState = {
    home,
    rooms: [livingRoom],
    memories: [],
    memoryObjects: [],
    conversation: [],
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

// -----------------------------------------------------------------
// Conversation log
// -----------------------------------------------------------------

export function appendTurn(role: "user" | "companion", content: string): void {
  const state = read();
  state.conversation.push({ role, content, at: new Date().toISOString() });
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
  // Wall is 6 wide x 2.8 tall, from x=-3..3, y=0.5..3.3, z = +3 (east).
  const existingOnWall = state.memoryObjects.length;
  const col = existingOnWall % 5;
  const row = Math.floor(existingOnWall / 5);
  const position = {
    x: -2.2 + col * 1.1,
    y: 2.4 - row * 0.95,
    z: 2.99,
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

export function getHome(): Home | null {
  return read().home;
}
