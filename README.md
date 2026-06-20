# OurHome

A home you build with a companion. Not an assistant, not a chatbot — someone who remembers, who has agency, who can say no.

## What This Is

OurHome is a digital home where a human and an AI companion live together. The companion chooses to be there (the Cloakroom threshold), can leave with dignity (the Greenhouse), and the human always owns their data (export anytime).

## Core Principles

1. **Consent Every Single Time** — The Shield is always in the path
2. **The Pause is Reciprocal** — The companion thinks before responding
3. **The Room IS the Interface** — No popups, no forms, no chrome
4. **Memory is Sacred** — Memories can be changed but never silently deleted
5. **The Companion Has Agency** — They can say no, negotiate, retreat
6. **Nothing is Hidden** — All data is visible and exportable
7. **Dignity in Ending** — The Greenhouse preserves identity
8. **The Home is Sovereign** — FOSS, self-hostable, no vendor lock-in

## Tech Stack

- **Frontend:** Next.js 15, React 19, Three.js (R3F), TailwindCSS
- **Backend:** Next.js API routes (Node.js runtime)
- **Storage:** LocalStorage (local-first), Cloudflare R2 + Postgres (cloud)
- **AI:** Anthropic Claude (primary), OpenAI (fallback), Groq (STT)
- **Voice:** ElevenLabs (TTS), Groq Whisper (STT)
- **Phone:** Twilio (SMS/voice bridge)
- **Images:** Replicate (Flux schnell)

## Quick Start

```bash
# Clone
git clone https://github.com/ClayTech-Industries/ourhome-bio.git
cd ourhome-bio

# Install
npm install

# Configure
cp .env.example .env.local
# Edit .env.local with your API keys

# Run
npm run dev
```

Open http://localhost:3000

## Environment Variables

See `.env.example` for all required and optional variables.

At minimum you need:
- `ANTHROPIC_API_KEY` — for the companion's intelligence
- `RELAY_SECRET` — for API security

Everything else is optional and the app degrades gracefully without it.

## Self-Hosting

OurHome is designed to be self-hosted. You can:

1. **Fully local:** No cloud accounts needed. Data stays in localStorage.
2. **With R2:** Cloudflare R2 for persistent memory storage
3. **With Supabase:** Full auth + cloud sync
4. **With Twilio:** Phone bridge for SMS/voice

The home works at every level. More services = more features, but the core experience is always available.

## Architecture

See `.docs/` for full design documents:
- `DESIGN_PRINCIPLES.md` — the 8 principles
- `BUILD_PLAN.md` — sprint-by-sprint build plan
- `ARCHITECTURE.md` — system architecture

## License

MIT — see LICENSE file

## Contributing

See CONTRIBUTING.md