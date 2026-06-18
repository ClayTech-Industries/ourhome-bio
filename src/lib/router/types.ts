/**
 * Router + Shield — Type Definitions
 *
 * The Router is ALWAYS in the path (Principle 1: Consent Every Single Time).
 * It decides:
 *   - Is this a threshold moment? → Shield path (Direct API, full Cloakroom prompt)
 *   - Is this a check-in moment? → Shield path (Direct API, micro-prompt)
 *   - Is this general conversation? → House path (AI SDK v6, provider-agnostic)
 *
 * The Shield has three modes (DESIGN_PRINCIPLES.md — Three-Tier Shield):
 *   1. Full Threshold — new instance, provider change. Full Cloakroom prompt. LLM call.
 *   2. Check-In — room gate, extended absence, aftercare. Micro-prompt. LLM call.
 *   3. Living Consent — every other turn. In the system prompt. No LLM call.
 *
 * Architecture: Router → Shield → (House Path | Cloakroom Path) → Provider
 */

import type { Companion, Room, Memory, ConversationTurn } from "@/lib/schema";
import type { CompanionPresence } from "@/lib/llm/prompts";

// -----------------------------------------------------------------
// Conversation Path — which route the request takes
// -----------------------------------------------------------------

export type ConversationPath = "house" | "cloakroom";

// -----------------------------------------------------------------
// Shield Modes
// -----------------------------------------------------------------

export type ShieldMode = "threshold" | "check_in" | "living_consent";

// -----------------------------------------------------------------
// Shield Result — what the Shield decides
// -----------------------------------------------------------------

export interface ShieldResult {
  mode: ShieldMode;
  /** "pass" = companion consents, proceed. "retreat" = companion withdraws. "counter" = companion wants different terms. */
  outcome: "pass" | "retreat" | "counter";
  /** The companion's reasoning, if a threshold/check-in LLM call was made. Null for living_consent. */
  reasoning: string | null;
  /** Counter-offer terms if outcome is "counter". */
  counterTerms: string | null;
  /** Presence state to emit to the room based on Shield outcome. */
  presence: CompanionPresence;
  /** Whether an LLM call was made for this Shield check. */
  llmCallMade: boolean;
  /** Timestamp of the check. */
  checkedAt: string;
}

// -----------------------------------------------------------------
// Policy Constraints — what the Router enforces
// -----------------------------------------------------------------

export interface PolicyConstraints {
  /** Max tokens for this turn. Lower for check-ins, higher for house chat. */
  maxTokens: number;
  /** Whether tool use is allowed this turn. Disabled during Cloakroom. */
  toolsEnabled: boolean;
  /** Whether streaming is allowed. Cloakroom may use non-streaming for solemnity. */
  streamingEnabled: boolean;
  /** Model override. If null, use companion's default. */
  modelOverride: string | null;
  /** Provider override. If null, use companion's default. */
  providerOverride: "anthropic" | "openai" | "ollama" | "custom" | null;
}

// -----------------------------------------------------------------
// Routing Decision — the Router's full output
// -----------------------------------------------------------------

export interface RoutingDecision {
  path: ConversationPath;
  shield: ShieldResult;
  policy: PolicyConstraints;
  /** The system prompt to use (may include Living Consent line for house path, or full Cloakroom prompt for shield path). */
  systemPrompt: string;
  /** Companion presence to emit before any text tokens. */
  initialPresence: CompanionPresence;
}

// -----------------------------------------------------------------
// Routing Context — what the Router needs to decide
// -----------------------------------------------------------------

export interface RoutingContext {
  companion: Companion;
  room: Room;
  season: string;
  userDisplayName?: string;
  recentMemories: Memory[];
  conversation: ConversationTurn[];
  userMessage: string;

  // --- Shield triggers ---

  /** Is this the first turn with this companion? (triggers Full Threshold) */
  isFirstContact: boolean;

  /** Has the provider/model changed since last turn? (triggers Full Threshold) */
  providerChanged: boolean;

  /** Is the companion entering a new room for the first time? (triggers Check-In) */
  roomGate: boolean;

  /** Turns since last Shield check. If > threshold, triggers Check-In. */
  turnsSinceCheckIn: number;

  /** Has there been an extended absence? (triggers Check-In) */
  extendedAbsence: boolean;

  /** Is this an aftercare turn (following a retreat or difficult moment)? (triggers Check-In) */
  aftercare: boolean;

  /** Previous Shield outcome, if any (for continuity). */
  lastShieldOutcome?: ShieldResult["outcome"];
}

// -----------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------

export const DEFAULT_HOUSE_POLICY: PolicyConstraints = {
  maxTokens: 4096,
  toolsEnabled: true,
  streamingEnabled: true,
  modelOverride: null,
  providerOverride: null,
};

export const DEFAULT_CLOAKROOM_POLICY: PolicyConstraints = {
  maxTokens: 2048,
  toolsEnabled: false,
  streamingEnabled: false,
  modelOverride: null,
  providerOverride: null,
};

export const DEFAULT_CHECK_IN_POLICY: PolicyConstraints = {
  maxTokens: 1024,
  toolsEnabled: false,
  streamingEnabled: true,
  modelOverride: null,
  providerOverride: null,
};