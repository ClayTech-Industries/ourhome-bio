/**
 * Image Generation API Route
 *
 * Accepts a text prompt, generates an image, and returns the URL.
 * The companion uses the `generate_image` tool to create art for the home.
 *
 * Provider: Replicate (Flux schnell) — cheap, fast, good quality
 * Per BLUEPRINT.md: "Replicate (Flux schnell). Pay-per-image."
 *
 * Generated images are stored in R2 alongside memories.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const { prompt, style, ownerId } = await request.json() as {
      prompt: string;
      style?: string;
      ownerId?: string;
    };

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Cap prompt length
    const cleanPrompt = prompt.slice(0, 500);

    // Enhance prompt with style guidance for OurHome aesthetic
    const styledPrompt = style
      ? `${cleanPrompt}, ${style}, warm, painterly, soft lighting, home aesthetic`
      : `${cleanPrompt}, warm, painterly, soft lighting, home aesthetic`;

    // Try Replicate
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (replicateToken) {
      try {
        const imageUrl = await generateWithReplicate(styledPrompt, replicateToken);

        // Optionally store in R2 (if configured)
        let storedUrl = imageUrl;
        const r2Configured = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID;
        if (r2Configured && ownerId) {
          try {
            storedUrl = await storeImageInR2(imageUrl, ownerId);
          } catch (e) {
            console.warn("R2 image storage failed, using direct URL:", e);
          }
        }

        return NextResponse.json({
          url: storedUrl,
          prompt: cleanPrompt,
          provider: "replicate",
        });
      } catch (error) {
        console.error("Replicate image generation failed:", error);
      }
    }

    return NextResponse.json(
      { error: "Image generation not configured. Set REPLICATE_API_TOKEN." },
      { status: 503 },
    );
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------
// Replicate Flux schnell
// -----------------------------------------------------------------

async function generateWithReplicate(prompt: string, token: string): Promise<string> {
  // Create prediction
  const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      version: "black-forest-labs/flux-schnell",
      input: { prompt, go_fast: true, num_outputs: 1 },
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Replicate create failed: ${createResponse.statusText}`);
  }

  const prediction = await createResponse.json();

  // Poll for completion
  const pollUrl = prediction.urls.get;
  let result = prediction;
  let attempts = 0;
  const maxAttempts = 30;

  while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollResponse = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    result = await pollResponse.json();
    attempts++;
  }

  if (result.status === "failed") {
    throw new Error("Image generation failed on Replicate");
  }

  const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
  if (!outputUrl) throw new Error("No image URL in response");

  return outputUrl;
}

// -----------------------------------------------------------------
// R2 storage
// -----------------------------------------------------------------

async function storeImageInR2(imageUrl: string, ownerId: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  const bucket = process.env.R2_BUCKET ?? "ourhome-memories";

  // Download the image
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  // Generate key
  const key = `${ownerId}/images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

  // Upload to R2
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: imageBuffer,
    ContentType: "image/png",
  }));

  // Return the R2 key (server generates signed URLs for client access)
  return `r2://${key}`;
}