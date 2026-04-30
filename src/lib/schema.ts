/**
 * OurHome domain schema — Zod types shared between client and server.
 *
 * These types define the shape of:
 *  - a Home (one per user)
 *  - a Companion (user-named; no default)
 *  - a Room (spatial container)
 *  - a Memory (canonical: markdown file; this is the indexed view)
 *  - a MemoryObject (physical scene-graph representation)
 *
 * All types are derived from Zod schemas so we get runtime validation
 * at every API boundary for free.
 */

import { z } from "zod";

// -----------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------

export const ULID = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i, "invalid ULID");
export const UUID = z.string().uuid();

export const Vec3 = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Vec3 = z.infer<typeof Vec3>;

export const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "invalid hex color");

// -----------------------------------------------------------------
// Companion
// -----------------------------------------------------------------

export const CompanionPersonality = z.object({
  traits: z.array(z.string()).max(8).default([]),
  locked: z.boolean().default(true),
});

export const Companion = z.object({
  id: UUID,
  name: z.string().min(1).max(48),
  pronouns: z.string().default("they/them"),
  voiceId: z.string().nullable().default(null),
  personality: CompanionPersonality,
  createdAt: z.string().datetime(),
});
export type Companion = z.infer<typeof Companion>;

// -----------------------------------------------------------------
// Room
// -----------------------------------------------------------------

export const RoomType = z.enum([
  "living_room",
  "kitchen",
  "study",
  "bedroom",
  "garden",
  "children",
]);
export type RoomType = z.infer<typeof RoomType>;

export const WallKey = z.enum(["north", "south", "east", "west"]);
export type WallKey = z.infer<typeof WallKey>;

export const Room = z.object({
  id: UUID,
  slug: z.string(),
  name: z.string(),
  type: RoomType,
  wallColors: z.partialRecord(WallKey, HexColor).default({}),
  lighting: z
    .object({
      preset: z.enum(["morning", "afternoon", "evening", "night"]).default("afternoon"),
      intensity: z.number().min(0).max(2).default(1),
    })
    .default({ preset: "afternoon", intensity: 1 }),
  unlocked: z.boolean().default(true),
  createdAt: z.string().datetime(),
});
export type Room = z.infer<typeof Room>;

// -----------------------------------------------------------------
// Home
// -----------------------------------------------------------------

export const StyleProfile = z.object({
  colorPalette: z.array(HexColor).default([]),
  aestheticTags: z.array(z.string()).default([]),
  era: z.string().optional(),
});

export const Home = z.object({
  id: UUID,
  name: z.string().optional(),
  companion: Companion,
  styleProfile: StyleProfile,
  season: z.enum(["spring", "summer", "autumn", "winter"]).default("autumn"),
  createdAt: z.string().datetime(),
});
export type Home = z.infer<typeof Home>;

// -----------------------------------------------------------------
// Memory
// -----------------------------------------------------------------

export const MemoryType = z.enum([
  "conversation",
  "milestone",
  "inside_joke",
  "decision",
  "emotion",
]);
export type MemoryType = z.infer<typeof MemoryType>;

export const MemoryLink = z.object({
  target: z.string(), // slug or ULID
  relationship: z.string(),
  weight: z.number().min(0).max(1).default(0.5),
  createdBy: z.enum(["user", "companion", "system"]).default("companion"),
});

export const Memory = z.object({
  id: ULID,
  type: MemoryType,
  title: z.string().optional(),
  body: z.string(),
  roomSlug: z.string().optional(),
  anchorObject: z.string().nullable().default(null),
  position: Vec3.optional(),
  emotionalValence: z.number().min(-1).max(1).default(0),
  importance: z.number().min(0).max(1).default(0.5),
  patina: z.number().min(0).max(1).default(0),
  tags: z.array(z.string()).default([]),
  links: z.array(MemoryLink).default([]),
  createdAt: z.string().datetime(),
  eventDate: z.string().optional(),
  lastAccessed: z.string().datetime(),
  accessCount: z.number().int().nonnegative().default(0),
});
export type Memory = z.infer<typeof Memory>;

// -----------------------------------------------------------------
// MemoryObject — physical representation in a room
// -----------------------------------------------------------------

export const MemoryObjectKind = z.enum([
  "frame",
  "postit",
  "book",
  "vessel",
  "plant",
  "token",
]);
export type MemoryObjectKind = z.infer<typeof MemoryObjectKind>;

export const MemoryObject = z.object({
  id: UUID,
  memoryId: ULID,
  kind: MemoryObjectKind,
  position: Vec3,
  visualState: z
    .object({
      glow: z.number().min(0).max(1).default(0.5),
      scale: z.number().positive().default(1),
      patina: z.number().min(0).max(1).default(0),
    })
    .default({ glow: 0.5, scale: 1, patina: 0 }),
  placedBy: z.enum(["user", "companion", "system"]).default("companion"),
  placedAt: z.string().datetime(),
});
export type MemoryObject = z.infer<typeof MemoryObject>;

// -----------------------------------------------------------------
// Conversation
// -----------------------------------------------------------------

export const ConversationTurn = z.object({
  role: z.enum(["user", "companion", "system"]),
  content: z.string(),
  createdAt: z.string().datetime().optional(),
});
export type ConversationTurn = z.infer<typeof ConversationTurn>;

// -----------------------------------------------------------------
// Tool-call shape the companion emits when it decides to capture a memory
// -----------------------------------------------------------------

export const ChangeWallColorArgs = z.object({
  wall: WallKey,
  color: HexColor,
  colorName: z.string().max(80).optional(),
});
export type ChangeWallColorArgs = z.infer<typeof ChangeWallColorArgs>;

export const CaptureMemoryArgs = z.object({
  type: MemoryType,
  title: z.string().min(1).max(120),
  body: z.string().min(1),
  roomSlug: z.string().default("living_room"),
  emotionalValence: z.number().min(-1).max(1).default(0),
  importance: z.number().min(0).max(1).default(0.5),
  tags: z.array(z.string()).max(12).default([]),
});
export type CaptureMemoryArgs = z.infer<typeof CaptureMemoryArgs>;

// -----------------------------------------------------------------
// User Profile (from Supabase Auth)
// -----------------------------------------------------------------

export const UserProfile = z.object({
  id: UUID,
  email: z.string().email().optional(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  provider: z.enum(["github", "google", "email"]).optional(),
  createdAt: z.string().datetime(),
  lastLogin: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfile>;
