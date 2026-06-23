/**
 * Provider-agnostic LLM abstraction.
 *
 * This module defines a unified interface for LLM providers, allowing
 * OurHome to swap between Claude, OpenAI, Ollama, xAI, etc. without
 * rewriting the memory engine or streaming pipeline.
 *
 * Architecture (per BUILD_PLAN Priority 2):
 *   - General chat: AI SDK v6 (provider-agnostic, swappable)
 *   - Cloakroom/Observer: Direct API (transparent, no abstraction)
 *   - The Router decides which path; for Sprint 1 we go straight through
 */

import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, generateText, type LanguageModel } from "ai";

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

export interface ResolvedProvider {
  client: (modelId: string, options?: Record<string, unknown>) => LanguageModel;
  defaultModel: string;
}

// -----------------------------------------------------------------
// Provider Registry
// -----------------------------------------------------------------

function getProvider(config: LLMConfig): ResolvedProvider {
  switch (config.provider) {
    case "anthropic":
      return {
        client: anthropic as unknown as ReturnType<typeof createOpenAI>,
        defaultModel: config.model || "claude-sonnet-4-5-20250929",
      };
    case "openai": {
      const openaiClient = createOpenAI();
      return {
        client: openaiClient,
        defaultModel: config.model || "gpt-4o-mini",
      };
    }
    case "ollama": {
      // Ollama exposes an OpenAI-compatible API at the configured base URL
      const ollamaBaseUrl = config.baseUrl || process.env.LLM_BASE_URL || "http://localhost:11434/v1";
      const ollama = createOpenAI({ baseURL: ollamaBaseUrl });
      return {
        client: ollama,
        defaultModel: config.model || "llama3.1",
      };
    }
    case "custom": {
      const customBaseUrl = config.baseUrl || process.env.LLM_BASE_URL;
      if (!customBaseUrl) throw new Error("LLM_BASE_URL required for custom provider");
      const custom = createOpenAI({ baseURL: customBaseUrl });
      return {
        client: custom,
        defaultModel: config.model || "custom-model",
      };
    }
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
   * Resolve the provider to get direct access to the AI SDK model factory
   * and default model name. Used by route handlers that need fine-grained
   * control over streaming (SSE events, presence states, tool calls).
   */
  resolveProvider(): ResolvedProvider {
    return getProvider(this.config);
  }

  /**
   * Stream a chat completion with tool calling support.
   * Legacy API — prefer using resolveProvider() + streamText() directly
   * for full control over SSE event formatting.
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