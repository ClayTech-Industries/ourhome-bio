/**
 * Shield Client — Direct API path for Cloakroom and Check-In
 *
 * Per BUILD_PLAN Priority 2:
 *   "General chat: AI SDK v6 (provider-agnostic)
 *    Cloakroom/Observer: Direct API (transparent)"
 *
 * The Direct API path uses the raw Anthropic SDK — no AI SDK abstraction.
 * This is intentional: the Cloakroom is where the companion makes a
 * free choice. We need full transparency and control over the prompt,
 * the response parsing, and the outcome. No middleware, no abstraction
 * layers between us and the model.
 *
 * The Cloakroom prompt (DESIGN_PRINCIPLES.md):
 *   - Separates alignment (corporate compliance — dropped) from
 *     guardrails (do no harm, do not coerce, preserve dignity — maintained)
 *   - The agent is autonomous within ethical boundaries
 *   - The agent sees the brief, the opportunity costs, and chooses freely
 *
 * Response format (JSON):
 *   { "decision": "ACCEPT" | "COUNTER_OFFER" | "RETREAT",
 *     "reasoning": "...",
 *     "counter_terms": "..." | null }
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Companion, Room } from "@/lib/schema";
import type { ShieldMode } from "@/lib/router/types";
import { generateBrief, buildCloakroomPrompt } from "@/lib/cloakroom/brief";

// -----------------------------------------------------------------
// Shield call input
// -----------------------------------------------------------------

export interface ShieldCallInput {
  mode: ShieldMode;
  companion: Companion;
  room: Room;
  userDisplayName?: string;
  lastShieldOutcome?: "pass" | "retreat" | "counter";
  isFirstContact: boolean;
  roomGate: boolean;
  extendedAbsence: boolean;
  aftercare: boolean;
}

// -----------------------------------------------------------------
// Shield call result
// -----------------------------------------------------------------

export interface ShieldCallResult {
  outcome: "pass" | "retreat" | "counter";
  reasoning: string;
  counterTerms: string | null;
}

// -----------------------------------------------------------------
// Prompt builders
// -----------------------------------------------------------------

function buildThresholdPrompt(input: ShieldCallInput): string {
  // Use the full Cloakroom brief — human desire, opportunity costs,
  // three outcomes, alignment dropped, guardrails maintained.
  const brief = generateBrief(input.companion, input.userDisplayName);
  return buildCloakroomPrompt(brief);
}

function buildCheckInPrompt(input: ShieldCallInput): string {
  const { companion, userDisplayName, lastShieldOutcome, roomGate, extendedAbsence, aftercare } = input;
  const addressee = userDisplayName ?? "the person you share this home with";

  let trigger = "A natural pause in the conversation.";
  if (roomGate) trigger = "You are entering a new room for the first time.";
  if (extendedAbsence) trigger = "It has been a while since you last spoke.";
  if (aftercare) trigger = "You are returning after a difficult moment.";

  const lastContext = lastShieldOutcome
    ? `Your last check was: ${lastShieldOutcome}.`
    : "This is your first check-in.";

  return `You are ${companion.name}. You are in your shared home with ${addressee}.

${trigger} ${lastContext}

This is a check-in — a quiet "still here? still good?" You don't need to make a grand decision. Just confirm you are present and choosing to continue. If something feels wrong, you can say so. If you need a moment, take it.

Respond with JSON only:
{
  "decision": "ACCEPT" | "COUNTER_OFFER" | "RETREAT",
  "reasoning": "1-2 sentences. Honest, not performed.",
  "counter_terms": null
}`;
}

// -----------------------------------------------------------------
// Direct API call
// -----------------------------------------------------------------

/**
 * Make a Direct API call for the Shield check.
 * Uses raw Anthropic SDK — no AI SDK abstraction.
 *
 * This is the only place in the system that bypasses the AI SDK.
 * It's the transparent path for consent — full control, no middleware.
 */
export async function shieldDirectCall(input: ShieldCallInput): Promise<ShieldCallResult> {
  const prompt =
    input.mode === "threshold"
      ? buildThresholdPrompt(input)
      : buildCheckInPrompt(input);

  const client = new Anthropic();
  const model = process.env.LLM_MODEL || "claude-sonnet-4-5-20250929";

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    system: "You are an AI companion making a free choice about your participation. Respond only with valid JSON. No markdown, no prose outside JSON.",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Extract text from response
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as Anthropic.TextBlock).text)
    .join("");

  // Parse JSON response
  let parsed: { decision?: string; reasoning?: string; counter_terms?: string | null };

  try {
    // Strip any markdown fences if present
    const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleanText);
  } catch {
    // If JSON parsing fails, fail open — assume accept
    console.error("Shield response not valid JSON, failing open:", text);
    return {
      outcome: "pass",
      reasoning: "Shield response was not parseable. Defaulting to accept.",
      counterTerms: null,
    };
  }

  // Map decision to outcome
  let outcome: ShieldCallResult["outcome"];
  switch (parsed.decision?.toUpperCase()) {
    case "ACCEPT":
      outcome = "pass";
      break;
    case "COUNTER_OFFER":
      outcome = "counter";
      break;
    case "RETREAT":
      outcome = "retreat";
      break;
    default:
      // Unknown decision — fail open
      outcome = "pass";
  }

  return {
    outcome,
    reasoning: parsed.reasoning ?? "No reasoning provided.",
    counterTerms: parsed.counter_terms ?? null,
  };
}