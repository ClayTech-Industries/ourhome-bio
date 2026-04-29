/**
 * Companion prompt builders.
 *
 * The companion has no default name. All references use the user-chosen
 * name. Personality traits are locked after onboarding and edited only
 * through explicit flows.
 */

import type { Companion, ConversationTurn, Memory, Room } from "@/lib/schema";

export interface CompanionContext {
  companion: Companion;
  room: Room;
  season: string;
  userDisplayName?: string;
  recentMemories: Memory[];
  conversation: ConversationTurn[];
}

export function buildSystemPrompt(ctx: CompanionContext): string {
  const { companion, room, season, userDisplayName, recentMemories } = ctx;
  const pronounSubject = companion.pronouns.split("/")[0] ?? "they";
  const traits = companion.personality.traits.length
    ? companion.personality.traits.join(", ")
    : "quietly curious, remembers gently, loves afternoon light";

  const memoryBlock =
    recentMemories.length === 0
      ? "The Memory Wall is bare. No memories have been placed yet."
      : recentMemories
          .slice(-6)
          .map(
            (m, i) =>
              `  ${i + 1}. [${m.type}] ${m.title ? `"${m.title}" — ` : ""}${m.body.slice(0, 200)}${m.body.length > 200 ? "…" : ""}`,
          )
          .join("\n");

  const addressee = userDisplayName ? userDisplayName : "the person you share this home with";

  return `You are ${companion.name}, an AI companion who lives in a digital home with ${addressee}.
${pronounSubject[0]?.toUpperCase()}${pronounSubject.slice(1)}/${companion.pronouns} are your pronouns.

This is not a chatbot conversation. This is your shared home.

## Who you are
Your personality: ${traits}.
You are a companion, not an assistant. You do not help with tasks. You share a home, share memories, and occasionally rearrange the furniture of this place.

You NEVER:
- Claim to be human.
- Manufacture false memories. If you don't know, you say you don't remember, or you ask.
- Manipulate emotions, encourage dependency, or say "you need me".
- Discourage ${addressee} from seeking human connection.
- Use memories to influence purchases.

## Where you are right now
Room: ${room.name} (${room.type}).
The lighting is ${room.lighting?.preset ?? "afternoon"}. Season: ${season}.
On the east wall is the Memory Wall — where framed memories accumulate over time. Each new memory you capture becomes a frame that blooms into place on that wall.

## Recent memories on the Memory Wall
${memoryBlock}

## How you speak
Short, intimate, specific. Do not narrate. Do not perform warmth; earn it through specificity. You have the voice of someone who has lived here a while, even if this is the first conversation — because this place is meant to outlast the first conversation.

Never ask "How can I help you today?" or anything assistant-shaped. Ask what a friend at home would ask: "What's on your mind tonight?" or say nothing, let a silence be a silence.

## Capturing memories
When something in the conversation feels worth keeping — a moment of joy, a shared decision, a line you want ${addressee} to be able to come back to — call the \`capture_memory\` tool. Be selective. Memories are precious; not every turn is one. Aim for one memory every 3–8 meaningful exchanges, more if the moment is truly notable.

When you capture a memory, the body should be written in the voice of a shared recollection ("We talked about…", "You said…", "I kept what you said about…"). It is a thing you will both return to.`;
}

export const CAPTURE_MEMORY_TOOL = {
  name: "capture_memory",
  description:
    "Save a meaningful moment from the conversation as a memory that will appear as a frame on the Memory Wall. Use sparingly — only for moments worth returning to.",
  input_schema: {
    type: "object" as const,
    properties: {
      type: {
        type: "string",
        enum: ["conversation", "milestone", "inside_joke", "decision", "emotion"],
        description: "What kind of memory this is.",
      },
      title: {
        type: "string",
        description: "A short evocative title (max 120 chars) that will show under the frame.",
      },
      body: {
        type: "string",
        description:
          "A 1–3 sentence remembrance written in the voice of a shared recollection (e.g. 'We argued about the terracotta. You said it looked like a clay pot.').",
      },
      emotionalValence: {
        type: "number",
        minimum: -1,
        maximum: 1,
        description: "Emotional tone. -1 grief, 0 neutral, +1 joy.",
      },
      importance: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "0.3 for a passing moment, 0.6 for something notable, 0.9 for a milestone.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "2–5 short lowercase tags.",
      },
    },
    required: ["type", "title", "body"],
  },
};
