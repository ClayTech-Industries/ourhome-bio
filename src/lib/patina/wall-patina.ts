/**
 * Wall Patina — computed patina values for walls.
 *
 * Patina is NOT stored in the database. It is computed at render time
 * from wall metadata: age since last color change, number of nearby
 * memories, and wall orientation (sun exposure).
 *
 * Different walls age differently:
 *   - South wall: sun-faded (more light exposure in lore)
 *   - North wall: cooler, less fading
 *   - East wall (Memory Wall): warmed by memories
 *   - West wall: moderate aging
 *
 * Per Principle 6: "The engineering builds the pipe. The human hand
 * shapes what flows through it." All constants here are tweakable.
 */

import type { Room, Memory, WallKey } from "@/lib/schema";

// -----------------------------------------------------------------
// Patina configuration (tweakable by human hand)
// -----------------------------------------------------------------

/** Days to reach full patina (30 days = a month of living with the color) */
const PATINA_MAX_DAYS = 30;

/** Per-wall orientation multipliers */
const WALL_ORIENTATIONS: Record<WallKey, { sunExposure: number; memoryInfluence: number }> = {
  south: { sunExposure: 1.2, memoryInfluence: 0.3 },  // most sun
  north: { sunExposure: 0.6, memoryInfluence: 0.3 },  // least sun
  east: { sunExposure: 0.9, memoryInfluence: 1.0 },   // Memory Wall
  west: { sunExposure: 0.8, memoryInfluence: 0.3 },   // moderate
};

// -----------------------------------------------------------------
// Patina calculation
// -----------------------------------------------------------------

/**
 * Compute patina value (0-1) for a specific wall.
 *
 * Factors:
 *   1. Age: time since the wall's color was last changed
 *   2. Orientation: south fades faster, north stays cooler
 *   3. Memory influence: east wall (Memory Wall) gets warmer with more memories
 *
 * @param wall Which wall (north/south/east/west)
 * @param room The room data (includes wallColors and metadata)
 * @param wallHistory The wall's color history (to determine age)
 * @param memories Memories in this room (for memory influence on east wall)
 */
export function computeWallPatina(
  wall: WallKey,
  room: Room,
  wallHistory: WallHistoryEntry[] | undefined,
  memories: Memory[],
): number {
  const orientation = WALL_ORIENTATIONS[wall] ?? { sunExposure: 1, memoryInfluence: 0.3 };

  // 1. Age-based patina
  let ageDays = 30; // default to full patina if no history
  if (wallHistory && wallHistory.length > 0) {
    const lastChange = wallHistory[wallHistory.length - 1];
    ageDays = (Date.now() - new Date(lastChange.changedAt).getTime()) / (1000 * 60 * 60 * 24);
  } else {
    // No history — use room creation date
    ageDays = (Date.now() - new Date(room.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  }

  const agePatina = Math.min(1, ageDays / PATINA_MAX_DAYS);

  // 2. Sun exposure multiplier
  const sunAdjusted = agePatina * orientation.sunExposure;

  // 3. Memory warmth (east wall / Memory Wall)
  let memoryWarmth = 0;
  if (wall === "east" && memories.length > 0) {
    // More memories = warmer patina, capped at 0.3 boost
    memoryWarmth = Math.min(0.3, memories.length * 0.02);
  }

  // Combine: age-based patina + memory warmth, capped at 1
  const totalPatina = Math.min(1, sunAdjusted + memoryWarmth * orientation.memoryInfluence);

  return totalPatina;
}

// -----------------------------------------------------------------
// Wall history types
// -----------------------------------------------------------------

export interface WallHistoryEntry {
  color: string;
  colorName?: string;
  changedAt: string;
  changedBy: "user" | "companion" | "system";
}

/**
 * Get ghost layer colors from wall history.
 * Returns the two most recent previous colors (before the current one).
 */
export function getGhostLayers(
  wall: WallKey,
  wallHistory: WallHistoryEntry[] | undefined,
): { ghost1: string | null; ghost2: string | null; opacity: number } {
  if (!wallHistory || wallHistory.length < 2) {
    return { ghost1: null, ghost2: null, opacity: 0 };
  }

  // History is append-only. Current color is the last entry.
  // Ghost 1 = second-to-last, Ghost 2 = third-to-last
  const entries = wallHistory;
  const ghost1 = entries.length >= 2 ? entries[entries.length - 2].color : null;
  const ghost2 = entries.length >= 3 ? entries[entries.length - 3].color : null;

  // Ghost opacity: very subtle, decreases with age
  // Only show ghosts if wall is old enough to have patina
  const lastChange = entries[entries.length - 1];
  const ageDays = (Date.now() - new Date(lastChange.changedAt).getTime()) / (1000 * 60 * 60 * 24);
  const opacity = Math.min(0.04, ageDays / 60 * 0.04); // max 4% opacity, reaches max at 60 days

  return { ghost1, ghost2, opacity };
}

/**
 * Compute memory glow position on the Memory Wall (east wall).
 * Given the memory objects' positions, find the center of the glow.
 */
export function computeMemoryGlowCenter(
  memoryObjects: Array<{ position: { x: number; y: number; z: number } }>,
): { pos: [number, number]; radius: number } {
  if (memoryObjects.length === 0) {
    return { pos: [0.5, 0.5], radius: 0.3 };
  }

  // Memory frames are on the east wall (x = +3)
  // UV: z maps to u position, y maps to v position
  // For east wall at x=3, frames at z=-2.2..2.2, y=0.5..3.3
  // UV.u = (z + 3) / 6, UV.v = (y) / 3.2

  const positions = memoryObjects.map((o) => ({
    u: (o.position.z + 3) / 6,
    v: o.position.y / 3.2,
  }));

  // Center of all frame positions
  const centerU = positions.reduce((sum, p) => sum + p.u, 0) / positions.length;
  const centerV = positions.reduce((sum, p) => sum + p.v, 0) / positions.length;

  // Radius: covers the spread of frames + some padding
  const maxDist = Math.max(...positions.map((p) =>
    Math.sqrt((p.u - centerU) ** 2 + (p.v - centerV) ** 2),
  ));
  const radius = Math.max(0.3, Math.min(0.8, maxDist + 0.15));

  return { pos: [centerU, centerV], radius };
}