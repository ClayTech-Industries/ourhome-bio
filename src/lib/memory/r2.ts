/**
 * Cloudflare R2 client for memory markdown persistence.
 *
 * Uses @aws-sdk/client-s3 against R2's S3-compatible endpoint.
 * Memories are stored as: r2://ourhome-memories/{ownerId}/memories/{filename}.md
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Companion, Memory } from "@/lib/schema";
import { memoryFilename, serializeMemory } from "./markdown";

// -----------------------------------------------------------------
// R2 Configuration
// -----------------------------------------------------------------

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

function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

// -----------------------------------------------------------------
// R2 Key Helpers
// -----------------------------------------------------------------

export function memoryR2Key(ownerId: string, memory: Memory): string {
  return `${ownerId}/memories/${memoryFilename(memory)}`;
}

export function homeR2Key(ownerId: string): string {
  return `${ownerId}/home.md`;
}

// -----------------------------------------------------------------
// Memory Operations
// -----------------------------------------------------------------

/**
 * Write a memory as markdown to R2. Returns the R2 key.
 */
export async function writeMemoryMarkdown(
  ownerId: string,
  memory: Memory,
  companion: Companion,
): Promise<string> {
  const cfg = readR2Config();
  if (!cfg) {
    throw new Error("R2 not configured (missing R2_ACCOUNT_ID/ACCESS_KEY/SECRET)");
  }

  const content = serializeMemory(memory, companion);
  const key = memoryR2Key(ownerId, memory);

  const client = createR2Client(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: content,
      ContentType: "text/markdown",
    }),
  );

  return key;
}

/**
 * Read a memory markdown file from R2.
 */
export async function readMemoryMarkdown(
  ownerId: string,
  memory: Memory,
): Promise<string> {
  const cfg = readR2Config();
  if (!cfg) {
    throw new Error("R2 not configured");
  }

  const key = memoryR2Key(ownerId, memory);
  const client = createR2Client(cfg);

  const response = await client.send(
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
    }),
  );

  const body = response.Body as any;
  if (!body) {
    throw new Error(`Memory not found: ${key}`);
  }

  return await body.transformToString();
}

/**
 * Write home configuration to R2.
 */
export async function writeHomeMarkdown(
  ownerId: string,
  homeMd: string,
): Promise<string> {
  const cfg = readR2Config();
  if (!cfg) {
    throw new Error("R2 not configured");
  }

  const key = homeR2Key(ownerId);
  const client = createR2Client(cfg);

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: homeMd,
      ContentType: "text/markdown",
    }),
  );

  return key;
}
