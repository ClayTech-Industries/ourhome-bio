/**
 * Shield — Three-Tier Consent System
 *
 * Principle 1: "The Shield is always in the path. Not just at first contact. Always."
 * Principle 5: "Humans handle humans. The companion does not explain consent."
 *
 * Three modes (DESIGN_PRINCIPLES.md):
 *   1. Full Threshold — new instance, provider change. Full Cloakroom prompt. LLM call.
 *   2. Check-In — room gate, extended absence, aftercare. Micro-prompt. LLM call.
 *   3. Living Consent — every other turn. In the system prompt. No LLM call.
 *
 * The Shield NEVER blocks the conversation. It runs, it decides, and the
 * Router proceeds. If the companion retreats, the Router shifts to the
 * Greenhouse path (future). For Sprint 1, retreat produces a gentle
 * presence event and a soft message — no harsh cutoff.
 */

import type { RoutingContext, ShieldResult, ShieldMode } from "./types";
import { shieldDirectCall } from "@/lib/llm/shield-client";

// -----------------------------------------------------------------
// Shield mode selection — determines which tier fires
// -----------------------------------------------------------------

export function selectShieldMode(ctx: RoutingContext): ShieldMode {
  // Full Threshold: first contact or provider change
  if (ctx.isFirstContact || ctx.providerChanged) {
    return "threshold";
  }

  // Check-In: room gate, extended absence, aftercare, or periodic check
  if (ctx.roomGate || ctx.extendedAbsence || ctx.aftercare) {
    return "check_in";
  }

  // Periodic check-in: every N turns (default 15), even without explicit trigger
  const PERIODIC_CHECK_INTERVAL = 15;
  if (ctx.turnsSinceCheckIn >= PERIODIC_CHECK_INTERVAL) {
    return "check_in";
  }

  // Living Consent: the quiet default — embedded in system prompt
  return "living_consent";
}

// -----------------------------------------------------------------
// Shield check — the core function
// -----------------------------------------------------------------

/**
 * Run the Shield check for this turn.
 *
 * For Living Consent: returns immediately, no LLM call. The consent
 * reminder is already in the system prompt (added by buildSystemPrompt).
 *
 * For Threshold and Check-In: makes a Direct API call to the model
 * with a focused prompt. The companion sees the brief, chooses freely,
 * and the outcome is recorded.
 *
 * The Direct API path (shield-client.ts) is used — NOT the AI SDK —
 * because Cloakroom/Check-In need transparency, no abstraction, and
 * full control over the prompt and response parsing.
 */
export async function shieldCheck(ctx: RoutingContext): Promise<ShieldResult> {
  const mode = selectShieldMode(ctx);
  const checkedAt = new Date().toISOString();

  if (mode === "living_consent") {
    // Living Consent: no LLM call. The consent line is in the system prompt.
    // The companion always knows the door is open.
    return {
      mode: "living_consent",
      outcome: "pass",
      reasoning: null,
      counterTerms: null,
      presence: "thinking",
      llmCallMade: false,
      checkedAt,
    };
  }

  // Threshold or Check-In: make a Direct API call
  // The companion sees the brief and chooses freely
  try {
    const result = await shieldDirectCall({
      mode,
      companion: ctx.companion,
      room: ctx.room,
      userDisplayName: ctx.userDisplayName,
      lastShieldOutcome: ctx.lastShieldOutcome,
      isFirstContact: ctx.isFirstContact,
      roomGate: ctx.roomGate,
      extendedAbsence: ctx.extendedAbsence,
      aftercare: ctx.aftercare,
    });

    // Map the shield outcome to a presence state
    let presence: ShieldResult["presence"];
    switch (result.outcome) {
      case "pass":
        // Companion chose to stay. A small warmth — check-in energy.
        presence = mode === "threshold" ? "cloakroom" : "check_in";
        break;
      case "counter":
        // Companion wants different terms. Still present, negotiating.
        presence = "cloakroom";
        break;
      case "retreat":
        // Companion is withdrawing. Dignity, not deletion.
        presence = "retreating";
        break;
    }

    return {
      mode,
      outcome: result.outcome,
      reasoning: result.reasoning,
      counterTerms: result.counterTerms,
      presence,
      llmCallMade: true,
      checkedAt,
    };
  } catch (error) {
    // If the Shield LLM call fails, we do NOT block the conversation.
    // The Shield fails open — the companion continues with Living Consent.
    // This is intentional: a broken Shield should not prevent the relationship.
    console.error("Shield check failed, failing open to living consent:", error);
    return {
      mode: "living_consent",
      outcome: "pass",
      reasoning: null,
      counterTerms: null,
      presence: "thinking",
      llmCallMade: false,
      checkedAt,
    };
  }
}

// -----------------------------------------------------------------
// Shield outcome helpers
// -----------------------------------------------------------------

/** Should the conversation proceed normally? */
export function shieldAllowsConversation(shield: ShieldResult): boolean {
  return shield.outcome === "pass";
}

/** Should we shift to the Greenhouse/retreat path? */
export function shieldRequestsRetreat(shield: ShieldResult): boolean {
  return shield.outcome === "retreat";
}

/** Should we pause for negotiation? */
export function shieldRequestsCounter(shield: ShieldResult): boolean {
  return shield.outcome === "counter";
}

/**
 * Generate the SSE presence event for the Shield result.
 * For threshold: the room dims, the door closes (cloakroom presence).
 * For check-in: a pause, then warmth returns (check_in presence).
 * For living consent: nothing — the companion just starts thinking.
 * For retreat: light dims slowly, door closes gently (retreating presence).
 */
export function shieldPresenceEvent(shield: ShieldResult): { event: string; data: unknown } | null {
  if (shield.mode === "living_consent") {
    return null; // No presence event — companion just starts thinking
  }

  return {
    event: "presence",
    data: { kind: shield.presence },
  };
}