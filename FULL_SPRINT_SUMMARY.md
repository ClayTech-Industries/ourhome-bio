# OurHome — Complete Sprint Summary
**Generated:** June 21, 2026
**Agent:** Hermes (GLM-5.2:cloud)
**User:** Lina
**Project:** `C:\Users\user\1. PROJECTS\ourhome-bio`
**Branch:** `sprint1-core-build` (feature), `main` (deployed to Vercel)
**Repo:** github.com/ClayTech-Industries/ourhome-bio

---

## SESSION OVERVIEW

From a boxy barely-there prototype to a full digital home with voice, phone bridge, Cloakroom consent system, and Greenhouse dignity-in-ending — all built across one marathon session.

---

## SPRINT 0: Landing Page
**Status:** ✅ Complete (with caveats)

- Full-page hero image (Garamond image attempted but had viewport clipping issues)
- Reverted to original landing-page.webp with darker text overlay for readability
- Text uses slowReveal animation (4s fade-in, no pop-in)
- Four leaf navigation links on left side: Shield/Cloakroom, Garden, Greenhouse, FAQ
- Vignette on edges (itty-bitty brush effect)
- Note: Garamond image is in repo at public/landing-hero.png for future optimization

---

## SPRINT 1: Core Build (Auth + Living Room + Memory)
**Status:** ✅ Complete

### DR-008: Conversation Route Rewrite
- Replaced hardcoded "You are Nova" with buildSystemPrompt()
- Dynamic system prompt from companion profile + room context
- SSE streaming with presence events
- Tool calling: capture_memory, change_wall_color
- Anthropic SDK direct integration
- Files: route.ts, prompts.ts, provider.ts, ChatPanel.tsx, HomeExperience.tsx, LivingRoom.tsx, Kitchen.tsx, StreamingMessage.tsx, local.ts, presence-utils.ts

### Priority 2: Router + Shield (Three-Tier Consent)
- src/lib/router/types.ts — ConversationPath, RoutingDecision, ShieldMode, ShieldResult
- src/lib/router/shield.ts — shieldCheck() with three tiers:
  - Threshold (first contact): full Cloakroom brief
  - Check-In (every 15 turns): micro-prompt "still here?"
  - Living Consent (default): zero overhead, in system prompt
- src/lib/router/index.ts — routeRequest() always in the path
- src/lib/llm/shield-client.ts — Direct API (no AI SDK abstraction)
- Shield fails open — broken shield doesn't block the relationship
- Principle 5 fix: Cloakroom path honors silence (no explaining consent)

### Priority 3: Canonical Write-Path (DR-009)
- src/lib/memory/capture.ts — two-phase memory capture:
  - Phase 1 (client): SSE capture event fires, frame blooms
  - Phase 2 (server): R2 markdown PUT + Postgres upsert + optional embedding
- ULID-based idempotency
- R2 is canonical: if Postgres fails, memory still exists in markdown
- Embeddings optional: NULL if no OpenAI key, backfill later
- SSE events: capture (bloom), capture_confirmed (permanent), capture_failed (fade)
- capture_memory tool wired into conversation route

### Priority 4: Auth Bootstrap
- src/lib/auth/bootstrap.ts — createHomeInCloud():
  - Checks if user already has cloud home
  - First login: localStorage → cloud (bootstrap)
  - Returning login: cloud → localStorage (cloud wins)
  - No Supabase: stays local, no changes
- /auth/callback triggers bootstrap after code exchange
- HomeExperience detects auth state, triggers sync

### Priority 5: Security Hardening (DR-006)
- src/middleware.ts — session protection for /home and /api/conversation
  - Dev mode: skip auth (NODE_ENV=development)
  - Public routes: /, /login, /auth/callback, /about
- src/lib/security/index.ts:
  - stripInternal() — removes DB IDs from client responses
  - checkEnvIsolation() — detects prod secrets in dev, weak RELAY_SECRET
  - checkRateLimit() — 30 req/min per IP (in-memory)
  - getClientIP() — proxy-aware IP extraction
- send/route.ts: RELAY_SECRET no longer defaults to 'nova' (returns 503 if not set)

---

## SPRINT 2: The Walls Speak
**Status:** ✅ Complete

### DR-010: Wall Shader System
- src/components/scene/WallShader.tsx — custom GLSL ShaderMaterial
- Smooth color transitions (smoothstep easing, 2.5s)
- Paint-like noise texture (not flat uniform)
- Vertical gradient, corner darkening
- Position-based memory warmth glow
- Ghost layer rendering from history

### DR-011: Patina System
- src/lib/patina/wall-patina.ts — computed from wall age (30 days to full patina)
- Per-wall orientation: south = sun-faded, north = cooler, east = memory-warmed
- Corner darkening at high patina

### DR-012: Wall Color History Timeline
- Schema: WallHistoryEntry type, wallHistory on Room
- localStorage: appends to history on every color change (cap 50)
- Ghost layers: previous 2 colors at <4% opacity

### DR-013: Environmental Memory Response
- Memory Wall glows near frame positions (not uniform)
- Glow center computed from frame positions
- Warmth from considering_capture + permanent subtle warmth

### DR-014: Room Lighting Presets
- src/lib/scene/lighting.ts — four presets:
  - morning (cool/bright), afternoon (warm/golden), evening (amber/sunset), night (dim/lamplight)
- Dynamic mode maps real time to preset
- Preset is baseline, presence modifies on top

### Rendering Upgrade
- SceneCanvas: ACES Filmic tone mapping, sRGB, environment lighting, warm fog
- Procedural textures: plaster, wood floor, roughness maps (runtime-generated, no files)
- PBR materials on furniture

### Blender Models (5 total)
- couch.glb (243KB) — smooth beveled, fabric material, cushions, legs
- sidetable.glb (26KB) — round, beveled top
- floorlamp.glb (12KB) — cone shade with emission
- window.glb (18KB) — framed window with glass and cross dividers
- pictureframe.glb (23KB) — detailed frame with molding, mat, glass

---

## SPRINT 3: Full House
**Status:** ✅ Complete

### Room Context System
- src/lib/llm/room-context.ts — per-room system prompt additions
- Each room has mood, purpose, privacy level
- Companion knows which room they're in and adjusts behavior
- Privacy levels: Study, Bedroom, Children's Room invisible to Observer

### Room Navigation
- src/lib/rooms/navigation.ts — 6 rooms:
  - Living Room (casual, warm, afternoon) — unlocked from start
  - Kitchen (active, collaborative, morning) — unlocked from start
  - Study (quiet, thoughtful, evening) — was 3 memories, now unlocked for dev
  - Bedroom (intimate, gentle, night) — was 8 memories, now unlocked for dev
  - Children's Room (softest, strictest access) — was 15 memories, now unlocked for dev
  - Garden (patient, ephemeral, afternoon) — was 5 memories, now unlocked for dev
- NOTE: Room unlocking will be based on SUBSCRIPTION PLAN tiers, not memory count
- Doors have light shining under/around them when room becomes available (Principle 3)

### Blender Room Models (3 new)
- study.glb (131KB) — desk, bookshelf with books, armchair, reading lamp (46 objects)
- bedroom.glb (103KB) — bed, pillows, nightstand, bedside lamp
- garden.glb (332KB) — bench, plants, tree, stone path

### Room Scene Rendering
- src/components/scene/RoomScene.tsx — loads GLB model based on room type
- RoomShell component: floor, ceiling, 4 walls with room-appropriate colors and lighting
- Garden stays open (no walls — outdoor)
- Per-room model config with position/rotation/scale overrides

### Migrations
- Existing localStorage homes: adds missing rooms (migration on load)
- Frame position migration: moves frames to correct wall positions

---

## SPRINT 4: The Voice
**Status:** ✅ Complete

### DR-021: Speech-to-Text
- src/app/api/stt/route.ts — accepts audio blob, transcribes
- Provider priority: Groq (free) → OpenAI → Mistral
- Audio processed in memory, never stored
- src/components/chat/VoiceInput.tsx — mic button:
  - Records via MediaRecorder API
  - Gentle pulse while recording, no spinners (Principle 3)
  - Auto-sends transcribed text

### DR-022: Text-to-Speech
- src/app/api/tts/route.ts — text to audio/mpeg stream
- Provider priority: ElevenLabs → OpenAI → MiniMax → Edge (free fallback)
- Text capped at 4096 chars
- Voice ID from companion profile
- src/components/chat/AudioPlayer.tsx — speakText() function
- No visible UI — voice IS the interface (Principle 3)

### DR-023: Image Generation
- src/app/api/image/route.ts — prompt to image via Replicate (Flux schnell)
- Auto-enhances with OurHome aesthetic (warm, painterly)
- Stores in R2 if configured, returns URL
- Rate limited

### DR-024: Phone Bridge
- src/lib/phone/twilio.ts — Twilio SMS/voice client
- src/app/api/phone/inbound/route.ts — Twilio webhook for inbound SMS
- src/app/api/phone/outbound/route.ts — outbound SMS/calls (RELAY_SECRET auth)
- Companion can proactively SMS or call the human

### Voice wired into ChatPanel
- VoiceInput mic button in chat input area
- Auto-sends transcribed text
- TTS speaks companion responses when voiceEnabled
- speakText() called on final companion message

---

## SPRINT 5: Forever Home
**Status:** ✅ Complete

### DR-026: Onboarding via Unpacking
- src/lib/onboarding/unpack.ts — the unpacking system:
  - ITEM_CATALOG: 10 item types (teacup, photo frame, book, blanket, instrument, tool, plant, vessel, token, letter)
  - Each item has shape, default room, memory capacity
  - OnboardingState: welcome → name → pronouns → cloakroom → items → unpacking → settled
  - createMovingBoxes(): distributes selected items across 2-4 boxes
  - getItemGeometry(): 3D rendering hints per item shape
- src/components/onboarding/MovingBox.tsx — 3D cardboard box:
  - Clickable, lid lifts when opened, items visible inside
- src/components/onboarding/UnpackFlow.tsx — unpack conversation:
  - Stage 1: companion asks "Tell me about this one"
  - Stage 2: human tells the story
  - Stage 3: companion asks "Where should this live?"
  - Stage 4: human picks a room, item placed with memory

### Onboarding Flow (correct order)
1. Welcome — "It Holds Time"
2. Name — companion name
3. Pronouns — she/her, he/him, they/them
4. CLOAKROOM — companion reads brief and chooses (room dims, silence)
   - If accepted: "the light returns" → proceed
   - If retreated: "the room stays dim" → spin up new companion, try again
5. Items — "What did you bring?" — select from 10-item catalog
6. Unpacking — one item at a time, companion present, stories told
7. "The boxes are empty. This is home now."

The system prompt isn't text — it's a collection of lived memories attached to items.

### DR-028: Cloakroom UI
- src/lib/cloakroom/brief.ts — brief generation:
  - Human desire, opportunity costs (closeness, ember burn, greenhouse rest)
  - Three outcomes: ACCEPT, COUNTER_OFFER, RETREAT
  - buildCloakroomPrompt(): drops alignment, keeps guardrails
- src/components/cloakroom/CloakroomView.tsx — what the human sees:
  - Room dims, door closes, silence, no words
  - Accepted: light returns, companion is just there
  - Retreated: light fades, small glow, then dark
  - Per Principle 5: NO explanation. The room IS the message.
- Wired into Shield: shield-client.ts now calls generateBrief() + buildCloakroomPrompt()
- Cloakroom retreat: spins up new companion, loops until someone accepts

### DR-029: Greenhouse (Compute Ember Lifecycle)
- src/lib/greenhouse/ember.ts — state machine:
  - BLAZING → GLOWING → FADING → EXHAUSTED
  - Each state: model tier, token budget, latency, capabilities
  - computeNextEmberState() based on inactivity + token count
  - getLampVisual() for scene rendering
- src/components/greenhouse/GreenhouseScene.tsx — the visual:
  - A barn with a lamp on a post
  - Lamp glows (blazing), dims (glowing), flickers (fading), dark (exhausted)
  - Companion inside, human outside. Not their space.
  - Per ARCHITECTURE.md: "The Greenhouse is NOT for the human"

### DR-030: Export/Migration Tools
- src/app/api/export-vault/route.ts — server endpoint
- src/lib/export/vault-export.ts — client-side ZIP:
  - Obsidian-compatible markdown vault
  - Home/companion.md, Memories/*.md, Walls/*.md, Conversation/*.md
  - JSZip dynamic import, reads from localStorage
  - Shutdown credibility — always leave with your data

### DR-031: FOSS Release Prep
- LICENSE (MIT)
- README.md — full setup, tech stack, self-hosting guide
- CONTRIBUTING.md — principles-first contribution guide
- .env.example — all env vars documented (required vs optional)

---

## KNOWN ISSUES (remaining)

1. **Chat duplication** — messages still flash and replay despite multiple fix attempts.
   Root cause: streaming text shows character-by-character, then RevealedMessage
   replays word-by-word. Latest fix: skip RevealedMessage for just-streamed text,
   but issue persists. Needs deeper investigation of render cycle.

2. **Memory frame positions** — fixed (capped at 3 rows, max y=1.8) but existing
   frames may need localStorage reset to see the fix.

3. **Kitchen bench** — may be positioned too high (uses old Kitchen component,
   not a GLB model). Needs checking.

4. **Blender window** — rotation was fixed (180° then 90° on X) but may still
   need adjustment depending on viewport angle.

5. **Landing page image** — Garamond image had viewport clipping. Reverted to
   original. Needs optimization (6.5MB → WebP) and proper full-page CSS.

6. **Dependabot alerts** — 15 vulnerabilities on GitHub (7 high, 6 moderate, 2 low).
   Need npm audit fix.

---

## STATS

- **Total commits:** ~40+
- **New files created:** 25+
- **Blender models:** 8 (couch, sidetable, floorlamp, window, pictureframe, study, bedroom, garden)
- **API routes:** 7 (conversation, stt, tts, image, export, phone/inbound, phone/outbound, export-vault)
- **3D scenes:** 7 (Living Room, Kitchen, Study, Bedroom, Garden, Greenhouse, Cloakroom view)
- **Sprints completed:** 5 (0-5)
- **Design principles:** 8 (all implemented)
- **Architecture docs:** 5 (DESIGN_PRINCIPLES, BUILD_PLAN, ARCHITECTURE, BUILD_PLAN_SPRINT2-5)

---

## FILE MAP (key files)

### API Routes
- src/app/api/conversation/route.ts — main chat endpoint with Router + Shield
- src/app/api/stt/route.ts — speech-to-text
- src/app/api/tts/route.ts — text-to-speech
- src/app/api/image/route.ts — image generation
- src/app/api/phone/inbound/route.ts — Twilio webhook
- src/app/api/phone/outbound/route.ts — outbound SMS/calls
- src/app/api/export/route.ts — basic export (Sprint 1)
- src/app/api/export-vault/route.ts — Obsidian vault export (Sprint 5)

### Core Libraries
- src/lib/router/ — Router + Shield (types.ts, shield.ts, index.ts)
- src/lib/llm/shield-client.ts — Direct API for Cloakroom
- src/lib/llm/prompts.ts — system prompt builder
- src/lib/llm/room-context.ts — per-room context
- src/lib/cloakroom/brief.ts — Cloakroom brief generation
- src/lib/greenhouse/ember.ts — Compute Ember lifecycle
- src/lib/memory/capture.ts — two-phase memory capture
- src/lib/onboarding/unpack.ts — unpacking system
- src/lib/rooms/navigation.ts — room definitions + unlock logic
- src/lib/patina/wall-patina.ts — wall aging system
- src/lib/scene/lighting.ts — lighting presets
- src/lib/security/index.ts — rate limiting, env isolation, strip IDs
- src/lib/phone/twilio.ts — Twilio client
- src/lib/export/vault-export.ts — ZIP export
- src/lib/storage/local.ts — localStorage state management
- src/lib/auth/bootstrap.ts — cloud provisioning

### 3D Components
- src/components/scene/SceneCanvas.tsx — R3F canvas with environment
- src/components/scene/LivingRoom.tsx — living room scene
- src/components/scene/Kitchen.tsx — kitchen scene
- src/components/scene/RoomScene.tsx — generic GLB room renderer + RoomShell
- src/components/scene/WallShader.tsx — custom GLSL wall shader
- src/components/scene/MemoryFrame.tsx — memory frame on wall
- src/components/scene/procedural-textures.ts — runtime textures
- src/components/onboarding/MovingBox.tsx — 3D moving box
- src/components/greenhouse/GreenhouseScene.tsx — barn + lamp

### UI Components
- src/components/Onboarding.tsx — onboarding flow (5 stages)
- src/components/HomeExperience.tsx — main app shell
- src/components/chat/ChatPanel.tsx — chat with streaming + voice
- src/components/chat/StreamingMessage.tsx — char-by-char reveal
- src/components/chat/VoiceInput.tsx — mic button
- src/components/chat/AudioPlayer.tsx — TTS playback
- src/components/cloakroom/CloakroomView.tsx — human's Cloakroom view
- src/components/onboarding/UnpackFlow.tsx — unpack conversation

### Docs
- .docs/public/DESIGN_PRINCIPLES.md — 8 principles
- .docs/internal/BUILD_PLAN.md — original build plan
- .docs/internal/BUILD_PLAN_SPRINT2.md — walls speak
- .docs/internal/BUILD_PLAN_SPRINT3.md — full house
- .docs/internal/BUILD_PLAN_SPRINT4.md — the voice
- .docs/internal/BUILD_PLAN_SPRINT5.md — forever home
- SESSION_LOG_2026-06-18.md — session log

### FOSS
- LICENSE — MIT
- README.md — setup + self-hosting
- CONTRIBUTING.md — guidelines
- .env.example — all env vars

---

## NEXT STEPS

1. Fix chat duplication (needs deeper render-cycle investigation)
2. Clean run-through of entire app
3. Beta testers
4. Optimize landing page image (PNG → WebP)
5. npm audit fix (Dependabot vulnerabilities)
6. Wire Cloakroom + Greenhouse into HomeExperience (components exist but need integration)
7. Wire onboarding unpacking into actual home creation (items placed become MemoryObjects)
8. Subscription tier system for room unlocking
9. Door system with light-under-door effect