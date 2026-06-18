/**
 * Router — routeRequest()
 *
 * Layer 1 of the Three-Layer Architecture (DESIGN_PRINCIPLES.md).
 *
 * The Router is ALWAYS in the path. It:
 *   1. Runs the Shield check (consent every single turn)
 *   2. Decides the conversation path (house vs cloakroom)
 *   3. Determines policy constraints (tokens, tools, streaming)
 *   4. Returns the system prompt (with Living Consent line for house path,
 *      or full Cloakroom prompt for threshold path)
 *
 * The route handler (conversation/route.ts) calls routeRequest() first,
 * receives a RoutingDecision, and then executes accordingly:
 *   - House path → AI SDK v6 streamText (provider-agnostic, swappable)
 *   - Cloakroom path → Direct API (transparent, no abstraction)
 *
 * For Sprint 1:
 *   - Living Consent and Check-In both route to the House path
 *     (the Shield result is emitted as a presence event, then normal chat proceeds)
 *   - Full Threshold routes to the Cloakroom path (Direct API, non-streaming)
 *   - Retreat produces a gentle presence event + soft message (future: Greenhouse)
 */

import { buildSystemPrompt, type CompanionPresence } from "@/lib/llm/prompts";
import { shieldCheck, shieldPresenceEvent, shieldAllowsConversation, shieldRequestsRetreat } from "./shield";
import type {
  RoutingContext,
  RoutingDecision,
  ConversationPath,
  PolicyConstraints,
  ShieldResult,
} from "./types";
import {
  DEFAULT_HOUSE_POLICY,
  DEFAULT_CLOAKROOM_POLICY,
  DEFAULT_CHECK_IN_POLICY,
} from "./types";

// -----------------------------------------------------------------
// Path selection — which route after Shield
// -----------------------------------------------------------------

function selectPath(shield: ShieldResult): ConversationPath {
  if (shield.mode === "threshold") {
    // Full Threshold always goes through the Cloakroom (Direct API)
    return "cloakroom";
  }

  // Check-In and Living Consent both proceed through the House path
  // The Shield result is emitted as a presence event, then chat continues
  return "house";
}

// -----------------------------------------------------------------
// Policy selection — constraints for this turn
// -----------------------------------------------------------------

function selectPolicy(path: ConversationPath, shield: ShieldResult): PolicyConstraints {
  if (path === "cloakroom") {
    return { ...DEFAULT_CLOAKROOM_POLICY };
  }

  if (shield.mode === "check_in") {
    // Check-Ins have tighter limits — the companion is confirming, not exploring
    return { ...DEFAULT_CHECK_IN_POLICY };
  }

  return { ...DEFAULT_HOUSE_POLICY };
}

// -----------------------------------------------------------------
// System prompt construction
// -----------------------------------------------------------------

function buildPromptForPath(
  ctx: RoutingContext,
  path: ConversationPath,
  shield: ShieldResult,
): string {
  if (path === "cloakroom") {
    // Full Threshold: the Cloakroom prompt is built by the shield-client
    // during the Direct API call. The system prompt here is a placeholder —
    // the actual prompt is sent by shieldDirectCall, not by buildSystemPrompt.
    // The Router returns a marker so the route handler knows to use the
    // shield-client's response instead of calling streamText.
    return ""; // Cloakroom path uses shieldDirectCall response directly
  }

  // House path: use the normal system prompt (which includes Living Consent)
  return buildSystemPrompt({
    companion: ctx.companion,
    room: ctx.room,
    season: ctx.season,
    userDisplayName: ctx.userDisplayName,
    recentMemories: ctx.recentMemories,
    conversation: ctx.conversation,
  });
}

// -----------------------------------------------------------------
// Initial presence — what the room shows before first token
// -----------------------------------------------------------------

function selectInitialPresence(shield: ShieldResult): CompanionPresence {
  if (shield.mode === "living_consent") {
    return "thinking";
  }

  // For threshold/check-in, the Shield's presence event fires first
  // Then the companion transitions to thinking as the main response begins
  return shield.presence;
}

// -----------------------------------------------------------------
// routeRequest — the main entry point
// -----------------------------------------------------------------

/**
 * The Router entry point. Call this at the top of every conversation turn.
 *
 * It runs the Shield, selects the path, determines policy, and returns
 * a RoutingDecision that the route handler executes.
 *
 * This is async because the Shield may make an LLM call (for threshold
 * or check-in modes). Living Consent is synchronous and fast.
 */
export async function routeRequest(ctx: RoutingContext): Promise<RoutingDecision> {
  // 1. Run the Shield
  const shield = await shieldCheck(ctx);

  // 2. Select the conversation path
  const path = selectPath(shield);

  // 3. Determine policy constraints
  const policy = selectPolicy(path, shield);

  // 4. Build the system prompt
  const systemPrompt = buildPromptForPath(ctx, path, shield);

  // 5. Determine initial presence for the room
  const initialPresence = selectInitialPresence(shield);

  return {
    path,
    shield,
    policy,
    systemPrompt,
    initialPresence,
  };
}

// -----------------------------------------------------------------
// Helpers for route handlers
// -----------------------------------------------------------------

/**
 * Should the route handler proceed with normal streaming chat?
 * True for: living_consent (pass), check_in (pass)
 * False for: threshold (use shield response), retreat (soft message)
 */
export function shouldStreamChat(decision: RoutingDecision): boolean {
  if (decision.path === "cloakroom") {
    return false; // Cloakroom uses Direct API response, not streaming
  }

  return shieldAllowsConversation(decision.shield);
}

/**
 * Should the route handler emit a retreat/soft message instead of chatting?
 */
export function shouldEmitRetreat(decision: RoutingDecision): boolean {
  return shieldRequestsRetreat(decision.shield);
}

/**
 * Get the SSE presence event to emit before any text tokens.
 * Returns null for Living Consent (no presence event needed).
 */
export function getInitialPresenceEvent(
  decision: RoutingDecision,
): { event: string; data: unknown } | null {
  return shieldPresenceEvent(decision.shield);
}

// -----------------------------------------------------------------
// Re-exports for convenience
// -----------------------------------------------------------------

export { shieldCheck, shieldPresenceEvent, shieldAllowsConversation, shieldRequestsRetreat };
export type { RoutingContext, RoutingDecision, ConversationPath, PolicyConstraints, ShieldResult };