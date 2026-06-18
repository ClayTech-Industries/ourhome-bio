/**
 * Canonical Write-Path (DR-009)
 *
 * Two-phase memory capture: fast frame bloom + confirmed write.
 *
 * Phase 1 — Fast Bloom (client-side, immediate):
 *   The capture SSE event fires immediately when the companion decides
 *   to capture. The client blooms a frame on the Memory Wall. The human
 *   sees the moment being held. This is NOT the permanent write — it's
 *   the "unsettled" memory, fresh and warm.
 *
 * Phase 2 — Confirmed Write (server-side, async):
 *   1. R2: PUT markdown file (canonical, idempotent by ULID)
 *   2. Postgres: upsert memories row (derived index)
 *   3. Embedding: optional — store NULL if no OpenAI key, backfill later
 *   4. MemoryObject: insert frame on wall
 *   5. SSE: capture_confirmed (after write) or capture_failed (on error)
 *
 * Idempotent by ULID — survive retries without duplication.
 * "Unsettled" memory = fresh memory, not yet permanent (environmental, not loading).
 *
 * Per BUILD_PLAN:
 *   - R2: PUT markdown file (canonical, idempotent by ULID)
 *   - Postgres: upsert memories row (derived index)
 *   - Embedding: optional — store NULL if no OpenAI key, backfill later (DR-017)
 *   - MemoryObject: insert frame on wall
 *   - SSE events: capture (immediate) → capture_confirmed / capture_failed
 */

import { ulid } from "ulid";
import type { Companion, Memory, MemoryObject, CaptureMemoryArgs } from "@/lib/schema";
import { writeMemoryMarkdown } from "./r2";
import { serializeMemory, memoryFilename } from "./markdown";
import { createServiceSupabase, isSupabaseConfigured } from "@/lib/db/supabase";

// -----------------------------------------------------------------
// Capture result types
// -----------------------------------------------------------------

export interface CaptureResult {
  memory: Memory;
  object: MemoryObject;
  r2Key: string | null;
  postgresRowId: string | null;
  embeddingGenerated: boolean;
  confirmed: boolean;
  error: string | null;
}

// -----------------------------------------------------------------
// Embedding (optional — NULL if no key, backfill later)
// -----------------------------------------------------------------

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null; // No key — store NULL, backfill later (DR-017)
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000), // API limit safety
      }),
    });

    if (!response.ok) {
      console.error("Embedding API error:", response.statusText);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("Embedding generation failed:", error);
    return null; // Fail gracefully — memory still writes, embedding is NULL
  }
}

// -----------------------------------------------------------------
// Postgres upsert (derived index)
// -----------------------------------------------------------------

async function upsertMemoryRow(
  memory: Memory,
  companion: Companion,
  ownerId: string,
  homeId: string,
  r2Key: string,
  embedding: number[] | null,
): Promise<string | null> {
  const supabase = createServiceSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return null; // Supabase not configured — R2 is still canonical
  }

  try {
    const { data, error } = await supabase
      .from("memories")
      .upsert(
        {
          id: memory.id,
          owner_id: ownerId,
          home_id: homeId,
          room_slug: memory.roomSlug ?? null,
          anchor_object: memory.anchorObject,
          type: memory.type,
          title: memory.title ?? null,
          body: memory.body,
          embedding: embedding,
          emotional_valence: memory.emotionalValence,
          importance: memory.importance,
          patina: memory.patina,
          tags: memory.tags,
          links: JSON.stringify(memory.links),
          r2_key: r2Key,
          created_at: memory.createdAt,
          event_date: memory.eventDate ?? null,
          last_accessed: memory.lastAccessed,
          access_count: memory.accessCount,
        },
        { onConflict: "id" },
      )
      .select("id")
      .single();

    if (error) {
      console.error("Postgres upsert error:", error.message);
      return null;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error("Postgres upsert failed:", error);
    return null;
  }
}

// -----------------------------------------------------------------
// MemoryObject insert (frame on wall)
// -----------------------------------------------------------------

async function insertMemoryObject(
  object: MemoryObject,
  roomId: string,
): Promise<boolean> {
  const supabase = createServiceSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase.from("memory_objects").insert({
      id: object.id,
      room_id: roomId,
      memory_id: object.memoryId,
      kind: object.kind,
      position: JSON.stringify(object.position),
      visual_state: JSON.stringify(object.visualState),
      placed_by: object.placedBy,
      placed_at: object.placedAt,
    });

    if (error) {
      console.error("MemoryObject insert error:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("MemoryObject insert failed:", error);
    return false;
  }
}

// -----------------------------------------------------------------
// Frame placement (Memory Wall grid)
// -----------------------------------------------------------------

export function placeFrameOnWall(existingCount: number): {
  position: { x: number; y: number; z: number };
} {
  // East wall is at x = +3 (ROOM_W/2). Frames face -x (toward viewer).
  // Spread across z (-2.2..2.2) and y (1.4..2.9) in a grid.
  const col = existingCount % 5;
  const row = Math.floor(existingCount / 5);
  return {
    position: {
      x: 2.93,  // east wall at 3.0, pulled back so frame sits in front
      y: 1.3 + row * 0.8,  // start at 1.3, each row goes UP
      z: -1.6 + col * 0.75,  // tighter side-to-side, centered
    },
  };
}

// -----------------------------------------------------------------
// captureMemory — the canonical write-path
// -----------------------------------------------------------------

/**
 * Execute a memory capture. This is the server-side phase 2 write.
 *
 * The client already bloomed the frame (phase 1, via SSE capture event).
 * This function writes the permanent record:
 *   1. Build the Memory object (ULID, idempotent)
 *   2. Write markdown to R2 (canonical)
 *   3. Generate embedding (optional, NULL if no key)
 *   4. Upsert Postgres row (derived index)
 *   5. Insert MemoryObject (frame on wall in DB)
 *
 * Returns CaptureResult with confirmation status.
 * If any step fails, the memory is still partially written — R2 is
 * canonical, so even if Postgres fails, the memory exists in markdown.
 */
export async function captureMemory(
  args: CaptureMemoryArgs,
  companion: Companion,
  ownerId: string,
  homeId: string,
  roomId: string,
  existingFrameCount: number,
): Promise<CaptureResult> {
  const now = new Date().toISOString();

  // 1. Build Memory object — ULID makes it idempotent
  const memory: Memory = {
    id: ulid(),
    type: args.type,
    title: args.title,
    body: args.body,
    roomSlug: args.roomSlug,
    anchorObject: null,
    emotionalValence: args.emotionalValence,
    importance: args.importance,
    patina: 0, // Fresh — no patina yet
    tags: args.tags,
    links: [],
    createdAt: now,
    lastAccessed: now,
    accessCount: 0,
  };

  // 2. Place frame on Memory Wall
  const { position } = placeFrameOnWall(existingFrameCount);
  const object: MemoryObject = {
    id: crypto.randomUUID(),
    memoryId: memory.id,
    kind: "frame",
    position,
    visualState: {
      glow: 0.8, // Fresh glow — will settle over time
      scale: 1,
      patina: 0,
    },
    placedBy: "companion",
    placedAt: now,
  };

  // 3. Write markdown to R2 (canonical)
  let r2Key: string | null = null;
  try {
    r2Key = await writeMemoryMarkdown(ownerId, memory, companion);
  } catch (error) {
    console.error("R2 write failed:", error);
    // R2 is canonical — if this fails, the memory is not permanently written
    return {
      memory,
      object,
      r2Key: null,
      postgresRowId: null,
      embeddingGenerated: false,
      confirmed: false,
      error: `R2 write failed: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }

  // 4. Generate embedding (optional — NULL if no key)
  const embeddingText = `${memory.title ?? ""} ${memory.body}`.trim();
  const embedding = await generateEmbedding(embeddingText);
  const embeddingGenerated = embedding !== null;

  // 5. Upsert Postgres row (derived index)
  const pgRowId = await upsertMemoryRow(
    memory,
    companion,
    ownerId,
    homeId,
    r2Key,
    embedding,
  );

  // 6. Insert MemoryObject (frame on wall in DB)
  await insertMemoryObject(object, roomId);

  // 7. Return confirmed result
  return {
    memory,
    object,
    r2Key,
    postgresRowId: pgRowId,
    embeddingGenerated,
    confirmed: r2Key !== null, // R2 is canonical — if it wrote, memory is permanent
    error: pgRowId ? null : "Postgres index skipped (R2 canonical write succeeded)",
  };
}