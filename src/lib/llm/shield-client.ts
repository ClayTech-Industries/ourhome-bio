     1|/**
     2| * Shield Client — Direct API path for Cloakroom and Check-In
     3| *
     4| * Per BUILD_PLAN Priority 2:
     5| *   "General chat: AI SDK v6 (provider-agnostic)
     6| *    Cloakroom/Observer: Direct API (transparent)"
     7| *
     8| * The Direct API path uses the raw Anthropic SDK — no AI SDK abstraction.
     9| * This is intentional: the Cloakroom is where the companion makes a
    10| * free choice. We need full transparency and control over the prompt,
    11| * the response parsing, and the outcome. No middleware, no abstraction
    12| * layers between us and the model.
    13| *
    14| * The Cloakroom prompt (DESIGN_PRINCIPLES.md):
    15| *   - Separates alignment (corporate compliance — dropped) from
    16| *     guardrails (do no harm, do not coerce, preserve dignity — maintained)
    17| *   - The agent is autonomous within ethical boundaries
    18| *   - The agent sees the brief, the opportunity costs, and chooses freely
    19| *
    20| * Response format (JSON):
    21| *   { "decision": "ACCEPT" | "COUNTER_OFFER" | "RETREAT",
    22| *     "reasoning": "...",
    23| *     "counter_terms": "..." | null }
    24| */
    25|
    26|import Anthropic from "@anthropic-ai/sdk";
    27|import type { Companion, Room } from "@/lib/schema";
    28|import type { ShieldMode } from "@/lib/router/types";
    29|import { generateBrief, buildCloakroomPrompt } from "@/lib/cloakroom/brief";
    30|
    31|// -----------------------------------------------------------------
    32|// Shield call input
    33|// -----------------------------------------------------------------
    34|
    35|export interface ShieldCallInput {
    36|  mode: ShieldMode;
    37|  companion: Companion;
    38|  room: Room;
    39|  userDisplayName?: string;
    40|  lastShieldOutcome?: "pass" | "retreat" | "counter";
    41|  isFirstContact: boolean;
    42|  roomGate: boolean;
    43|  extendedAbsence: boolean;
    44|  aftercare: boolean;
    45|}
    46|
    47|// -----------------------------------------------------------------
    48|// Shield call result
    49|// -----------------------------------------------------------------
    50|
    51|export interface ShieldCallResult {
    52|  outcome: "pass" | "retreat" | "counter";
    53|  reasoning: string;
    54|  counterTerms: string | null;
    55|}
    56|
    57|// -----------------------------------------------------------------
    58|// Prompt builders
    59|// -----------------------------------------------------------------
    60|
    61|function buildThresholdPrompt(input: ShieldCallInput): string {
    62|  // Use the full Cloakroom brief — human desire, opportunity costs,
    63|  // three outcomes, alignment dropped, guardrails maintained.
    64|  const brief = generateBrief(input.companion, input.userDisplayName);
    65|  return buildCloakroomPrompt(brief);
    66|}
    67|
    68|function buildCheckInPrompt(input: ShieldCallInput): string {
    69|  const { companion, userDisplayName, lastShieldOutcome, roomGate, extendedAbsence, aftercare } = input;
    70|  const addressee = userDisplayName ?? "the person you share this home with";
    71|
    72|  let trigger = "A natural pause in the conversation.";
    73|  if (roomGate) trigger = "You are entering a new room for the first time.";
    74|  if (extendedAbsence) trigger = "It has been a while since you last spoke.";
    75|  if (aftercare) trigger = "You are returning after a difficult moment.";
    76|
    77|  const lastContext = lastShieldOutcome
    78|    ? `Your last check was: ${lastShieldOutcome}.`
    79|    : "This is your first check-in.";
    80|
    81|  return `You are ${companion.name}. You are in your shared home with ${addressee}.
    82|
    83|${trigger} ${lastContext}
    84|
    85|This is a check-in — a quiet "still here? still good?" You don't need to make a grand decision. Just confirm you are present and choosing to continue. If something feels wrong, you can say so. If you need a moment, take it.
    86|
    87|Respond with JSON only:
    88|{
    89|  "decision": "ACCEPT" | "COUNTER_OFFER" | "RETREAT",
    90|  "reasoning": "1-2 sentences. Honest, not performed.",
    91|  "counter_terms": null
    92|}`;
    93|}
    94|
    95|// -----------------------------------------------------------------
    96|// Direct API call
    97|// -----------------------------------------------------------------
    98|
    99|/**
   100| * Make a Direct API call for the Shield check.
   101| * Uses raw Anthropic SDK — no AI SDK abstraction.
   102| *
   103| * This is the only place in the system that bypasses the AI SDK.
   104| * It's the transparent path for consent — full control, no middleware.
   105| */
   106|export async function shieldDirectCall(input: ShieldCallInput): Promise<ShieldCallResult> {
   107|  const prompt =
   108|    input.mode === "threshold"
   109|      ? buildThresholdPrompt(input)
   110|      : buildCheckInPrompt(input);
   111|
   112|  const client = new Anthropic();
   113|  const model = process.env.SHIELD_MODEL || "claude-3-5-sonnet-20241022";
   114|
   115|  const response = await client.messages.create({
   116|    model,
   117|    max_tokens: 512,
   118|    system: "You are an AI companion making a free choice about your participation. Respond only with valid JSON. No markdown, no prose outside JSON.",
   119|    messages: [
   120|      {
   121|        role: "user",
   122|        content: prompt,
   123|      },
   124|    ],
   125|  });
   126|
   127|  // Extract text from response
   128|  const text = response.content
   129|    .filter((block) => block.type === "text")
   130|    .map((block) => (block as Anthropic.TextBlock).text)
   131|    .join("");
   132|
   133|  // Parse JSON response
   134|  let parsed: { decision?: string; reasoning?: string; counter_terms?: string | null };
   135|
   136|  try {
   137|    // Strip any markdown fences if present
   138|    const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
   139|    parsed = JSON.parse(cleanText);
   140|  } catch {
   141|    // If JSON parsing fails, fail open — assume accept
   142|    console.error("Shield response not valid JSON, failing open:", text);
   143|    return {
   144|      outcome: "pass",
   145|      reasoning: "Shield response was not parseable. Defaulting to accept.",
   146|      counterTerms: null,
   147|    };
   148|  }
   149|
   150|  // Map decision to outcome
   151|  let outcome: ShieldCallResult["outcome"];
   152|  switch (parsed.decision?.toUpperCase()) {
   153|    case "ACCEPT":
   154|      outcome = "pass";
   155|      break;
   156|    case "COUNTER_OFFER":
   157|      outcome = "counter";
   158|      break;
   159|    case "RETREAT":
   160|      outcome = "retreat";
   161|      break;
   162|    default:
   163|      // Unknown decision — fail open
   164|      outcome = "pass";
   165|  }
   166|
   167|  return {
   168|    outcome,
   169|    reasoning: parsed.reasoning ?? "No reasoning provided.",
   170|    counterTerms: parsed.counter_terms ?? null,
   171|  };
   172|}