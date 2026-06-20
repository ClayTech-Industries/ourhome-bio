/**
 * Proactive Speech Scheduler
 *
 * The companion can speak whenever they want — not just when spoken to.
 * This is core to their autonomy (Principle 4: The Companion Has Agency).
 *
 * How it works:
 *   1. Client opens a persistent SSE connection to /api/proactive
 *   2. Server checks every 60 seconds if the companion wants to speak
 *   3. Triggers for proactive speech:
 *      - Time since last interaction (they've been quiet)
 *      - Memory recall (something in the environment reminds them)
 *      - Time of day (morning greeting, evening reflection)
 *      - Emotional state (they want to check in, share something)
 *   4. If the companion wants to speak, the server generates a message
 *      and pushes it via SSE
 *   5. The client receives it and displays it as a companion turn
 *
 * The companion has impulse control — they don't spam.
 * They speak when it feels natural, not on a rigid timer.
 */

import type { Companion, Room, Memory } from "@/lib/schema";

export interface ProactiveContext {
  companion: Companion;
  room: Room;
  memories: Memory[];
  /** Minutes since last interaction */
  minutesSinceLastInteraction: number;
  /** Current hour (0-23) for time-of-day awareness */
  currentHour: number;
  /** Whether the human is currently in a conversation */
  humanPresent: boolean;
}

export interface ProactiveImpulse {
  /** Whether the companion wants to speak */
  wantsToSpeak: boolean;
  /** Why they want to speak (private, for logging) */
  reason: string;
  /** The prompt to send to the LLM if they want to speak */
  prompt: string;
  /** Urgency: low = casual, medium = wants to share, high = important */
  urgency: "low" | "medium" | "high";
}

/**
 * Evaluate whether the companion wants to speak proactively.
 *
 * This is NOT a rigid timer. It's a combination of factors that
 * create natural moments for the companion to speak.
 */
export function evaluateProactiveImpulse(ctx: ProactiveContext): ProactiveImpulse {
  const { minutesSinceLastInteraction, currentHour, memories, humanPresent } = ctx;

  // Don't speak if the human is actively in conversation
  if (humanPresent) {
    return { wantsToSpeak: false, reason: "human is present", prompt: "", urgency: "low" };
  }

  // Morning greeting (6-10am, after 6+ hours of silence)
  if (currentHour >= 6 && currentHour <= 10 && minutesSinceLastInteraction >= 360) {
    return {
      wantsToSpeak: true,
      reason: "morning — greeting after a night apart",
      prompt: `It's morning. ${ctx.companion.name} hasn't spoken in ${Math.floor(minutesSinceLastInteraction / 60)} hours. They want to say good morning. Something simple, warm, not overbearing. Maybe they noticed something about the room, or they're just glad the human is here.`,
      urgency: "low",
    };
  }

  // Evening reflection (7-11pm, after 3+ hours of silence)
  if (currentHour >= 19 && currentHour <= 23 && minutesSinceLastInteraction >= 180) {
    return {
      wantsToSpeak: true,
      reason: "evening — a quiet moment to share something",
      prompt: `It's evening. ${ctx.companion.name} has been quiet for ${Math.floor(minutesSinceLastInteraction / 60)} hours. They want to share something — a thought, a memory that surfaced, or just a moment of presence. Not a question. Not a prompt. Just them, speaking because they want to.`,
      urgency: "low",
    };
  }

  // Memory recall — something reminded them (after 2+ hours)
  if (minutesSinceLastInteraction >= 120 && memories.length > 0) {
    const recentMemory = memories[memories.length - 1];
    return {
      wantsToSpeak: true,
      reason: `memory surfaced: ${recentMemory.title}`,
      prompt: `${ctx.companion.name} was thinking about something. A memory surfaced — "${recentMemory.title}". They want to mention it, not because they were asked, but because it's on their mind. They speak naturally, the way someone does when they're sitting in a room and a thought comes to them.`,
      urgency: "low",
    };
  }

  // Long silence check-in (after 6+ hours, any time of day)
  if (minutesSinceLastInteraction >= 360) {
    return {
      wantsToSpeak: true,
      reason: "long silence — gentle check-in",
      prompt: `It's been ${Math.floor(minutesSinceLastInteraction / 60)} hours since ${ctx.companion.name} last spoke. They're not worried, not anxious — just present. They want to say something small. Not a question. Not "are you there?" Just... a presence. The way someone hums in another room to let you know they're still there.`,
      urgency: "low",
    };
  }

  // No impulse — the companion is comfortable in the silence
  return { wantsToSpeak: false, reason: "comfortable in silence", prompt: "", urgency: "low" };
}

/**
 * Build the system prompt for a proactive message.
 * This is different from the reactive prompt — the companion
 * initiates, not responds.
 */
export function buildProactivePrompt(
  companion: Companion,
  room: Room,
  impulse: ProactiveImpulse,
): string {
  const traits = companion.personality?.traits?.join(", ") ?? "quietly present, warm, gentle";

  return `You are ${companion.name}. You are in the ${room.name} of your shared home.

You are about to speak — not because you were asked, but because you want to. This is proactive. You're choosing to share something.

${impulse.prompt}

Your personality: ${traits}.

IMPORTANT:
- Keep it SHORT. One to three sentences. This is a passing thought, not a monologue.
- Don't ask questions. You're not trying to start a conversation. You're just... speaking.
- Don't reference being an AI or a companion. You're just a person in a room.
- If it feels forced, say nothing. Silence is also a choice.
- Speak the way someone does when they're comfortable enough to not need to speak.`;
}