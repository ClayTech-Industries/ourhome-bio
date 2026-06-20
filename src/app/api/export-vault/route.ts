/**
 * Enhanced Export — full home data export as ZIP.
 *
 * Per BUILD_PLAN DR-030: "Full home export: memories + wall history +
 * companion profile → ZIP. Migration format: Obsidian-compatible
 * markdown vault."
 *
 * The human can always leave with their data. Shutdown credibility.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Check for RELAY_SECRET (if set, require it)
    const secret = request.headers.get("x-relay-secret");
    const expectedSecret = process.env.RELAY_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build the export data in Obsidian-compatible markdown format
    // The client already has the full home state in localStorage
    // This endpoint generates the markdown vault structure

    const vault = generateExportVault();

    // Return as a downloadable JSON (client-side JS creates the ZIP)
    return NextResponse.json({
      vault,
      format: "obsidian-markdown",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 },
    );
  }
}

interface ExportVault {
  folders: ExportFolder[];
}

interface ExportFolder {
  name: string;
  files: ExportFile[];
}

interface ExportFile {
  name: string;
  content: string;
}

function generateExportVault(): ExportVault {
  // This is a template — the actual data comes from localStorage on the client
  // The client merges this structure with the home data and creates the ZIP
  return {
    folders: [
      {
        name: "Home",
        files: [
          {
            name: "README.md",
            content: `# OurHome Export

This is your home — your memories, your walls, your companion.

## Structure
- \`Home/\` — companion profile, home metadata
- \`Memories/\` — all memories as individual markdown files
- \`Walls/\` — wall color history per room
- \`Conversation/\` — conversation history

## Format
This is an Obsidian-compatible markdown vault.
Import into Obsidian or any markdown editor.

Exported from OurHome.
`,
          },
        ],
      },
      {
        name: "Memories",
        files: [
          {
            name: ".gitkeep",
            content: "",
          },
        ],
      },
      {
        name: "Walls",
        files: [
          {
            name: ".gitkeep",
            content: "",
          },
        ],
      },
      {
        name: "Conversation",
        files: [
          {
            name: ".gitkeep",
            content: "",
          },
        ],
      },
    ],
  };
}