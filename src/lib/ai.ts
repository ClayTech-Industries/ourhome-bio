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

// Provider ordering for automatic fallback when no preference is given.
const DEFAULT_FALLBACK: AIProvider[] = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "mistral",
  "groq",
  "cohere",
];

const HOUSE_KEYS: Record<AIProvider, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  google: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  xai: process.env.XAI_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
  groq: process.env.GROQ_API_KEY,
  cohere: process.env.COHERE_API_KEY,
};

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-5",
  google: "gemini-2.5-flash",
  xai: "grok-3",
  mistral: "mistral-large-latest",
  groq: "llama-3.3-70b-versatile",
  cohere: "command-r-plus",
};

function pickKey(provider: AIProvider, byokKey?: string): string | undefined {
  if (byokKey) return byokKey;
  return HOUSE_KEYS[provider];
}

function providerAvailable(provider: AIProvider, byokKey?: string): boolean {
  return !!pickKey(provider, byokKey);
}

async function callAnthropic(
  key: string,
  messages: AIMessage[],
  model: string,
  opts: AIOptions,
): Promise<AIResponse> {
  const client = new Anthropic({ apiKey: key });
  const system = messages.filter((m) => m.role === "system").map((m) => m.content);
  const conversation = messages.filter((m) => m.role !== "system");

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    system: system.length > 0 ? system.join("\n\n") : undefined,
    messages: conversation.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const content =
    typeof response.content[0] === "object" && "text" in response.content[0]
      ? (response.content[0] as { text: string }).text
      : "";

  return {
    id: response.id ?? randomUUID(),
    provider: "anthropic",
    model,
    content,
    usage: {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      totalTokens:
        (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
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
  const client = new OpenAI({ apiKey: key, baseURL });

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

  const chat = genModel.startChat({
    history,
    systemInstruction: system || undefined,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 1024,
    },
  });

  const lastUser = conversation.filter((m) => m.role === "user").pop();
  const result = await chat.sendMessage(lastUser?.content ?? "");
  const response = await result.response;

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
    id: randomUUID(),
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

  return {
    id: response.id ?? randomUUID(),
    provider: "groq",
    model,
    content: response.choices[0]?.message?.content ?? "",
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

  // Cohere v2 uses a simpler message shape.
  const response = await client.chat({
    model,
    message: messages.filter((m) => m.role === "user").pop()?.content ?? "",
    preamble: messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n"),
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
}
