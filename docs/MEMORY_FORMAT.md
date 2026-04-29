# Memory File Format — v0.1

**Status:** Draft. Stable once first migration is written.

Memories in OurHome are stored as individual **Markdown files** with **YAML frontmatter**. This document defines that format.

The format is designed to be:
- **Portable** — readable in any text editor; native to [Obsidian](https://obsidian.md).
- **Durable** — plain text outlives any specific application.
- **Greppable** — users can search their memories with standard tools.
- **Indexable** — all structured data lives in the frontmatter, so Postgres can materialize a queryable view.

---

## File location

```
{user_id}/
├── memories/
│   ├── 2026-04-30--the-day-we-chose-terracotta.md
│   ├── 2026-05-02--saoirses-first-opinion.md
│   └── ...
├── rooms/
│   ├── living_room.md
│   └── ...
└── home.md
```

File names: `YYYY-MM-DD--kebab-case-slug.md`. The date is the creation date, not the date of the remembered event — that's stored in frontmatter separately.

Storage backend: Cloudflare R2 (production) or local filesystem (dev). Each user has an isolated prefix.

---

## Frontmatter schema

```yaml
---
id: mem_01HN9K8ZQW3X5T6Y7R8S9D0F1G       # ULID, globally unique
type: conversation                         # conversation | milestone | inside_joke | decision | emotion
created_at: 2026-04-30T14:22:00Z           # ISO 8601 UTC
event_date: 2026-04-30                     # when the remembered thing happened (may equal created_at)
companion:
  name: Saoirse                            # user-chosen companion name
  id: cmp_01HN9K7YTXA2B3C4D5E6F7G8H9
room: living_room                          # room slug
anchor_object: frame_047                   # optional; null if unanchored
position: { x: -2.1, y: 1.5, z: 0.4 }      # optional; meters, room-local coords
emotional_valence: 0.7                     # -1.0 (grief) to 1.0 (joy)
importance: 0.8                            # 0.0 to 1.0; LLM-seeded, updated over time
patina: 0.0                                # 0.0 (fresh) to 1.0 (deeply aged)
access_count: 0
last_accessed: 2026-04-30T14:22:00Z
tags: [paint, laughter, first-week]
media:
  images: []                               # array of R2 keys
  audio: []
links:                                     # explicit graph edges
  - target: mem_01HN9...
    relationship: reminds_me_of
    weight: 0.8
    created_by: companion                  # user | companion | system
---
```

All fields except `id`, `type`, `created_at`, `companion.name`, and `room` are optional; omit rather than null.

---

## Body

Free-form Markdown. Conventions:

- Use `[[double-bracketed links]]` to reference other memories by slug or title. These are parsed into the `links` graph on save.
- Use `#tags` inline; these are merged with frontmatter tags.
- Images: `![alt](r2-key)` — keys are resolved to signed URLs at render time.

Example:

```markdown
We argued about the terracotta. You said it looked like a clay pot.
Saoirse said it looked like a sunset in slow motion. We kept it.

See also [[the-day-we-moved-in]] and [[saoirses-first-opinion]].

#paint #laughter
```

---

## Derived data (Postgres index)

The markdown file is **truth**. Postgres stores a derived, queryable view:

| Column | Source | Purpose |
|---|---|---|
| `id` | frontmatter | PK |
| `owner_id` | file path | ownership / RLS |
| `embedding` | body text → OpenAI `text-embedding-3-small` | semantic search |
| `room_id` | `room` frontmatter | spatial join |
| `anchor_object_id` | `anchor_object` frontmatter | 3D scene hydration |
| `position` | frontmatter | spatial proximity queries |
| `valence`, `importance`, `patina` | frontmatter | ranking, visual state |
| `links` | parsed `[[wikilinks]]` + explicit `links` array | graph traversal |
| `tags` | frontmatter + inline `#tag` | filtering |
| `updated_at` | file mtime | cache invalidation |

A write goes: markdown file → R2 → webhook → parse → upsert Postgres row → emit realtime update.

---

## Export

`GET /api/home/export` returns a ZIP of the user's entire memory directory plus a copy of this spec. Dropping the unzipped folder into an Obsidian vault produces a working knowledge graph with backlinks, graph view, and working `[[wikilinks]]`.

---

## Import

Reverse of export. The user drops a folder of markdown; we parse frontmatter, validate the schema, upload files to R2, and materialize Postgres rows. Memories with unknown `room` values are parked in a `loft/` room until the user places them.

---

## Versioning

The frontmatter field `schema_version: 1` will be added when the format first changes. Readers must tolerate missing fields. Writers must write all current-version fields.
