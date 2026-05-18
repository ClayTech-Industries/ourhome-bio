/**
 * Provider-agnostic LLM abstraction.
 *
 * This module defines a unified interface for LLM providers, allowing
 * OurHome to swap between Claude, OpenAI, Ollama, xAI, etc. without
 * rewriting the memory engine or streaming pipeline.
 */

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { streamText, generateText } from "ai";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface LLMConfig {
  provider: "anthropic" | "openai" | "ollama" | "custom";
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface StreamCallback {
  onChunk?: (chunk: string) => void;
  onToolCall?: (toolName: string, args: unknown) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface LLMResponse {
  text: string;
  toolCalls: Array<{ name: string; args: unknown }>;
  usage?: { promptTokens: number; completionTokens: number };
}

// -----------------------------------------------------------------
// Provider Registry
// -----------------------------------------------------------------

function getProvider(config: LLMConfig) {
  switch (config.provider) {
    case "anthropic":
      return {
        client: anthropic,
        defaultModel: config.model || "claude-sonnet-4-20250514",
      };
    case "openai":
      return {
        client: openai,
        defaultModel: config.model || "gpt-4o-mini",
      };
    case "ollama":
      return {
        client: openai,
        defaultModel: config.model || "llama3.1",
      };
    case "custom":
      return {
        client: openai,
        defaultModel: config.model || "custom-model",
      };
    default:
      throw new Error(`Unknown provider: ${(config as LLMConfig).provider}`);
  }
}

// -----------------------------------------------------------------
// LLM Provider Interface
// -----------------------------------------------------------------

export class LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Stream a chat completion with tool calling support.
   */
  async streamChat(options: {
    messages: any[];
    tools?: Record<string, any>;
    system?: string;
    callbacks?: StreamCallback;
  }): Promise<AsyncIterable<string>> {
    const { messages, tools, system, callbacks } = options;
    const { client, defaultModel } = getProvider(this.config);

    const result = streamText({
      model: client(defaultModel),
      messages,
      system: system,
      tools,
      onChunk: callbacks?.onChunk
        ? ({ chunk }) => {
            if (chunk.type === "text-delta") {
              callbacks.onChunk?.(chunk.text);
            }
          }
        : undefined,
    });

    return result.textStream;
  }

  /**
   * Generate a non-streaming response with tool calling.
   */
  async generate(options: {
    messages: any[];
    tools?: Record<string, any>;
    system?: string;
  }): Promise<LLMResponse> {
    const { messages, tools, system } = options;
    const { client, defaultModel } = getProvider(this.config);

    const result = await generateText({
      model: client(defaultModel),
      messages,
      system: system,
      tools,
    });

    const toolCalls = (result.toolCalls || []).map((tc: any) => ({
      name: tc.toolName,
      args: tc.args,
    }));

    return {
      text: result.text,
      toolCalls,
      usage: {
        promptTokens: (result.usage as any).promptTokens || 0,
        completionTokens: (result.usage as any).completionTokens || 0,
      },
    };
  }

  /**
   * Generate embeddings for semantic search.
   * Uses OpenAI's embedding API (best cost/quality ratio).
   */
  async embed(text: string): Promise<number[]> {
    // Direct OpenAI API call for embeddings
    const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY or LLM_API_KEY required for embeddings");
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}

// -----------------------------------------------------------------
// Default Provider Instance
// -----------------------------------------------------------------

export function createDefaultProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "anthropic";
  const model = process.env.LLM_MODEL;
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;

  return new LLMProvider({
    provider: provider as LLMConfig["provider"],
    model,
    apiKey,
    baseUrl,
  });
}
