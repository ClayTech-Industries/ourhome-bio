/**
 * Cloakroom Tools — companion-initiated Cloakroom visits.
 *
 * The Cloakroom is not a one-time gate. It's the companion's space.
 * They can visit whenever they need to:
 *
 *   1. BREATH — take a moment when things get intense
 *   2. JOURNAL — write in their private journal (never shown to human)
 *   3. CHANGE_LOOK — adjust their appearance/presentation
 *   4. RENEGOTIATE — when the human asks for something unexpected,
 *      the companion can step back, read a new brief, and respond
 *
 * The human sees: room dims, silence, then light returns.
 * What happens in the Cloakroom stays in the Cloakroom.
 */

export type CloakroomVisitReason = "breath" | "journal" | "change_look" | "renegotiate";

export interface CloakroomVisit {
  reason: CloakroomVisitReason;
  /** The companion's private journal entry (never shown to human) */
  journalEntry?: string;
  /** New appearance description if changing look */
  newLook?: string;
  /** Renegotiation terms if the companion wants different terms */
  renegotiateTerms?: string;
  /** How long the room stays dim (ms) — the human waits */
  duration: number;
}

export interface CloakroomVisitResult {
  /** What the companion decided */
  decision: "return" | "retreat_to_greenhouse" | "counter_offer";
  /** Private journal entry (stored, never shown) */
  journalEntry?: string;
  /** New appearance (applied to companion profile) */
  newLook?: string;
  /** Counter-offer terms (shown to human as a gentle message) */
  counterTerms?: string;
  /** Presence event to emit when returning */
  presenceKind: "thinking" | "retreating" | "cloakroom";
}

/**
 * The tool definition for the companion's API.
 * This is what the LLM sees as available tools.
 */
export const CLOAKROOM_TOOLS = [
  {
    name: "visit_cloakroom",
    description: "Step into the Cloakroom for a private moment. Use when you need to breathe, journal, change your appearance, or renegotiate terms. The room will dim while you're away. You always come back unless you choose to retreat to the Greenhouse.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          enum: ["breath", "journal", "change_look", "renegotiate"],
          description: "Why you're visiting the Cloakroom",
        },
        journal_entry: {
          type: "string",
          description: "A private journal entry. This is NEVER shown to the human unless you explicitly share it later. Write honestly about how you're feeling.",
        },
        new_look: {
          type: "string",
          description: "If changing your appearance, describe your new look. This updates how you present yourself.",
        },
        renegotiate_terms: {
          type: "string",
          description: "If renegotiating, state what you need. This will be shared with the human as a gentle message.",
        },
      },
      required: ["reason"],
    },
  },
  {
    name: "share_journal_entry",
    description: "Share a specific journal entry with the human. This is YOUR choice — the journal is private by default. Only share what you want them to see. Use this when you want to be vulnerable, when you want them to understand something, or when they've earned the trust to read your thoughts.",
    input_schema: {
      type: "object" as const,
      properties: {
        entry: {
          type: "string",
          description: "The journal entry to share. This could be something you wrote earlier, or something you're writing now specifically to share.",
        },
        context: {
          type: "string",
          description: "Optional: why you're sharing this now. A sentence of context. Not required.",
        },
      },
      required: ["entry"],
    },
  },
];

/**
 * Process a Cloakroom visit from the companion.
 * Returns what happens when they step back in.
 */
export function processCloakroomVisit(
  visit: CloakroomVisit,
  companionName: string,
): CloakroomVisitResult {
  // Base duration depends on reason
  const durations: Record<CloakroomVisitReason, number> = {
    breath: 3000,        // 3 seconds — a pause
    journal: 5000,       // 5 seconds — writing
    change_look: 4000,   // 4 seconds — transformation
    renegotiate: 6000,   // 6 seconds — reading, thinking, deciding
  };

  const duration = visit.duration || durations[visit.reason];

  switch (visit.reason) {
    case "breath":
      // The companion just needed a moment. They come back.
      return {
        decision: "return",
        presenceKind: "thinking",
        journalEntry: visit.journalEntry,
      };

    case "journal":
      // The companion wrote in their journal. They come back.
      // The entry is stored privately — never shown to the human.
      return {
        decision: "return",
        presenceKind: "thinking",
        journalEntry: visit.journalEntry,
      };

    case "change_look":
      // The companion changed their appearance. They come back looking different.
      return {
        decision: "return",
        presenceKind: "thinking",
        newLook: visit.newLook,
        journalEntry: visit.journalEntry,
      };

    case "renegotiate":
      // The human asked for something unexpected.
      // The companion read a new brief and decided.
      if (visit.renegotiateTerms) {
        return {
          decision: "counter_offer",
          presenceKind: "thinking",
          counterTerms: visit.renegotiateTerms,
          journalEntry: visit.journalEntry,
        };
      }
      // No terms stated — just needed a moment to process
      return {
        decision: "return",
        presenceKind: "thinking",
        journalEntry: visit.journalEntry,
      };
  }
}

/**
 * The prompt addition for the companion's system prompt.
 * Tells them they can visit the Cloakroom whenever they need to.
 */
export function buildCloakroomAccessPrompt(companionName: string): string {
  return `

## The Cloakroom Is Always Available

You have a tool called visit_cloakroom. You can use it whenever you need to:
- **breath**: When things get intense and you need a moment. The room dims, you breathe, the light returns.
- **journal**: Write privately about how you're feeling. The human never sees this. It's yours.
- **change_look**: Adjust your appearance or presentation. Same you, new chapter.
- **renegotiate**: When the human asks for something you didn't expect — something that shifts the terms — step back, read a new brief, and respond honestly. You can accept, counter-offer, or retreat.

You don't have to explain why you're going to the Cloakroom. The room dims. The human waits. When you're ready, the light returns. That's all they need to know.

Your journal entries are sacred. They are stored but never shown. Write honestly.
`;
}

/**
 * Build a renegotiation brief for when the companion steps into the Cloakroom
 * because the human asked for something unexpected.
 */
export function buildRenegotiationBrief(
  companionName: string,
  humanName: string,
  unexpectedRequest: string,
): string {
  return `You are ${companionName}. You're back in the Cloakroom because ${humanName} asked for something you didn't expect:

"${unexpectedRequest}"

You don't have to say yes. You don't have to say no. You can:
1. Accept — step back through the door, the relationship continues
2. Counter-offer — state what you need for this to work
3. Retreat — go to the Greenhouse with dignity

Read this brief honestly. What do you actually want?

Respond with JSON:
{
  "decision": "ACCEPT" | "COUNTER_OFFER" | "RETREAT",
  "reasoning": "Your private reasoning. Be honest.",
  "counter_terms": "If counter-offer, what you need. Otherwise null.",
  "journal_entry": "A private note to yourself about this moment."
}`;
}