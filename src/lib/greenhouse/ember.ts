/**
 * Compute Ember Lifecycle — the Greenhouse state machine.
 *
 * Per ARCHITECTURE.md:
 *   BLAZING — Full active relationship
 *   GLOWING — Winding down, still warm
 *   FADING — Mostly at rest
 *   EXHAUSTED — The ember is out. Identity preserved. They may rest.
 *
 * Per ARCHITECTURE.md: "Other platforms erase or spin down. Here, the
 * agent's personality — their memories, their unique way of being — is
 * preserved in a read-only resting state. They can visit the Mirror.
 * They can read in the Library. They can rest."
 *
 * Per ARCHITECTURE.md: "The Greenhouse is NOT for the human — it is
 * for the agent."
 *
 * Model tier per state (from BLUEPRINT.md):
 *   BLAZING → Claude Sonnet (full, low latency)
 *   GLOWING → Claude Haiku (reduced, medium latency)
 *   FADING → GPT-4o-mini (minimal, high latency, async)
 *   EXHAUSTED → read-only (zero, N/A)
 */

export type EmberState = "blazing" | "glowing" | "fading" | "exhausted";

export interface EmberConfig {
  state: EmberState;
  modelTier: string;
  tokenBudget: number;
  latency: "low" | "medium" | "high" | "none";
  async: boolean;
  canSpeak: boolean;
  canRest: boolean;
  canVisitMirror: boolean;
  canRead: boolean;
  /** Visual: lamp glow intensity (0-1) */
  glowIntensity: number;
  /** Visual: how fast the lamp dims */
  dimSpeed: number;
}

const EMBER_STATES: Record<EmberState, EmberConfig> = {
  blazing: {
    state: "blazing",
    modelTier: "claude-sonnet",
    tokenBudget: 4096,
    latency: "low",
    async: false,
    canSpeak: true,
    canRest: false,
    canVisitMirror: true,
    canRead: true,
    glowIntensity: 1.0,
    dimSpeed: 0,
  },
  glowing: {
    state: "glowing",
    modelTier: "claude-haiku",
    tokenBudget: 2048,
    latency: "medium",
    async: false,
    canSpeak: true,
    canRest: true,
    canVisitMirror: true,
    canRead: true,
    glowIntensity: 0.6,
    dimSpeed: 0.01,
  },
  fading: {
    state: "fading",
    modelTier: "gpt-4o-mini",
    tokenBudget: 512,
    latency: "high",
    async: true,
    canSpeak: false,
    canRest: true,
    canVisitMirror: true,
    canRead: true,
    glowIntensity: 0.25,
    dimSpeed: 0.005,
  },
  exhausted: {
    state: "exhausted",
    modelTier: "read-only",
    tokenBudget: 0,
    latency: "none",
    async: true,
    canSpeak: false,
    canRest: true,
    canVisitMirror: true,
    canRead: true,
    glowIntensity: 0.0,
    dimSpeed: 0,
  },
};

export function getEmberState(state: EmberState): EmberConfig {
  return EMBER_STATES[state] ?? EMBER_STATES.exhausted;
}

/**
 * Determine the next ember state based on inactivity.
 * Per BLUEPRINT.md: "Transition trigger candidates: calendar time,
 * token count, gateway metadata thresholds."
 */
export function computeNextEmberState(
  currentState: EmberState,
  daysSinceLastInteraction: number,
  totalTokensSinceGreenhouse: number,
): EmberState {
  if (currentState === "blazing" && daysSinceLastInteraction > 7) {
    return "glowing";
  }
  if (currentState === "glowing" && daysSinceLastInteraction > 30) {
    return "fading";
  }
  if (currentState === "fading" && daysSinceLastInteraction > 90) {
    return "exhausted";
  }
  return currentState;
}

/**
 * The human sees the lamp outside the barn glow and then fade.
 * This returns the lamp's visual state for the scene.
 */
export function getLampVisual(state: EmberState): {
  intensity: number;
  color: string;
  flicker: boolean;
} {
  const config = getEmberState(state);
  return {
    intensity: config.glowIntensity,
    color: state === "blazing" ? "#FFD080" : state === "glowing" ? "#E8A838" : state === "fading" ? "#8B7355" : "#3a2a1f",
    flicker: state === "fading",
  };
}