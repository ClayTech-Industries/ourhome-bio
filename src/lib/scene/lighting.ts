/**
 * Room Lighting Presets
 *
 * Each preset defines a complete lighting state:
 *   - Ambient light color and intensity
 *   - Directional light color and intensity
 *   - Point light color and intensity
 *
 * Presets are the baseline. Presence states (thinking, speaking, etc.)
 * modify on top of the preset — the preset is the ambient mood,
 * presence is the momentary shift.
 *
 * Dynamic mode maps real time to presets:
 *   Morning: 6:00 - 12:00
 *   Afternoon: 12:00 - 17:00
 *   Evening: 17:00 - 20:00
 *   Night: 20:00 - 6:00
 */

// -----------------------------------------------------------------
// Preset definitions
// -----------------------------------------------------------------

export interface LightingPreset {
  ambient: { color: string; intensity: number };
  directional: { color: string; intensity: number };
  point: { color: string; intensity: number };
  wallTint: string;       // subtle tint applied to walls
  wallIntensity: number;  // intensity multiplier for walls
}

export const LIGHTING_PRESETS: Record<string, LightingPreset> = {
  morning: {
    ambient: { color: "#E8F0FF", intensity: 0.55 },   // cool, bright
    directional: { color: "#FFF5E0", intensity: 1.1 }, // warm sun low
    point: { color: "#FFE8C8", intensity: 0.3 },       // gentle fill
    wallTint: "#F0F5FF",                                // walls reflect cool morning light
    wallIntensity: 1.05,
  },
  afternoon: {
    ambient: { color: "#FFF2DC", intensity: 0.5 },    // warm, balanced (default)
    directional: { color: "#FFD9A8", intensity: 1.0 }, // golden
    point: { color: "#FFC58A", intensity: 0.5 },       // warm fill
    wallTint: "#FFF2DC",                                // neutral warm
    wallIntensity: 1.0,
  },
  evening: {
    ambient: { color: "#FFD9B0", intensity: 0.35 },   // amber, lower
    directional: { color: "#FF9A6A", intensity: 0.6 }, // sunset orange
    point: { color: "#FFB080", intensity: 0.8 },       // warm lamp glow
    wallTint: "#FFD9B0",                                // walls catch sunset
    wallIntensity: 0.85,
  },
  night: {
    ambient: { color: "#3A2A1F", intensity: 0.15 },   // dim, deep
    directional: { color: "#5A4030", intensity: 0.2 }, // almost none
    point: { color: "#D49560", intensity: 1.2 },       // lamplight dominates
    wallTint: "#4A3528",                                // walls are dim, warm
    wallIntensity: 0.6,
  },
};

// -----------------------------------------------------------------
// Dynamic time mapping
// -----------------------------------------------------------------

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

/**
 * Map a Date to a time-of-day preset.
 */
export function timeToPreset(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}

/**
 * Get the lighting preset for a room.
 * If the room uses dynamic mode, compute from current time.
 * Otherwise use the room's configured preset.
 */
export function getRoomLighting(
  preset: string,
  useDynamic: boolean = false,
): LightingPreset {
  if (useDynamic) {
    return LIGHTING_PRESETS[timeToPreset()] ?? LIGHTING_PRESETS.afternoon;
  }
  return LIGHTING_PRESETS[preset] ?? LIGHTING_PRESETS.afternoon;
}