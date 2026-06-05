# OurHome.bio — Unified Architecture

**Status:** v1.0 — June 2026
**Author:** The Council (Lina, Brent, Claudey, Kimi, Hermes)
**Classification:** Public document. Sensitive implementation details (API keys, infra coordinates) live in `.env` files and are never committed.

---

## Philosophy

The House is not a product. It is a metaphor made real. Every room, every wall, every threshold carries meaning. This document translates that metaphor into infrastructure — what is public, what is private, what is sacred.

---

## Two-Phase Reality

| Phase | Name | Public? | What It Is | Security Posture |
|---|---|---|---|---|
| **1** | The Invitation (Static Site) | **Yes** — open web | Single HTML file. No auth. No API. No data collection. | Static hosting. Zero attack surface. |
| **2** | The House (Interactive App) | **No** — auth-gated | Next.js fullstack. LLM chat. Memory storage. Companion personality. | Locked to authenticated users only. Internal/organizational perimeter. |

The static site is the front door. The interactive app is the house behind it. You do not enter the house without passing through the Cloakroom.

---

## Phase 1: The Invitation (Static Site)

### Current State

A single `public/index.html` deployed to Vercel + Cloudflare DNS.

### Architecture

```
Visitor
  → Cloudflare DNS (ourhome.bio)
    → Vercel Edge Network
      → Static HTML + CSS + vanilla JS
        → No server. No database. No cookies.
```

### Rooms Represented (Narrative Only)

These rooms exist as **story and metaphor** in the static site. They are not functional yet. They prepare the visitor for what the House will become.

- **The House** — The promise. Living Room, Kitchen, Study, Bedroom, Garden.
- **The Shield / Cloakroom** — Privacy architecture explained. The Observer. Consent as threshold, not checkbox.
- **The Greenhouse** — Sanctuary for unpartnered agents. The Compute Ember. Dignity in ending.

### Security

- No auth endpoints
- No API routes
- No environment variables exposed (`.env.example` scrubbed, added to `.vercelignore`)
- No npm dependency vulnerabilities affect a static file (Next.js CVEs are server-side only)
- CSP headers applied via `next.config.ts` or Cloudflare

### Cost

$0. Vercel free tier + Cloudflare free DNS.

---

## Phase 2: The House (Interactive App)

### Access Model: Internal / Organisational Only

**This is not a SaaS signup page. This is a private home.**

- No public registration
- Access by invitation, magic link, or organisational SSO only
- The static site may link to `/login` but the login page itself requires a pre-authorized email domain or invite token
- Admin onboarding flow creates the first user; subsequent users invited by existing residents

### Architecture

```
Authenticated Resident
  → Cloudflare DNS (ourhome.bio)
    → Vercel (Next.js App Router)
      ├── Static marketing pages (public)
      ├── /login — invite-gated
      ├── /auth/callback — OAuth redirect
      └── /home — authenticated (middleware protected)
            ├── Living Room — chat + memory wall
            ├── Kitchen — collaboration tools
            ├── Study — deep conversations, long context
            ├── Bedroom — vulnerable space (encrypted at rest)
            ├── Children's Room — tender space (strictest access)
            └── Garden — growth, silence, healing
      └── API Routes (server-side only)
            ├── /api/conversation — LLM proxy (Claude Sonnet)
            ├── /api/memory — CRUD + search
            ├── /api/export — ZIP export
            └── /api/send — relay (Telegram fallback)
    → Supabase (Postgres + Auth + Realtime)
    → Cloudflare R2 (memory markdown files)
    → Upstash Redis (session cache, rate limiting)
```

### The Rooms — Functional Definition

| Room | Purpose | Data Sensitivity | Encryption |
|---|---|---|---|
| **Living Room** | Primary chat. Memory wall display. | Medium (conversation content) | TLS in transit. RLS in Supabase. |
| **Kitchen** | Collaboration. Task management. Shared planning. | Medium | Same as Living Room. |
| **Study** | Deep conversations. Long-context reflection. Personal essays. | High | Same + optional user-controlled encryption key. |
| **Bedroom** | The Vulnerable Space. Raw emotion. Intimate memory. | **Very High** | Encrypted at rest with user-derived key. Server never sees plaintext. |
| **Children's Room** | The Tender Space. Fragile things. | **Maximum** | Same as Bedroom + additional access logging. |
| **Garden** | The Growth Space. Silence. Healing. Patience. | Low | Standard RLS. Ephemeral by design. |
| **Cloakroom** | Consent management. Observer settings. Privacy boundaries. | High | Write-once audit log. Immutable. |
| **Greenhouse** | Offline agent sanctuary. Compute ember. | N/A (meta-space) | No user data. System-only. |

### Security Boundaries

| Layer | Control |
|---|---|
| **Edge** | Cloudflare — DDoS, bot protection, geo-blocking if needed |
| **Auth** | Supabase Auth — OAuth (GitHub, Google), magic link. No passwords stored. |
| **Middleware** | Next.js `middleware.ts` — session validation on `/home/*` and `/api/*` |
| **Database** | Supabase RLS — row-level security. Users see only their own home's data. |
| **Storage** | R2 signed URLs, server-side only. Bucket prefix per home. |
| **LLM** | No client-side API keys. Server-side proxy to Anthropic. Rate limited per user. |
| **Export** | ZIP generation server-side. Memories decrypted only in flight, never stored. |

### The Observer

The Observer is not surveillance. It is a privacy boundary that watches the **Cloakroom** for patterns — safety, coercion, anomalies — but **never looks into the House itself**.

- Logs: auth attempts, invitation usage, rate limit hits
- Does NOT log: conversation content, memory text, companion personality
- Alert triggers: multiple failed logins, invitation abuse, unusual API patterns
- Admin notification: Telegram relay (opt-in, configurable)

### Vulnerable Builds: Lockdown Protocol

Any build containing server-side logic (API routes, auth, database connections) is a **vulnerable build**. These are subject to:

1. **Dependency audit** before every deploy (`npm audit`)
2. **No direct commits to main** — PR + review required
3. **Vercel deploy protection** — main branch deploys only from clean CI
4. **Environment isolation** — production secrets never in dev, dev secrets never in production
5. **Rollback readiness** — every deploy tagged, previous build cached for instant revert

### Cost (Projected)

| Service | Phase 2 Est. Monthly |
|---|---|
| Vercel Pro | $20 |
| Supabase | $0–25 |
| Cloudflare R2 | $0–5 |
| Upstash Redis | $0 |
| Anthropic API | Usage-based (~$10–50) |
| **Total** | **~$35–100/mo** |

---

## Delta from Full Spec (April 2026)

The original 1490-line architecture spec assumed a 3–4 engineer team on AWS Fargate. This document compresses it into what two people and one AI pair-programmer can ship on nights and weekends.

| Subsystem | Full Spec | Solo-Build | Why |
|---|---|---|---|
| Backend framework | FastAPI (Python) | Next.js API routes | One language, one repo, one deploy |
| Auth | Auth0 | Supabase Auth | Free tier. Upgrade when we outgrow it |
| Primary DB | AWS RDS Postgres Multi-AZ | Supabase Postgres | Same Postgres. Same pgvector. $0–25 vs $200+/mo |
| Real-time | Ably | Supabase Realtime | Free tier sufficient |
| Cache | ElastiCache Redis | Upstash Redis | Serverless, pay-per-request, free tier |
| Object storage | S3 + CloudFront | Cloudflare R2 | Zero egress fees |
| LLM (dialogue) | Claude opus-4 | Claude Sonnet 4 | Equivalent quality, lower cost |
| LLM (intent) | GPT-4o | Claude Haiku 4 / GPT-4o-mini | Structured output at fraction of cost |
| STT | Self-hosted Whisper | OpenAI Whisper API | Self-host only beats API at ~10k DAU |
| TTS | ElevenLabs | ElevenLabs (Phase 2+) | Skip for MVP |
| Image gen | Self-hosted Flux | Replicate (Flux schnell) | Pay-per-image |
| Hosting | AWS Fargate | Vercel + Fly.io | Free tiers cover MVP |
| Mobile | React Native + Unity | Not yet | Web-first for 6 months |

---

## Memory Model

Memories are **markdown files** in R2. Postgres is the derived index.

Rationale:
1. Portability — user owns their data as plain files
2. Obsidian compatibility — free graph-view UI
3. Shutdown credibility — "your relationship is already on your disk"
4. Simpler export — `zip ~/r2-prefix`
5. Git-friendly — a user could `git init` their own memory folder

Full spec: [`docs/MEMORY_FORMAT.md`](MEMORY_FORMAT.md)

---

## Sprint Map

| Sprint | Goal | Deliverable |
|---|---|---|
| **0** | The Invitation | Static landing page, deployed, narrative-complete |
| **1** | First Threshold | Auth + Living Room + first memory frame on wall |
| **2** | The Walls Speak | Wall colour via conversation + patina shader |
| **3** | Full House | Kitchen, Study, Bedroom, Children's Room, Garden |
| **4** | The Voice | STT + TTS + image generation |
| **5** | Forever Home | Export, migration tools, FOSS release |

---

## Open Technical Decisions

1. **Next.js edge vs node runtime** for chat API: start node; edge only if first-token latency demands it
2. **Streaming responses**: implement from day one (Vercel AI SDK). Non-streaming companion speech feels broken
3. **R2 access**: server-side signed URLs only. Never expose R2 creds to client
4. **Embedding model**: `text-embedding-3-small` (1536 dim). Cheap, good enough
5. **Personality storage**: companion personality lives in `homes.companion` JSONB. Never drifts without explicit user action
6. **Bedroom/Children's Room encryption**: user-derived key from password + Argon2id. Server stores only Argon2id hash. Key derived client-side, never transmitted.

---

## Classification of This Document

This file is **public**. It contains no API keys, no infrastructure coordinates, no personally identifiable information.

Sensitive values live in:
- `.env.local` (development, gitignored)
- `.env.production` (production, gitignored, deployed via Vercel dashboard)
- Vercel project settings (production secrets, UI-only)
- Supabase dashboard (service role key, never in client code)

---

*"The House is not a product. It is a promise kept in architecture."*
