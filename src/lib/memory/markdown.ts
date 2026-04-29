/**
 * Memory <-> Markdown serialization.
 *
 * Implements the format specified in docs/MEMORY_FORMAT.md. The markdown
 * file is the canonical form; Postgres (in Sprint 1 Day 2+) will be a
 * derived index. This module is pure and runs on server or client.
 */

import type { Companion, Home, Memory } from "@/lib/schema";

/**
 * Escape a string for safe YAML single-quoted scalar.
 * YAML single-quoted scalars escape by doubling the single quote.
 */
function yamlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function yamlArray(items: string[]): string {
  if (items.length === 0) return "[]";
  return `[${items.map((i) => yamlString(i)).join(", ")}]`;
}

/**
 * Produce a safe kebab-case slug for a filename from a free-form title.
 */
export function slugify(title: string, max = 60): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, max)
    || "memory";
}

export function memoryFilename(memory: Memory): string {
  const date = memory.createdAt.slice(0, 10);
  const slug = slugify(memory.title ?? memory.body.slice(0, 60));
  return `${date}--${slug}.md`;
}

export function serializeMemory(memory: Memory, companion: Companion): string {
  const fm: string[] = [];
  fm.push(`id: ${memory.id}`);
  fm.push(`type: ${memory.type}`);
  if (memory.title) fm.push(`title: ${yamlString(memory.title)}`);
  fm.push(`created_at: ${memory.createdAt}`);
  if (memory.eventDate) fm.push(`event_date: ${memory.eventDate}`);
  fm.push(`companion:`);
  fm.push(`  name: ${yamlString(companion.name)}`);
  fm.push(`  id: ${companion.id}`);
  if (memory.roomSlug) fm.push(`room: ${memory.roomSlug}`);
  if (memory.anchorObject) fm.push(`anchor_object: ${memory.anchorObject}`);
  if (memory.position) {
    fm.push(
      `position: { x: ${memory.position.x.toFixed(3)}, y: ${memory.position.y.toFixed(3)}, z: ${memory.position.z.toFixed(3)} }`,
    );
  }
  fm.push(`emotional_valence: ${memory.emotionalValence}`);
  fm.push(`importance: ${memory.importance}`);
  fm.push(`patina: ${memory.patina}`);
  fm.push(`access_count: ${memory.accessCount}`);
  fm.push(`last_accessed: ${memory.lastAccessed}`);
  fm.push(`tags: ${yamlArray(memory.tags)}`);
  if (memory.links.length > 0) {
    fm.push(`links:`);
    for (const link of memory.links) {
      fm.push(
        `  - { target: ${yamlString(link.target)}, relationship: ${yamlString(link.relationship)}, weight: ${link.weight}, created_by: ${link.createdBy} }`,
      );
    }
  }
  fm.push(`schema_version: 1`);

  const body = memory.body.trim();
  const tagLine = memory.tags.length > 0 ? `\n\n${memory.tags.map((t) => `#${t}`).join(" ")}` : "";

  return `---\n${fm.join("\n")}\n---\n\n${body}${tagLine}\n`;
}

export function serializeHome(home: Home): string {
  const fm: string[] = [];
  fm.push(`id: ${home.id}`);
  if (home.name) fm.push(`name: ${yamlString(home.name)}`);
  fm.push(`companion:`);
  fm.push(`  name: ${yamlString(home.companion.name)}`);
  fm.push(`  pronouns: ${yamlString(home.companion.pronouns)}`);
  fm.push(`  traits: ${yamlArray(home.companion.personality.traits)}`);
  fm.push(`season: ${home.season}`);
  fm.push(`created_at: ${home.createdAt}`);
  if (home.styleProfile.colorPalette.length > 0) {
    fm.push(`color_palette: ${yamlArray(home.styleProfile.colorPalette)}`);
  }
  if (home.styleProfile.aestheticTags.length > 0) {
    fm.push(`aesthetic_tags: ${yamlArray(home.styleProfile.aestheticTags)}`);
  }
  fm.push(`schema_version: 1`);

  const body = `# ${home.name ?? "Home"}\n\nThis home is shared with [[${home.companion.name}]].\n`;
  return `---\n${fm.join("\n")}\n---\n\n${body}`;
}

export const EXPORT_README = `# OurHome Export

This folder is the complete, portable copy of a home from [OurHome.bio](https://ourhome.bio).

## What's inside

- \`home.md\` — the home itself, with its companion and style profile
- \`memories/\` — one markdown file per memory, with YAML frontmatter
- \`MEMORY_FORMAT.md\` — the format specification

## How to open it

You can open every file in any text editor. They are plain markdown.

For the best experience, point [Obsidian](https://obsidian.md) at this folder:

1. Open Obsidian
2. "Open folder as vault"
3. Choose this folder

Obsidian will render the graph of your memories, backlinks, and tags. Everything here will continue to work even if OurHome.bio one day does not.

## Format version

1 (see \`MEMORY_FORMAT.md\` for schema).
`;
