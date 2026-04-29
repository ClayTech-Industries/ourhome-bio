/**
 * Cloudflare R2 client for memory markdown persistence.
 *
 * Status: STUB. Not yet implemented — persistence is blocked on auth
 * (Day 4+) because memory keys must be scoped by owner ID.
 *
 * When implemented, this module will:
 *   - Use @aws-sdk/client-s3 against R2's S3-compatible endpoint
 *   - Write serialized markdown files to r2://ourhome-memories/{ownerId}/memories/{filename}.md
 *   - Return the R2 key so it can be indexed in Postgres
 *
 * Install when ready:
 *   npm install @aws-sdk/client-s3
 *
 * Required env vars (all optional at build time; required at runtime
 * if memory persistence is enabled):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET (defaults to "ourhome-memories")
 *
 * The module must degrade gracefully when credentials are missing so
 * local dev without R2 continues to work.
 */

import type { Companion, Memory } from "@/lib/schema";
import { memoryFilename, serializeMemory } from "./markdown";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket: process.env.R2_BUCKET ?? "ourhome-memories",
  };
}

export function memoryR2Key(ownerId: string, memory: Memory): string {
  return `${ownerId}/memories/${memoryFilename(memory)}`;
}

/**
 * Write a memory as markdown to R2. Returns the R2 key.
 *
 * NOT IMPLEMENTED — throws so callers fail loudly until this is wired.
 */
export async function writeMemoryMarkdown(
  ownerId: string,
  memory: Memory,
  companion: Companion,
): Promise<string> {
  const cfg = readR2Config();
  if (!cfg) {
    throw new Error("R2 not configured (missing R2_ACCOUNT_ID/ACCESS_KEY/SECRET).");
  }
  // Content is pre-serialized so the rest of the wiring is trivial once
  // @aws-sdk/client-s3 is installed.
  const _content = serializeMemory(memory, companion);
  void _content;
  const key = memoryR2Key(ownerId, memory);
  throw new Error(
    `R2 writer not yet implemented. Would write to r2://${cfg.bucket}/${key}. ` +
      "Install @aws-sdk/client-s3 and implement in Day 4 alongside auth.",
  );
}
