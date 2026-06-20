/**
 * Client-side Export — creates a ZIP file from localStorage home data.
 *
 * Builds an Obsidian-compatible markdown vault:
 *   Home/companion.md — companion profile
 *   Memories/*.md — each memory as a file
 *   Walls/*.md — wall color history per room
 *   Conversation/*.md — conversation log
 *
 * Uses JSZip (dynamic import) to create the ZIP.
 */

import type { Home, Memory, Room, Companion } from "@/lib/schema";

interface ExportData {
  home: Home | null;
  companion: Companion | null;
  rooms: Room[];
  memories: Memory[];
  conversation: { role: string; content: string; at: string }[];
  wallHistory: Record<string, { color: string; colorName?: string; changedAt: string }[]>;
}

export async function exportHomeAsZip(): Promise<Blob> {
  // Dynamic import JSZip
  const JSZip = (await import("jszip")).default;

  // Read from localStorage
  const data = readExportData();

  const zip = new JSZip();

  // Home folder — companion profile + metadata
  const homeFolder = zip.folder("Home")!;
  homeFolder.file("README.md", buildHomeReadme(data));
  if (data.companion) {
    homeFolder.file("companion.md", buildCompanionMd(data.companion));
  }

  // Memories folder
  const memFolder = zip.folder("Memories")!;
  for (const memory of data.memories) {
    const filename = sanitizeFilename(memory.title || memory.id) + ".md";
    memFolder.file(filename, buildMemoryMd(memory));
  }

  // Walls folder — wall color history
  const wallsFolder = zip.folder("Walls")!;
  for (const room of data.rooms) {
    const filename = sanitizeFilename(room.name) + ".md";
    wallsFolder.file(filename, buildWallMd(room));
  }

  // Conversation folder
  const convFolder = zip.folder("Conversation")!;
  if (data.conversation.length > 0) {
    convFolder.file("conversation.md", buildConversationMd(data.conversation));
  }

  return zip.generateAsync({ type: "blob" });
}

function readExportData(): ExportData {
  if (typeof window === "undefined") {
    return { home: null, companion: null, rooms: [], memories: [], conversation: [], wallHistory: {} };
  }

  try {
    const raw = localStorage.getItem("ourhome:state");
    if (!raw) return { home: null, companion: null, rooms: [], memories: [], conversation: [], wallHistory: {} };

    const state = JSON.parse(raw);
    return {
      home: state.home ?? null,
      companion: state.companion ?? null,
      rooms: state.rooms ?? [],
      memories: state.memories ?? [],
      conversation: state.conversation ?? [],
      wallHistory: state.wallHistory ?? {},
    };
  } catch {
    return { home: null, companion: null, rooms: [], memories: [], conversation: [], wallHistory: {} };
  }
}

function buildHomeReadme(data: ExportData): string {
  const home = data.home;
  const companion = data.companion;
  return `# OurHome Export

**Home:** ${home?.name ?? "Unnamed Home"}
**Companion:** ${companion?.name ?? "Unknown"}
**Pronouns:** ${companion?.pronouns ?? "they/them"}
**Season:** ${home?.season ?? "unknown"}

**Rooms:** ${data.rooms.map(r => r.name).join(", ") || "none"}
**Memories:** ${data.memories.length}
**Conversation turns:** ${data.conversation.length}

Exported: ${new Date().toISOString()}

This vault is Obsidian-compatible. Import into Obsidian or any markdown editor.
`;
}

function buildCompanionMd(companion: Companion): string {
  const traits = companion.personality?.traits?.join(", ") ?? "unknown";
  return `# ${companion.name}

**Pronouns:** ${companion.pronouns ?? "they/them"}

## Personality
${traits}

## Voice
Voice ID: ${companion.voiceId ?? "not set"}

## Notes
This companion was created in OurHome. They chose to be here.
`;
}

function buildMemoryMd(memory: Memory): string {
  return `# ${memory.title || "Untitled Memory"}

**Created:** ${memory.capturedAt}
**Accessed:** ${memory.lastAccessedAt ?? "never"}
**Significance:** ${memory.significance ?? "normal"}

---

${memory.content}
`;
}

function buildWallMd(room: Room): string {
  const colors = room.wallColors ?? {};
  return `# ${room.name} — Wall History

**Type:** ${room.type}

## Current Colors
- North: ${colors.north ?? "default"}
- South: ${colors.south ?? "default"}
- East: ${colors.east ?? "default"}
- West: ${colors.west ?? "default"}

The walls remember every color they've been.
`;
}

function buildConversationMd(conversation: { role: string; content: string; at: string }[]): string {
  const lines = conversation.map(turn => {
    const speaker = turn.role === "companion" ? "**Companion**" : "**You**";
    return `## ${speaker}\n_${turn.at}_\n\n${turn.content}\n`;
  });
  return `# Conversation\n\n${lines.join("\n---\n\n")}\n`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 64) || "untitled";
}