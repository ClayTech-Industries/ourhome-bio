/**
 * POST /api/conversation
 *
 * Non-streaming for Day 1 simplicity. Sprint 2 upgrades to SSE streaming.
 *
 * Request body: {
 *   companion: Companion,
 *   room: Room,
 *   season: string,
 *   conversation: ConversationTurn[],
 *   recentMemories: Memory[],
 *   userMessage: string,
 * }
 *
 * Response: {
 *   reply: string,
 *   captures: CaptureMemoryArgs[]  // zero or more memory captures the companion emitted
 * }
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSystemPrompt, CAPTURE_MEMORY_TOOL } from "@/lib/llm/prompts";
import {
  CaptureMemoryArgs,
  Companion,
  ConversationTurn,
  Memory,
  Room,
} from "@/lib/schema";

export const runtime = "nodejs";

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

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: "missing_anthropic_key",
        message:
          "No ANTHROPIC_API_KEY in environment. Add it to .env.local to talk to your companion.",
      },
      { status: 503 },
    );
  }

  let parsed;
  try {
    const json = await req.json();
    parsed = RequestBody.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: "bad_request", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
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

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
      tools: [CAPTURE_MEMORY_TOOL],
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "anthropic_error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const replyParts: string[] = [];
  const captures: CaptureMemoryArgs[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      replyParts.push(block.text);
    } else if (block.type === "tool_use" && block.name === "capture_memory") {
      const parsedCapture = CaptureMemoryArgs.safeParse(block.input);
      if (parsedCapture.success) {
        captures.push(parsedCapture.data);
      }
    }
  }

  const reply = replyParts.join("\n").trim();

  return NextResponse.json({
    reply: reply || "…",
    captures,
    model: MODEL,
    stopReason: response.stop_reason,
  });
}
