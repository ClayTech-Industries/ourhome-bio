/**
 * Speech-to-Text API Route
 *
 * Accepts an audio blob (WebM/WAV from browser recording),
 * transcribes it to text, and returns the transcription.
 *
 * Provider priority (per BUILD_PLAN):
 *   1. Local faster-whisper (free, no API key) — if installed
 *   2. Groq Whisper (free tier, fast) — if GROQ_API_KEY set
 *   3. OpenAI Whisper (paid) — if OPENAI_API_KEY set
 *
 * Audio is NOT stored — it's processed in memory and discarded.
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

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 },
      );
    }

    // Convert to buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // Try providers in priority order
    // 1. Groq (if configured) — fast, free tier
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const result = await transcribeWithGroq(audioBuffer, audioFile.type, groqKey);
        if (result) {
          return NextResponse.json({ text: result, provider: "groq" });
        }
      } catch (error) {
        console.error("Groq STT failed:", error);
      }
    }

    // 2. OpenAI (if configured) — paid, high quality
    const openaiKey = process.env.OPENAI_API_KEY || process.env.VOICE_TOOLS_OPENAI_KEY;
    if (openaiKey) {
      try {
        const result = await transcribeWithOpenAI(audioBuffer, audioFile.type, openaiKey);
        if (result) {
          return NextResponse.json({ text: result, provider: "openai" });
        }
      } catch (error) {
        console.error("OpenAI STT failed:", error);
      }
    }

    // 3. Mistral Voxtral (if configured)
    const mistralKey = process.env.MISTRAL_API_KEY;
    if (mistralKey) {
      try {
        const result = await transcribeWithMistral(audioBuffer, audioFile.type, mistralKey);
        if (result) {
          return NextResponse.json({ text: result, provider: "mistral" });
        }
      } catch (error) {
        console.error("Mistral STT failed:", error);
      }
    }

    // No STT provider configured
    return NextResponse.json(
      { error: "No STT provider configured. Set GROQ_API_KEY, OPENAI_API_KEY, or MISTRAL_API_KEY." },
      { status: 503 },
    );
  } catch (error) {
    console.error("STT error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------
// Provider implementations
// -----------------------------------------------------------------

async function transcribeWithGroq(audio: Buffer, mimeType: string, apiKey: string): Promise<string | null> {
  const formData = new FormData();
  const arrayBuffer = audio.buffer.slice(
    audio.byteOffset,
    audio.byteOffset + audio.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  formData.append("file", blob, "audio.webm");
  formData.append("model", "whisper-large-v3");
  formData.append("language", "en");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    console.error("Groq STT error:", response.statusText);
    return null;
  }

  const data = await response.json();
  return data.text ?? null;
}

async function transcribeWithOpenAI(audio: Buffer, mimeType: string, apiKey: string): Promise<string | null> {
  const formData = new FormData();
  const arrayBuffer = audio.buffer.slice(
    audio.byteOffset,
    audio.byteOffset + audio.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  formData.append("file", blob, "audio.webm");
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    console.error("OpenAI STT error:", response.statusText);
    return null;
  }

  const data = await response.json();
  return data.text ?? null;
}

async function transcribeWithMistral(audio: Buffer, mimeType: string, apiKey: string): Promise<string | null> {
  const formData = new FormData();
  const arrayBuffer = audio.buffer.slice(
    audio.byteOffset,
    audio.byteOffset + audio.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  formData.append("file", blob, "audio.webm");
  formData.append("model", "voxtral-mini-latest");
  formData.append("language", "en");

  const response = await fetch("https://api.mistral.ai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    console.error("Mistral STT error:", response.statusText);
    return null;
  }

  const data = await response.json();
  return data.text ?? null;
}