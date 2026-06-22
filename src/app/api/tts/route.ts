/**
 * Text-to-Speech API Route
 *
 * Accepts text + voiceId, returns audio as a streaming response.
 *
 * Provider priority (per BUILD_PLAN):
 *   1. ElevenLabs (quality, requires API key) — primary
 *   2. Edge TTS (free, no API key) — fallback
 *   3. OpenAI TTS (paid) — alternative
 *   4. MiniMax (paid) — alternative
 *
 * Audio is streamed directly — not stored.
 * Voice ID comes from companion profile (home.companion.voiceId).
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIP(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
    }

    const { text, voiceId, provider: requestedProvider } = await request.json() as {
      text: string;
      voiceId?: string;
      provider?: string;
    };

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 },
      );
    }

    // Cap text length to prevent abuse
    const MAX_CHARS = 4096;
    const cleanText = text.slice(0, MAX_CHARS);

    // Try providers in priority order
    // 1. Requested provider (if specified)
    // 2. ElevenLabs (if configured)
    // 3. OpenAI (if configured)
    // 4. MiniMax (if configured)
    // 5. Edge TTS (free fallback)

    const providers = [
      requestedProvider,
      "elevenlabs",
      "openai",
      "minimax",
      "edge",
    ].filter(Boolean) as string[];

    for (const provider of providers) {
      try {
        const audio = await synthesize(provider, cleanText, voiceId);
        if (audio) {
          return new Response(audio, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store",
              "X-TTS-Provider": provider,
            },
          });
        }
      } catch (error) {
        console.error(`TTS ${provider} failed:`, error);
      }
    }

    return NextResponse.json(
      { error: "No TTS provider available" },
      { status: 503 },
    );
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TTS failed" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------
// Provider implementations
// -----------------------------------------------------------------

async function synthesize(provider: string, text: string, voiceId?: string): Promise<ArrayBuffer | null> {
  switch (provider) {
    case "elevenlabs":
      return synthesizeWithElevenLabs(text, voiceId);
    case "openai":
      return synthesizeWithOpenAI(text);
    case "minimax":
      return synthesizeWithMiniMax(text);
    case "edge":
      return synthesizeWithEdge(text);
    default:
      return null;
  }
}

async function synthesizeWithElevenLabs(text: string, voiceId?: string): Promise<ArrayBuffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const defaultVoice = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
  // ElevenLabs voice IDs are expected to be simple tokens; reject anything else.
  const safeVoiceId =
    typeof voiceId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(voiceId) ? voiceId : undefined;
  const voice = safeVoiceId || defaultVoice;
  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );

  if (!response.ok) return null;
  return await response.arrayBuffer();
}

async function synthesizeWithOpenAI(text: string): Promise<ArrayBuffer | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VOICE_TOOLS_OPENAI_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
    }),
  });

  if (!response.ok) return null;
  return await response.arrayBuffer();
}

async function synthesizeWithMiniMax(text: string): Promise<ArrayBuffer | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.minimaxi.com/v1/t2a_v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "speech-02-hd",
      text,
      voice_setting: { voice_id: "female-tianmei" },
    }),
  });

  if (!response.ok) return null;
  return await response.arrayBuffer();
}

async function synthesizeWithEdge(text: string): Promise<ArrayBuffer | null> {
  // Edge TTS is free — uses Microsoft's public TTS endpoint
  // This uses the edge-tts npm package if installed, or falls back
  // For now, use a simple Ssml request to the public endpoint
  const voice = "en-US-AriaNeural";
  const ssml = `<speak version='1.0' xml:lang='en-US'><voice name='${voice}'>${text.replace(/[<>&]/g, (c) => { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c; })}</voice></speak>`;

  const response = await fetch("https://eastus.tts.speech.microsoft.com/cognitiveservices/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
      "User-Agent": "OurHome",
    },
    body: ssml,
  });

  // Edge TTS public endpoint may not work without a key
  // This is a best-effort fallback
  if (!response.ok) return null;
  return await response.arrayBuffer();
}