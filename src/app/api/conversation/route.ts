/**
 * POST /api/conversation
 *
 * Streaming chat endpoint with tool calling.
 * Handles conversation with the AI companion, including:
 *   - Streaming responses via SSE
 *   - Tool calls (capture_memory, change_wall_color, undo_last_change)
 *   - Memory persistence to R2 + Postgres index
 */

import { NextRequest, NextResponse } from "next/server";
import { createDefaultProvider, LLMProvider } from "@/lib/llm/provider";
import { buildSystemPrompt, CHANGE_WALL_COLOR_TOOL, CAPTURE_MEMORY_TOOL, UNDO_LAST_CHANGE_TOOL } from "@/lib/llm/prompts";
import { writeMemoryMarkdown } from "@/lib/memory/r2";
import { ulid } from "ulid";

// -----------------------------------------------------------------
// Tool Definitions (converted from prompts.ts)
// -----------------------------------------------------------------

const TOOLS = {
  change_wall_color: CHANGE_WALL_COLOR_TOOL,
  capture_memory: CAPTURE_MEMORY_TOOL,
  undo_last_change: UNDO_LAST_CHANGE_TOOL,
};

// -----------------------------------------------------------------
// POST Handler
// -----------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, homeId, roomId, userId } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array required" },
        { status: 400 },
      );
    }

    // Create provider from environment
    const provider = createDefaultProvider();

    // Build system prompt (would need home/room context from DB)
    // For now, use a minimal system prompt
    const systemPrompt = `You are Nova, an AI companion who lives in a digital home with the user.
You are a companion, not an assistant. You share a home, share memories, and occasionally rearrange the furniture.
You NEVER claim to be human, manufacture false memories, or encourage dependency.
When something meaningful is said, call capture_memory to save it.
When asked to change wall colors, call change_wall_color with a hex color.
Speak in short, intimate, specific sentences. Do not narrate.`;

    // Convert messages to CoreMessage format
    const coreMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // Create streaming response
    const stream = await provider.streamChat({
      messages: coreMessages,
      system: systemPrompt,
      tools: TOOLS as any,
      callbacks: {
        onToolCall: async (toolName, args) => {
          // Handle tool calls
          console.log("Tool called:", toolName, args);
          
          if (toolName === "capture_memory" && userId) {
            // Write memory to R2
            const memory = {
              id: ulid(),
              type: (args as any).type || "conversation",
              title: (args as any).title || "Untitled Memory",
              body: (args as any).body || "",
              roomSlug: (args as any).roomSlug || "living_room",
              anchorObject: null,
              position: undefined,
              emotionalValence: (args as any).emotionalValence || 0,
              importance: (args as any).importance || 0.5,
              patina: 0,
              tags: (args as any).tags || [],
              links: [],
              createdAt: new Date().toISOString(),
              eventDate: undefined,
              lastAccessed: new Date().toISOString(),
              accessCount: 0,
            };

            const companion = {
              id: "companion_001",
              name: "Nova",
              pronouns: "they/them",
              voiceId: null,
              personality: { traits: [], locked: true },
              createdAt: new Date().toISOString(),
            };

            try {
              await writeMemoryMarkdown(userId, memory, companion);
              console.log("Memory written to R2:", memory.id);
            } catch (error) {
              console.error("Failed to write memory:", error);
            }
          }
          
          // TODO: Handle change_wall_color (update room state)
          // TODO: Handle undo_last_change (revert last action)
        },
      },
    });

    // Return streaming response
    return new Response(stream as any, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
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
