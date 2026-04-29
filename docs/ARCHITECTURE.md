# Architecture — Solo-Build Profile

**Status:** v0.1 — April 2026

This document is the **implementation-shaped subset** of the full 1490-line architecture specification written by Lina. The full spec assumes a 3–4 engineer team on AWS Fargate. This document compresses it into what two people and one AI pair-programmer can actually ship on nights and weekends.

The full spec is authoritative for design intent. This doc is authoritative for what goes into the repo today.

---

## Deltas from the full spec

| Subsystem | Full spec | Solo-build | Why |
|---|---|---|---|
| Backend framework | FastAPI (Python) | Next.js API routes / Route Handlers | One language, one repo, one deploy. Add Python service when memory engine demands it. |
| Auth | Auth0 | Supabase Auth (or Clerk) | Free tier. Upgrade when we outgrow it. |
| Primary DB | AWS RDS Postgres Multi-AZ | Supabase Postgres (or Neon) | Same Postgres. Same pgvector. $0-25/mo vs $200+/mo. |
| Real-time | Ably | Supabase Realtime (Phase 1 polling is fine) | Free tier sufficient. |
| Cache | ElastiCache Redis | Upstash Redis (serverless, pay-per-request) | $0 free tier. |
| Object storage | S3 + CloudFront | Cloudflare R2 | Zero egress fees. R2 is where memories live as markdown. |
| LLM (dialogue) | Claude opus-4 | Claude Sonnet 4 | Equivalent quality; lower cost per turn. |
| LLM (intent parsing) | GPT-4o | Claude Haiku 4 (or GPT-4o-mini) | Haiku is fine for structured output at a fraction of the cost. |
| STT | Self-hosted Whisper on ECS | OpenAI Whisper API | Self-hosting only beats API cost at ~10k DAU. |
| TTS | ElevenLabs | ElevenLabs (Phase 2) | Agree; skip for MVP. |
| Image generation | Self-hosted Flux on g5.2xlarge | Replicate (Flux schnell) | Pay-per-image, migrate to self-host when math demands. |
| Hosting | AWS Fargate | Vercel (web) + Fly.io (any Python worker, if needed) | Free tiers cover MVP. |
| Mobile | React Native + Unity | Not yet | Web-first for 6 months. |
| Memory graph | Neo4j Aura → pgvector | pgvector + JSONB indefinitely | Delay graph-DB migration until traversal patterns justify it. |

**Effective MVP infra cost: ~$0–50/month** instead of $500–1000/month.

---

## Memory model — materially different from the full spec

The full spec proposes memories as rows in Postgres. We store them as **markdown files** in R2 with Postgres as a derived index.

Rationale documented in [`docs/MEMORY_FORMAT.md`](MEMORY_FORMAT.md). Key benefits:

1. Portability (user owns their data as plain files).
2. Obsidian compatibility (free graph-view UI, free evangelism from the Obsidian community).
3. Shutdown credibility ("your relationship is already on your disk").
4. Simpler export (`zip ~/r2-prefix`).
5. Git-friendly (a user could `git init` their own memory folder and version it themselves).

---

## Repository structure

```
ourhome-bio/
├── src/
│   ├── app/
│   │   ├── (marketing)/            Public pages (splash, pricing, manifesto)
│   │   ├── (home)/                 Authenticated home experience
│   │   │   ├── living-room/
│   │   │   ├── chat/
│   │   │   └── memory/
│   │   ├── api/
│   │   │   ├── conversation/       Claude dialogue endpoint
│   │   │   ├── memory/             CRUD + search
│   │   │   └── export/             ZIP export endpoint
│   │   └── layout.tsx
│   ├── components/
│   │   ├── scene/                  R3F scenes (LivingRoom, MemoryWall, Frame)
│   │   ├── chat/                   Conversation UI
│   │   └── ui/                     Generic UI primitives
│   ├── lib/
│   │   ├── db/                     Supabase client, query helpers
│   │   ├── llm/                    Claude client, prompt builders, intent parser
│   │   ├── memory/                 Markdown parser, R2 client, indexer
│   │   └── companion/              Companion type, personality, name resolution
│   └── styles/
├── docs/
│   ├── ARCHITECTURE.md             this file
│   └── MEMORY_FORMAT.md            markdown memory spec
├── PRODUCT_BRIEF.md                business model, moat, wedge, FOSS
└── README.md
```

---

## Sprint 1 scope

**Goal:** Log in, talk to your companion in the Living Room, watch the first memory frame appear on the wall.

1. Next.js 15 scaffold ✅ (done in initial commit)
2. Supabase project: `homes`, `rooms`, `memories`, `memory_objects` tables (subset of full schema)
3. Auth: Supabase Auth (magic-link email)
4. R3F Living Room scene: four walls, floor, soft directional light, one wall as the Memory Wall
5. Chat UI → Claude Sonnet → companion response
6. Tool-calling: Claude decides when to capture a memory; memory written as markdown to R2; indexed in Postgres
7. Memory frame appears on wall with bloom-in animation
8. Click frame → camera dolly + companion recalls
9. Onboarding: name your companion, name your home, first wall colour
10. Deploy to Vercel at staging URL

**Out of scope for Sprint 1:** voice, other rooms, wall-colour-via-chat, image generation, patina, export endpoint (schema prepared, endpoint in Sprint 2), mobile.

---

## Sprint 2 scope (placeholder)

- Wall colour via conversation (the flagship full-spec feature)
- Patina shader on aged frames
- Export endpoint (working markdown ZIP)
- Public marketing site

---

## Open technical decisions

- **Next.js edge vs node runtime** for chat API: start node; edge only if first-token latency demands it.
- **Streaming responses**: implement from day one (SSE via Vercel AI SDK or native `ReadableStream`). Non-streaming companion speech feels instantly broken.
- **R2 access**: server-side signed URLs only; never expose R2 creds to client.
- **Embedding model**: `text-embedding-3-small` (1536 dim) per full spec. Cheap, good enough.
- **Personality storage**: companion personality lives in `homes.companion` JSONB column (name, pronouns, traits[], voice_id). Never drifts without explicit user action.
