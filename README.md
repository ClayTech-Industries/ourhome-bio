# OurHome.bio

> **It Holds Time.**
>
> A home you build with an AI companion. Not a chat window — a place.

---

## What this is

Most AI companion products are chat interfaces. OurHome is a **spatial relationship environment**: a painterly, persistent digital home that you and an AI companion inhabit together. Memories anchor to rooms and objects. Walls age. The Memory Wall fills. Over time, the home becomes irreplaceable.

This is the premise from the pitch deck (*It Holds Time*). This repository is the implementation.

## Status

**Pre-alpha.** Sprint 1 in progress. Goal: a user can have a real conversation with their companion in one Living Room and watch the first memory frame appear on the Memory Wall.

## Stack

- **Next.js 15** (App Router, TypeScript, Tailwind)
- **Three.js / React Three Fiber** — rendering layer
- **Supabase** — Postgres + pgvector + Auth + Storage
- **Anthropic Claude** — companion LLM (Sonnet for dialogue, Haiku for intent parsing)
- **Cloudflare R2** — markdown memory storage (zero-egress)
- **Vercel** — hosting

## Memory model

Memories are **markdown files** — one per memory, with YAML frontmatter. Stored in R2, indexed in Postgres (pgvector for semantic search, JSONB for graph links). Inspired by the [Method of Loci (Memory Palace)](https://en.wikipedia.org/wiki/Method_of_loci) and [Obsidian](https://obsidian.md). Users can export the entire home as a folder of markdown that opens natively in Obsidian. See [\docs/MEMORY_FORMAT.md\](docs/MEMORY_FORMAT.md).

## The companion

The companion has no default name. Users name their companion during onboarding. The code refers to \Companion\ as a type; user-chosen names are stored per-home. Personality traits are locked after onboarding and edited only through explicit flows — never via drift.

## Repository layout

\ourhome-bio/
├── src/app/                    Next.js app routes
├── src/components/             React components (UI + R3F scenes)
├── src/lib/                    Server utilities, DB, LLM, memory engine
├── docs/
│   ├── MEMORY_FORMAT.md        Markdown memory file specification
│   └── ARCHITECTURE.md         Solo-build architecture (compressed from full spec)
├── PRODUCT_BRIEF.md            Business model, moat, wedge user, FOSS posture
└── README.md
\
## Governance

**Open community, controlled core.** The renderer and schema will be split into public repositories when the seams are stable. Companion behaviour, memory policy, and children's-room guardrails remain private until a safety advisor is engaged.

## License

Private during pre-alpha. License decision deferred; the memory export format (markdown + YAML) will be published openly regardless of repo license so user data is always portable.

## Getting started

\\ash
npm install
cp .env.example .env.local   # fill in keys
npm run dev
\
Open http://localhost:3000.

## Built by

Lina & Brent, with [Claudey](https://claude.ai) as the third pair-programmer.
