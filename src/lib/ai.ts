import { randomUUID } from "crypto";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";
import Groq from "groq-sdk";
import { CohereClient } from "cohere-ai";

/**
 * Unified AI gateway for OurHome.
 *
 * Supports multiple frontier providers. Missing keys simply disable that provider.
 * In the beta phase we use a Bring-Your-Own-Key (BYOK) model: a user can supply
 * their own provider key, which is tried first. If it is missing, absent, or fails,
 * the house keys are used as a fallback. This keeps our costs down while letting
 * users stay on their preferred model, and gives us a unified surface to swap
 * providers behind if costs spike or an outage occurs.
 *
 * File: src/lib/ai.ts
 */

export type AIProvider =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "mistral"
  | "groq"
  | "cohere";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIOptions {
  provider?: AIProvider | "byok";
  model?: string;
  byokKey?: string; // user's own key, if any
  temperature?: number;
  maxTokens?: number;
  fallback?: AIProvider[];
}

export interface AIResponse {
  id: string;
  provider: AIProvider;
  model: string;
  content: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

// Defaults — these are aliases so we automatically get the latest stable model.
const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-5",
  google: "gemini-2.5-flash",
  xai: "grok-4.3",
  mistral: "mistral-large-latest",
  groq: "llama-3.3-70b-versatile",
  cohere: "command-r-plus",
};

const DEFAULT_FALLBACK: AIProvider[] = [
  "xai",
  "openai",
  "anthropic",
  "google",
  "mistral",
  "groq",
  "cohere",
];

// -----------------------------------------------------------------
// Provider key resolution
// -----------------------------------------------------------------

function envKey(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() || undefined;
}

function providerAvailable(provider: AIProvider): boolean {
  const keys: Record<AIProvider, string | string[]> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_GENERATIVE_AI_API_KEY",
    xai: "XAI_API_KEY",
    mistral: "MISTRAL_API_KEY",
    groq: "GROQ_API_KEY",
    cohere: "COHERE_API_KEY",
  };
  const name = keys[provider];
  if (Array.isArray(name)) {
    return name.some((n) => !!envKey(n));
  }
  return !!envKey(name);
}

function pickKey(provider: AIProvider, byokKey?: string): string | undefined {
  if (byokKey) return byokKey.trim();

  const keys: Record<AIProvider, string | string[]> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_GENERATIVE_AI_API_KEY",
    xai: "XAI_API_KEY",
    mistral: "MISTRAL_API_KEY",
    groq: "GROQ_API_KEY",
    cohere: "COHERE_API_KEY",
  };
  const names = keys[provider];
  if (Array.isArray(names)) {
    for (const name of names) {
      const value = envKey(name);
      if (value) return value;
    }
    return undefined;
  }
  return envKey(names);
}

// -----------------------------------------------------------------
// Provider handlers
// -----------------------------------------------------------------

async function callAnthropic(
  key: string,
  messages: AIMessage[],
  model: string,
  opts: AIOptions,
): Promise<AIResponse> {
  const client = new Anthropic({ apiKey: key });

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const conversation = messages.filter((m) => m.role !== "system");

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system,
    messages: conversation as Anthropic.MessageParam[],
    temperature: opts.temperature ?? 0.7,
  });

  const content = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");

  return {
    id: response.id,
    provider: "anthropic",
    model,
    content,
    usage: {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      totalTokens: response.usage?.input_tokens && response.usage?.output_tokens
        ? response.usage.input_tokens + response.usage.output_tokens
        : undefined,
    },
  };
}

async function callOpenAI(
  key: string,
  messages: AIMessage[],
  model: string,
  opts: AIOptions,
  baseURL?: string,
  providerName: AIProvider = "openai",
): Promise<AIResponse> {
  // Some providers (e.g. xAI) send responses that trigger Node's gzip
  // premature-close bug. Requesting uncompressed responses avoids it.
  const isXAI = baseURL?.includes("api.x.ai");
  const client = new OpenAI({
    apiKey: key,
    baseURL,
    defaultHeaders: isXAI ? { "Accept-Encoding": "identity" } : undefined,
  });

  const response = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1024,
  });

  const choice = response.choices[0];
  return {
    id: response.id ?? randomUUID(),
    provider: providerName,
    model,
    content: choice?.message?.content ?? "",
    usage: {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    },
  };
}

async function callGoogle(
  key: string,
  messages: AIMessage[],
  model: string,
  opts: AIOptions,
): Promise<AIResponse> {
  const client = new GoogleGenerativeAI(key);
  const genModel = client.getGenerativeModel({ model });

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const conversation = messages.filter((m) => m.role !== "system");

  const history = conversation.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  // For Gemini, system instruction should be set at model creation time,
  // but we can prepend it to the first user message as a fallback.
  const chat = genModel.startChat({
    history,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 1024,
    },
  });

  const prompt = system
    ? `${system}\n\n${history[history.length - 1]?.parts[0]?.text ?? ""}`
    : history[history.length - 1]?.parts[0]?.text ?? "";

  const result = await chat.sendMessage(prompt);
  const response = result.response;

  return {
    id: randomUUID(),
    provider: "google",
    model,
    content: response.text(),
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
      totalTokens: response.usageMetadata?.totalTokenCount,
    },
  };
}

async function callXAI(
  key: string,
  messages: AIMessage[],
  model: string,
  opts: AIOptions,
): Promise<AIResponse> {
  return callOpenAI(
    key,
    messages,
    model,
    opts,
    "https://api.x.ai/v1",
    "xai",
  );
}

async function callMistral(
  key: string,
  messages: AIMessage[],
  model: string,
  opts: AIOptions,
): Promise<AIResponse> {
  const client = new Mistral({ apiKey: key });

  const response = await client.chat.complete({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: opts.temperature ?? 0.7,
    maxTokens: opts.maxTokens ?? 1024,
  });

  const content =
    typeof response.choices?.[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : "";

  return {
    id: response.id ?? randomUUID(),
    provider: "mistral",
    model,
    content,
    usage: {
      inputTokens: response.usage?.promptTokens,
      outputTokens: response.usage?.completionTokens,
      totalTokens: response.usage?.totalTokens,
    },
  };
}

async function callGroq(
  key: string,
  messages: AIMessage[],
  model: string,
  opts: AIOptions,
): Promise<AIResponse> {
  const client = new Groq({ apiKey: key });

  const response = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1024,
  });

  const choice = response.choices[0];
  return {
    id: response.id ?? randomUUID(),
    provider: "groq",
    model,
    content: choice?.message?.content ?? "",
    usage: {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    },
  };
}

async function callCohere(
  key: string,
  messages: AIMessage[],
  model: string,
  opts: AIOptions,
): Promise<AIResponse> {
  const client = new CohereClient({ token: key });

  const chatHistory: { role: "SYSTEM" | "USER" | "CHATBOT"; message: string }[] = messages.map((m) => ({
    role: m.role === "system" ? "SYSTEM" : m.role === "user" ? "USER" : "CHATBOT",
    message: m.content,
  }));

  // Separate system messages and conversation
  const systemMessages = chatHistory.filter((m) => m.role === "SYSTEM");
  const conversation = chatHistory.filter((m) => m.role !== "SYSTEM");
  const preamble = systemMessages.map((m) => m.message).join("\n\n") || undefined;

  const response = await client.chat({
    model,
    message: conversation[conversation.length - 1]?.message ?? "",
    chatHistory: conversation.slice(0, -1),
    preamble,
    temperature: opts.temperature ?? 0.7,
    maxTokens: opts.maxTokens ?? 1024,
  });

  return {
    id: randomUUID(),
    provider: "cohere",
    model,
    content: response.text,
    usage: {
      inputTokens: response.meta?.tokens?.inputTokens,
      outputTokens: response.meta?.tokens?.outputTokens,
    },
  };
}

const PROVIDER_HANDLERS: Record<
  AIProvider,
  (key: string, messages: AIMessage[], model: string, opts: AIOptions) => Promise<AIResponse>
> = {
  anthropic: callAnthropic,
  openai: callOpenAI,
  google: callGoogle,
  xai: callXAI,
  mistral: callMistral,
  groq: callGroq,
  cohere: callCohere,
};

/**
 * Send a chat completion through the unified gateway.
 *
 * @param messages Standard chat messages.
 * @param opts Provider/model preferences, optional BYOK key, and fallback chain.
 */
export async function chat(
  messages: AIMessage[],
  opts: AIOptions = {},
): Promise<AIResponse> {
  const preferredProviders: AIProvider[] = opts.provider
    ? opts.provider === "byok"
      ? DEFAULT_FALLBACK
      : [opts.provider]
    : DEFAULT_FALLBACK;

  const fallbackChain = opts.fallback?.length
    ? opts.fallback
    : DEFAULT_FALLBACK;

  // Deduplicate while preserving order, preferring the requested provider first.
  const order = Array.from(new Set([...preferredProviders, ...fallbackChain]));

  let lastError: Error | undefined;

  for (const provider of order) {
    const key = pickKey(provider, opts.byokKey);
    if (!key) continue;

    const model = opts.model ?? DEFAULT_MODELS[provider];
    const handler = PROVIDER_HANDLERS[provider];

    try {
      return await handler(key, messages, model, opts);
    } catch (error) {
      console.error(`[AI Gateway] ${provider} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw (
    lastError ??
    new Error("No AI provider available. Check that at least one API key is configured.")
  );
}

/**
 * Check which providers are currently available.
 * Useful for onboarding "where are you coming from?" flow.
 */
export function availableProviders(): AIProvider[] {
  return DEFAULT_FALLBACK.filter((p) => providerAvailable(p));
}

/**
 * Build a BYOK-compatible request payload for the /api/conversation route.
 * This is the shape the frontend can send when a beta user has their own key.
 */
export interface ConversationRequest {
  messages: AIMessage[];
  provider?: AIProvider | "byok";
  model?: string;
  byokKey?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

/**
 * Generate a single image through the preferred image provider.
 * Currently only DALL·E and Ideogram are supported.
 */
export async function generateImage(
  prompt: string,
  opts: AIOptions = {},
): Promise<{ url: string; provider: AIProvider; model: string }> {
  const preferredProvider = opts.provider ?? "openai";
  const key = pickKey(preferredProvider as AIProvider, opts.byokKey);
  if (!key) {
    throw new Error(`No API key available for image provider ${preferredProvider}`);
  }

  if (preferredProvider === "openai") {
    const openai = new OpenAI({ apiKey: key });
    const response = await openai.images.generate({
      model: opts.model ?? "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
    });
    const url = response.data[0]?.url;
    if (!url) throw new Error("OpenAI returned no image URL");
    return { url, provider: "openai", model: opts.model ?? "dall-e-3" };
  }

  if (preferredProvider === "xai") {
    const response = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Accept-Encoding": "identity",
      },
      body: JSON.stringify({
        model: opts.model ?? "grok-imagine-image-quality",
        prompt,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`xAI image generation failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as { data?: { url?: string }[] };
    const url = data.data?.[0]?.url;
    if (!url) throw new Error("xAI returned no image URL");
    return { url, provider: "xai", model: opts.model ?? "grok-imagine-image-quality" };
  }

  throw new Error(`Image generation not supported for provider ${preferredProvider}`);
}

/**
 * Generate audio from text through the preferred TTS provider.
 * Currently only ElevenLabs is supported.
 */
export async function generateSpeech(
  text: string,
  opts: AIOptions & { voiceId?: string } = {},
): Promise<Buffer> {
  const provider = opts.provider ?? "openai";
  const key = pickKey(provider as AIProvider, opts.byokKey);
  if (!key) {
    throw new Error(`No API key available for TTS provider ${provider}`);
  }

  if (provider === "openai") {
    const openai = new OpenAI({ apiKey: key });
    const response = await openai.audio.speech.create({
      model: opts.model ?? "gpt-4o-mini-tts",
      voice: (opts.voiceId as any) ?? "nova",
      input: text,
    });
    return Buffer.from(await response.arrayBuffer());
  }

  if (provider === "xai") {
    const response = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Accept-Encoding": "identity",
      },
      body: JSON.stringify({
        text,
        voice_id: opts.voiceId ?? "eve",
        language: "en",
      }),
    });

    if (!response.ok) {
      const textErr = await response.text();
      throw new Error(`xAI TTS failed: ${response.status} ${textErr}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error(`TTS not supported for provider ${provider}`);
}

/**
 * Transcribe audio to text through the preferred STT provider.
 * Currently only Groq (Whisper) is supported.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  opts: AIOptions = {},
): Promise<string> {
  const provider = opts.provider ?? "groq";
  const key = pickKey(provider as AIProvider, opts.byokKey);
  if (!key) {
    throw new Error(`No API key available for STT provider ${provider}`);
  }

  const blob = new Blob([audioBuffer], { type: mimeType });
  const formData = new FormData();
  formData.append("file", blob, "audio.webm");
  formData.append("model", opts.model ?? "whisper-large-v3");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`STT failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { text?: string };
  return data.text ?? "";
}
