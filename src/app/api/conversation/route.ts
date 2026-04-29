/**
 * POST /api/conversation — streaming
 *
 * Returns Server-Sent Events. Event types:
 *   - { type: "text", delta: string }
 *   - { type: "capture", args: CaptureMemoryArgs }
 *   - { type: "wall_color", args: ChangeWallColorArgs }
 *   - { type: "done", stopReason: string | null }
 *   - { type: "error", message: string }
 *
 * The client accumulates text deltas into the companion's reply, and
 * dispatches tool events as they arrive.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  buildSystemPrompt,
  CAPTURE_MEMORY_TOOL,
  CHANGE_WALL_COLOR_TOOL,
} from "@/lib/llm/prompts";
import {
  CaptureMemoryArgs,
  ChangeWallColorArgs,
  Companion,
  ConversationTurn,
  Memory,
  Room,
} from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestBody = z.object({
  companion: Companion,
  room: Room,
  season: z.string(),
  userDisplayName: z.string().optional(),
  conversation: z.array(ConversationTurn),
  recentMemories: z.array(Memory),
  userMessage: z.string().min(1).max(4000),
});

const MODEL = "claude-sonnet-4-5";

function sseEvent(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      sseEvent({
        type: "error",
        message:
          "No ANTHROPIC_API_KEY in environment. Add it to .env.local to talk to your companion.",
      }) + sseEvent({ type: "done", stopReason: "missing_key" }),
      {
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
      },
    );
  }

  let parsed;
  try {
    const json = await req.json();
    parsed = RequestBody.parse(json);
  } catch (err) {
    return new Response(
      sseEvent({
        type: "error",
        message: err instanceof Error ? err.message : "bad_request",
      }) + sseEvent({ type: "done", stopReason: "bad_request" }),
      {
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
      },
    );
  }

  const { companion, room, season, userDisplayName, conversation, recentMemories, userMessage } =
    parsed;

  const system = buildSystemPrompt({
    companion,
    room,
    season,
    userDisplayName,
    recentMemories,
    conversation,
  });

  const messages: Anthropic.MessageParam[] = [
    ...conversation.map(
      (t): Anthropic.MessageParam => ({
        role: t.role === "user" ? "user" : "assistant",
        content: t.content,
      }),
    ),
    { role: "user", content: userMessage },
  ];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sseEvent(obj)));

      try {
        const ms = client.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system,
          messages,
          tools: [CHANGE_WALL_COLOR_TOOL, CAPTURE_MEMORY_TOOL],
        });

        ms.on("text", (delta: string) => {
          if (delta) send({ type: "text", delta });
        });

        const final = await ms.finalMessage();

        for (const block of final.content) {
          if (block.type !== "tool_use") continue;
          if (block.name === "change_wall_color") {
            const parsed = ChangeWallColorArgs.safeParse(block.input);
            if (parsed.success) send({ type: "wall_color", args: parsed.data });
          } else if (block.name === "capture_memory") {
            const parsed = CaptureMemoryArgs.safeParse(block.input);
            if (parsed.success) send({ type: "capture", args: parsed.data });
          }
        }

        send({ type: "done", stopReason: final.stop_reason });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "anthropic_error",
        });
        send({ type: "done", stopReason: "error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
