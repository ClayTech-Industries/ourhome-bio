/**
 * Companion presence → environment mapping.
 *
 * Shared between LivingRoom, Kitchen, and any future room.
 *
 * Per Principle 3: "No loading spinners. No 'typing...' indicators.
 * The room IS the interface."
 *
 * Each presence state maps to subtle environmental parameters:
 *   - Ambient light intensity
 *   - Directional (sun) light intensity
 *   - Point light intensity
 *   - Memory Wall glow (recalling frame)
 *   - Memory Wall warmth (considering capture)
 *
 * These are not dramatic shifts. The room breathes. It doesn't flash.
 */

import type { CompanionPresence } from "@/lib/llm/prompts";

export interface RoomEnvironment {
  ambientIntensity: number;
  directionalIntensity: number;
  pointLightIntensity: number;
  memoryWallGlow: number;
  memoryWallWarmth: number;
}

export function presenceToEnvironment(
  presence: CompanionPresence | null | undefined,
): RoomEnvironment {
  switch (presence) {
    case "thinking":
      return {
        ambientIntensity: 0.32,
        directionalIntensity: 0.85,
        pointLightIntensity: 0.15,
        memoryWallGlow: 0,
        memoryWallWarmth: 0,
      };
    case "recalling":
      return {
        ambientIntensity: 0.38,
        directionalIntensity: 0.9,
        pointLightIntensity: 0.3,
        memoryWallGlow: 0.7,
        memoryWallWarmth: 0,
      };
    case "considering_capture":
      return {
        ambientIntensity: 0.40,
        directionalIntensity: 0.95,
        pointLightIntensity: 0.35,
        memoryWallGlow: 0.3,
        memoryWallWarmth: 0.4,
      };
    case "considering_wall":
      return {
        ambientIntensity: 0.42,
        directionalIntensity: 0.95,
        pointLightIntensity: 0.3,
        memoryWallGlow: 0,
        memoryWallWarmth: 0.3,
      };
    case "check_in":
      return {
        ambientIntensity: 0.45,
        directionalIntensity: 1.0,
        pointLightIntensity: 0.25,
        memoryWallGlow: 0,
        memoryWallWarmth: 0,
      };
    case "retreating":
      return {
        ambientIntensity: 0.2,
        directionalIntensity: 0.6,
        pointLightIntensity: 0.05,
        memoryWallGlow: 0,
        memoryWallWarmth: 0,
      };
    case "cloakroom":
      return {
        ambientIntensity: 0.15,
        directionalIntensity: 0.5,
        pointLightIntensity: 0.05,
        memoryWallGlow: 0,
        memoryWallWarmth: 0,
      };
    case "speaking":
    default:
      return {
        ambientIntensity: 0.45,
        directionalIntensity: 1.1,
        pointLightIntensity: 0.25,
        memoryWallGlow: 0,
        memoryWallWarmth: 0,
      };
  }
}