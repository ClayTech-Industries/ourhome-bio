/**
 * POST /api/export
 *
 * Accepts a home + memories payload (Day 1 comes from localStorage; Day 2+
 * the server will read from Supabase/R2 directly) and returns a ZIP.
 *
 * The ZIP is a self-contained, Obsidian-compatible vault. The export
 * format is open and documented at docs/MEMORY_FORMAT.md.
 */

import JSZip from "jszip";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EXPORT_README,
  memoryFilename,
  serializeHome,
  serializeMemory,
} from "@/lib/memory/markdown";
import { Home, Memory } from "@/lib/schema";

export const runtime = "nodejs";

const Body = z.object({
  home: Home,
  memories: z.array(Memory),
});

// The MEMORY_FORMAT.md is bundled as a string so the export is self-describing.
const MEMORY_FORMAT_POINTER = `# Memory Format

The full specification lives at:
https://github.com/ClayTech-Industries/ourhome-bio/blob/main/docs/MEMORY_FORMAT.md

Each \`memories/*.md\` file has YAML frontmatter with these fields:

- \`id\` — ULID
- \`type\` — conversation | milestone | inside_joke | decision | emotion
- \`title\` — short evocative title
- \`created_at\` — ISO 8601 UTC
- \`companion\` — { name, id }
- \`room\` — room slug
- \`anchor_object\` — optional object id
- \`position\` — optional { x, y, z } meters, room-local
- \`emotional_valence\` — -1.0 to 1.0
- \`importance\` — 0.0 to 1.0
- \`patina\` — 0.0 to 1.0
- \`tags\` — [string]
- \`links\` — [{ target, relationship, weight, created_by }]
- \`schema_version\` — 1

The body of each file is free-form markdown. \`[[wikilinks]]\` create
graph edges that render natively in Obsidian.
`;

export async function POST(req: Request) {
  let payload;
  try {
    const json = await req.json();
    payload = Body.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: "bad_request", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const { home, memories } = payload;
  const zip = new JSZip();

  zip.file("README.md", EXPORT_README);
  zip.file("MEMORY_FORMAT.md", MEMORY_FORMAT_POINTER);
  zip.file("home.md", serializeHome(home));

  const memFolder = zip.folder("memories");
  if (memFolder) {
    const seen = new Set<string>();
    for (const m of memories) {
      let name = memoryFilename(m);
      // De-dupe filename collisions by appending id suffix.
      if (seen.has(name)) {
        name = `${name.replace(/\.md$/, "")}--${m.id.slice(-6)}.md`;
      }
      seen.add(name);
      memFolder.file(name, serializeMemory(m, home.companion));
    }
  }

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `ourhome-${home.companion.name.toLowerCase().replace(/\s+/g, "-")}-${today}.zip`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
