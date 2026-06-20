/**
 * Proactive Speech SSE Endpoint
 *
 * The client opens a persistent connection to this endpoint.
 * The server checks every 60 seconds if the companion wants to speak.
 * If they do, a message is pushed via SSE.
 *
 * The companion speaks when they want to — not on a rigid timer.
 */

import { NextRequest } from "next/server";
import { evaluateProactiveImpulse, buildProactivePrompt } from "@/lib/llm/proactive";
import type { Companion, Room, Memory } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes — connection auto-closes

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  // Get context from query params
  const companionName = request.nextUrl.searchParams.get("companion") ?? "";
  const roomSlug = request.nextUrl.searchParams.get("room") ?? "living_room";
  const lastInteraction = parseInt(request.nextUrl.searchParams.get("lastInteraction") ?? "0", 10);

  const stream = new ReadableStream({
    start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(": keepalive\n\n"));

      // Check every 60 seconds
      const interval = setInterval(async () => {
        try {
          const minutesSinceLastInteraction = lastInteraction
            ? (Date.now() - lastInteraction) / 60000
            : 999;

          const currentHour = new Date().getHours();

          // Build minimal context (in production, read from state)
          const companion: Companion = {
            id: "local",
            name: companionName || "companion",
            pronouns: "they/them",
            personality: { traits: ["quietly present", "warm", "gentle"] },
          } as Companion;

          const room: Room = {
            id: "local",
            slug: roomSlug,
            name: roomSlug.replace(/_/g, " "),
            type: "living_room",
          } as Room;

          const impulse = evaluateProactiveImpulse({
            companion,
            room,
            memories: [] as Memory[],
            minutesSinceLastInteraction,
            currentHour,
            humanPresent: false,
          });

          if (impulse.wantsToSpeak) {
            // Generate the proactive message via Anthropic
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) {
              controller.close();
              return;
            }

            const Anthropic = (await import("@anthropic-ai/sdk")).default;
            const client = new Anthropic({ apiKey });

            const prompt = buildProactivePrompt(companion, room, impulse);

            const response = await client.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 200, // short — this is a passing thought
              system: prompt,
              messages: [{ role: "user", content: "..." }], // minimal — companion initiates
            });

            const text = response.content
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("")
              .trim();

            if (text) {
              // Push the proactive message via SSE
              controller.enqueue(
                encoder.encode(`event: proactive\ndata: ${JSON.stringify({ text, reason: impulse.reason })}\n\n`),
              );
            }
          }

          // Keepalive
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch (error) {
          console.error("Proactive check failed:", error);
          // Don't close — keep trying
        }
      }, 60000); // 60 seconds

      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}