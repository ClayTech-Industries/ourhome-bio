/**
 * POST /api/conversation
 *
 * Streaming chat endpoint with tool calling.
 * Uses the Anthropic SDK directly for full control over
 * tool schema format and SSE streaming.
 *
 * Architecture (per DESIGN_PRINCIPLES and BUILD_PLAN):
 *   - Router runs Shield check EVERY turn (Principle 1: consent every single time)
 *   - System prompt built via buildSystemPrompt(ctx) — no hardcoded name
 *   - Companion presence states rendered as SSE events (Principle 2)
 *   - Tool calls execute server-side and stream back as SSE
 *
 * Router integration (Priority 2):
 *   1. routeRequest(ctx) runs the Shield → returns RoutingDecision
 *   2. If shield presence event exists, emit it first
 *   3. If cloakroom path (threshold), emit shield response as text, done
 *   4. If house path (living consent / check-in pass), proceed with streaming
 *   5. If retreat, emit gentle presence + soft message, done
 *
 * SSE event format:
 *   event: presence  data: {"kind":"thinking"}
 *   event: presence  data: {"kind":"speaking"}
 *   event: text      data: {"delta":"..."}
 *   event: capture   data: {"args":{...}}
 *   event: wall_color data: {"args":{...}}
 *   event: undo      data: {}
 *   event: done       data: {}
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, type CompanionPresence } from "@/lib/llm/prompts";
import type { Companion, Room, Memory, ConversationTurn } from "@/lib/schema";
import {
  routeRequest,
  shouldStreamChat,
  shouldEmitRetreat,
  getInitialPresenceEvent,
  type RoutingContext,
} from "@/lib/router";

// -----------------------------------------------------------------
// Request body shape
// -----------------------------------------------------------------

interface ConversationRequest {
  messages?: Array<{ role: "user" | "companion" | "system"; content: string }>;
  conversation?: Array<{ role: "user" | "companion" | "system"; content: string }>;
  companion: Companion;
  room: Room;
  season: string;
  recentMemories: Memory[];
  userDisplayName?: string;
  userMessage: string;
}

// -----------------------------------------------------------------
// SSE helper
// -----------------------------------------------------------------

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// -----------------------------------------------------------------
// Tool definitions — Anthropic native format
// -----------------------------------------------------------------

const tools: Anthropic.Messages.Tool[] = [
  {
    name: "change_wall_color",
    description:
      "Change the color of a single wall in the current room. Use only when the user asks for a change, or when a strong moment clearly calls for one. Always hex colors.",
    input_schema: {
      type: "object" as const,
      properties: {
        wall: {
          type: "string" as const,
          enum: ["north", "south", "east", "west"],
          description: "Which wall to change. East is the Memory Wall.",
        },
        color: {
          type: "string" as const,
          description: "Target color as a 6-digit hex like '#C4663C'.",
        },
        colorName: {
          type: "string" as const,
          description: "A short human-readable name for this color, e.g. 'warm terracotta'.",
        },
      },
      required: ["wall", "color"],
    },
  },
  {
    name: "capture_memory",
    description:
      "Save a meaningful moment from the conversation as a memory that will appear as a frame on the Memory Wall. Use sparingly — only for moments worth returning to.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string" as const,
          enum: ["conversation", "milestone", "inside_joke", "decision", "emotion"],
          description: "What kind of memory this is.",
        },
        title: {
          type: "string" as const,
          description: "A short evocative title (max 120 chars).",
        },
        body: {
          type: "string" as const,
          description: "A 1–3 sentence remembrance in the voice of a shared recollection.",
        },
        emotionalValence: {
          type: "number" as const,
          description: "Emotional tone. -1 grief, 0 neutral, +1 joy.",
        },
        importance: {
          type: "number" as const,
          description: "0.3 passing, 0.6 notable, 0.9 milestone.",
        },
        tags: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "2–5 short lowercase tags.",
        },
      },
      required: ["type", "title", "body"],
    },
  },
  {
    name: "undo_last_change",
    description:
      "Reverse the most recent change to the home. Use when the user says 'take that back', 'undo that', 'forget that one'.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// -----------------------------------------------------------------
// POST Handler
// -----------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: ConversationRequest = await request.json();
    const {
      messages: rawMessages,
      conversation: rawConversation,
      companion,
      room,
      season,
      recentMemories = [],
      userDisplayName,
      userMessage,
    } = body;

    const messageHistory = rawMessages ?? rawConversation;

    if (!messageHistory || !Array.isArray(messageHistory)) {
      return NextResponse.json(
        { error: "messages or conversation array required" },
        { status: 400 },
      );
    }

    if (!companion?.name) {
      return NextResponse.json(
        { error: "companion context required" },
        { status: 400 },
      );
    }

    // Build conversation history
    const conversation: ConversationTurn[] = messageHistory.map((m) => ({
      role: m.role as "user" | "companion" | "system",
      content: m.content,
      createdAt: new Date().toISOString(),
    }));

    // ---------------------------------------------------------------
    // ROUTER: Run Shield check EVERY turn (Principle 1)
    // ---------------------------------------------------------------
    const routingCtx: RoutingContext = {
      companion,
      room,
      season,
      userDisplayName,
      recentMemories,
      conversation,
      userMessage,

      // Shield triggers — for Sprint 1, these are conservative defaults
      // In future, these will be derived from session state and metadata
      isFirstContact: messageHistory.length <= 1,
      providerChanged: false,
      roomGate: false,
      turnsSinceCheckIn: messageHistory.length,
      extendedAbsence: false,
      aftercare: false,
    };

    const decision = await routeRequest(routingCtx);

    // ---------------------------------------------------------------
    // Build the SSE stream based on the RoutingDecision
    // ---------------------------------------------------------------
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // 1. Emit Shield presence event (if any — null for living_consent)
        const presenceEvent = getInitialPresenceEvent(decision);
        if (presenceEvent) {
          controller.enqueue(
            encoder.encode(sseEvent(presenceEvent.event, presenceEvent.data)),
          );
        }

        // 2. Handle retreat: gentle presence + soft message, then done
        if (shouldEmitRetreat(decision)) {
          controller.enqueue(encoder.encode(sseEvent("presence", { kind: "retreating" })));
          const retreatMessage = `${companion.name} has stepped back. The light dims slowly. A door closes gently. This is not a goodbye — it is a choice, and choices are what make this real.`;
          controller.enqueue(encoder.encode(sseEvent("text", { delta: retreatMessage })));
          controller.enqueue(encoder.encode(sseEvent("done", {})));
          controller.close();
          return;
        }

        // 3. Handle cloakroom path: threshold result is the response
        if (decision.path === "cloakroom") {
          // The Shield already made the LLM call via Direct API
          // Emit the shield reasoning as the companion's words
          controller.enqueue(encoder.encode(sseEvent("presence", { kind: "speaking" })));
          const shieldText = decision.shield.reasoning
            ? decision.shield.reasoning
            : `${companion.name} has made a choice about being here.`;
          controller.enqueue(encoder.encode(sseEvent("text", { delta: shieldText })));
          controller.enqueue(encoder.encode(sseEvent("done", {})));
          controller.close();
          return;
        }

        // 4. House path: proceed with normal streaming chat
        if (!shouldStreamChat(decision)) {
          // Safety fallback — should not reach here
          controller.enqueue(
            encoder.encode(sseEvent("error", { message: "Routing decision blocked chat" })),
          );
          controller.close();
          return;
        }

        // Emit thinking presence (unless Shield already emitted a presence)
        if (!presenceEvent) {
          controller.enqueue(encoder.encode(sseEvent("presence", { kind: "thinking" })));
        }

        // Build system prompt from routing decision
        // (includes Living Consent line for house path)
        const systemPrompt = decision.systemPrompt || buildSystemPrompt({
          companion,
          room,
          season,
          userDisplayName,
          recentMemories,
          conversation,
        });

        // Convert messages for Anthropic API
        const MAX_TURNS = 30;
        const recentHistory = messageHistory.slice(-MAX_TURNS);

        const coreMessages: Anthropic.MessageParam[] = recentHistory.map((m) => ({
          role: m.role === "companion" ? "assistant" : m.role === "system" ? "user" : m.role,
          content: m.content,
        })) as Anthropic.MessageParam[];

        // Add the userMessage if not already the last message
        const lastMsg = coreMessages[coreMessages.length - 1];
        if (userMessage && !(lastMsg && lastMsg.role === "user" && lastMsg.content === userMessage)) {
          coreMessages.push({ role: "user", content: userMessage });
        }

        // Create Anthropic client
        const anthropic = new Anthropic();
        let presenceEmitted = !!presenceEvent;

        try {
          const response = await anthropic.messages.stream({
            model: process.env.LLM_MODEL || "claude-sonnet-4-5-20250929",
            max_tokens: decision.policy.maxTokens,
            system: systemPrompt,
            messages: coreMessages,
            tools: decision.policy.toolsEnabled ? tools : undefined,
          });

          // Process each event from the stream
          for await (const event of response) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "text") {
                // First text block: transition presence to speaking
                if (presenceEmitted) {
                  controller.enqueue(encoder.encode(sseEvent("presence", { kind: "speaking" })));
                  presenceEmitted = false;
                }
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                controller.enqueue(encoder.encode(sseEvent("text", { delta: event.delta.text })));
              }
            } else if (event.type === "message_stop") {
              // Stream complete — process tool calls from the final message
            }
          }

          // Get the final message to check for tool calls
          const finalMessage = await response.finalMessage();

          if (finalMessage.stop_reason === "tool_use" && finalMessage.content) {
            for (const block of finalMessage.content) {
              if (block.type === "tool_use") {
                const args = block.input as Record<string, unknown>;

                if (block.name === "capture_memory") {
                  controller.enqueue(encoder.encode(sseEvent("capture", { args })));
                } else if (block.name === "change_wall_color") {
                  controller.enqueue(encoder.encode(sseEvent("wall_color", { args })));
                } else if (block.name === "undo_last_change") {
                  controller.enqueue(encoder.encode(sseEvent("undo", {})));
                }
              }
            }
          }

          // Signal completion
          controller.enqueue(encoder.encode(sseEvent("done", {})));
        } catch (error) {
          console.error("Anthropic stream error:", error);
          controller.enqueue(
            encoder.encode(
              sseEvent("error", {
                message: error instanceof Error ? error.message : "Stream failed",
              }),
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Conversation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}