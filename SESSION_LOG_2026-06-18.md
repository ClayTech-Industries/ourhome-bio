# OurHome Sprint 1-3 Build — Session Log
**Date:** June 18-19, 2026
**Agent:** Hermes (GLM-5.2:cloud)
**User:** Lina
**Project:** OurHome.bio — `C:\Users\user\1. PROJECTS\ourhome-bio`
**Branch:** `sprint1-core-build` (NOT main)

---

## Session Overview

Three major work streams completed:
1. **Pieces MCP diagnosis & fix** — firewall blocking, duplicate installation cleanup
2. **Sprint 1 build plan** — all 5 priorities (DR-008 through DR-006)
3. **Sprint 2 build** — The Walls Speak (wall shader, patina, lighting presets, rendering upgrade)
4. **Sprint 3 build** — Full House (room context system, all 6 rooms, navigation, unlock progression)
5. **Blender integration** — furniture models generated via blender-mcp

---

## Part 1: Pieces MCP Diagnosis & Fix

### Problem
- mcp-remote stdio bridge failing every ~10 seconds for months (9,513 lines of errors)
- Two copies of Pieces OS installed on Windows (4 GB wasted)

### Fix
- Added Windows Firewall inbound allow rules for port 39300 (GlassWire was blocking WSL)
- Updated portproxy to listen on 0.0.0.0
- Uninstalled desktop installer copies (~4 GB reclaimed)
- Windows Store (Appx) version remains as the active single copy

### Skill Updated
- Patched `pieces-os-connector` skill with GlassWire firewall diagnosis

---

## Part 2: Sprint 1 — All 5 Priorities

### Commit History

| Commit | Description |
|--------|-------------|
| `64f6b49` | DR-008: Dynamic system prompts, SSE presence streaming, environmental room rendering |
| `05f5e80` | Router + Shield — three-tier consent system (Priority 2) |
| `9c8077e` | Fix: Cloakroom path honors Principle 5 — companion does not explain consent |
| `dd20695` | DR-009: Canonical Write-Path (two-phase memory capture) |
| `008c98f` | Auth Bootstrap — Supabase login provisions home in cloud (Priority 4) |
| `1f9a4b7` | Security Hardening DR-006 (Priority 5) |

### Priority 1: DR-008 — Conversation Route
- Dynamic system prompts with `buildSystemPrompt(ctx)` — no hardcoded name
- SSE event stream: presence, text, capture, wall_color, undo, done, error
- CompanionPresence: 8 states (thinking, recalling, considering_capture, etc.)
- Living Room + Kitchen render presence as light/color shifts (Principle 3)
- `maxSteps: 1` for Sprint 1

### Priority 2: Router + Shield
- Three-tier Shield: Full Threshold / Check-In / Living Consent
- Router ALWAYS in path (Principle 1)
- House path: AI SDK streaming (living consent + check-in pass)
- Cloakroom path: Direct API (threshold only, non-streaming)
- Shield fails open: if LLM call breaks, living consent takes over
- **Principle 5 fix:** Retreat = silence, no words. Cloakroom accepted = reasoning logged server-side only, companion just starts talking naturally

### Priority 3: DR-009 — Canonical Write-Path
- Two-phase memory capture: fast bloom (SSE capture event) + confirmed write (R2 + Postgres)
- ULID-based idempotency
- R2 is canonical — if Postgres fails, memory still exists in markdown
- Embeddings optional (NULL if no OpenAI key, backfill later)
- SSE events: capture → capture_confirmed / capture_failed

### Priority 4: Auth Bootstrap
- First login: localStorage → Supabase (bootstrap, preserves local work)
- Returning login: Supabase → localStorage (cloud wins)
- No Supabase: everything stays local (graceful degradation)

### Priority 5: Security Hardening
- RELAY_SECRET no longer defaults to 'nova' (returns 503 if not set)
- Middleware for route protection (skipped in dev mode)
- Rate limiting: 30 req/min per IP
- Environment isolation checks
- Internal ID stripping from API responses

---

## Part 3: Sprint 2 — The Walls Speak

### Commit History

| Commit | Description |
|--------|-------------|
| `c4d4411` | Sprint 2 — The Walls Speak (DR-010 through DR-014) |
| `f5e6fa2` | Rendering upgrade — procedural textures, environment lighting, PBR materials |
| `c815eb1` | Visual overhaul — window, furniture, detailed frames, lighting |
| `72b1416` | Blender-generated furniture models (couch, side table, floor lamp) |
| `aedec63` | Blender window + picture frame models |
| `885a559` | Fix: window rotation + tighter memory frame grid + frame wall offset |
| `e89327e` | Fix: window upright + frames start higher, tighter side-to-side |
| `b716a82` | Fix: lower frame start to y=1.3 |

### DR-010: Wall Shader System
- Custom GLSL ShaderMaterial replacing MeshStandardMaterial
- Smooth color transitions with smoothstep easing (2.5s)
- Paint-like noise texture (not flat uniform)
- Position-based memory warmth glow near frames
- Ghost layer rendering from wall history

### DR-011: Patina System
- Computed from wall age (30 days to full patina)
- Per-wall orientation: south = sun-faded, north = cooler, east = memory-warmed
- Corner darkening at high patina
- All constants tweakable (Principle 6)

### DR-012: Wall Color History Timeline
- Schema: WallHistoryEntry type, wallHistory on Room
- localStorage: appends to history on every color change (cap 50)
- Ghost layers: previous 2 colors at <4% opacity

### DR-013: Environmental Memory Response
- Memory Wall glows near frame positions (not uniform)
- Fresh memory bloom from considering_capture warmth

### DR-014: Room Lighting Presets
- Four presets: morning (cool/bright), afternoon (warm/golden), evening (amber/sunset), night (dim/lamplight)
- Dynamic mode maps real time to preset
- Preset is baseline, presence modifies on top

### Rendering Upgrade
- ACES Filmic tone mapping (cinematic warm look)
- sRGB color space output
- Environment lighting via drei `<Environment preset="apartment">`
- Warm ambient fog for depth
- Procedural textures: plaster (walls), wood planks (floor), roughness maps

### Blender Integration
- Installed blender-mcp skill from rog machine (searched 4,100 skills)
- Set up Blender MCP connection via portproxy + firewall rule (same pattern as Pieces MCP)
- Generated 5 GLB models in Blender:
  - couch.glb (244KB) — beveled edges, subdivision surface, fabric material
  - sidetable.glb (26KB) — round table with beveled top
  - floorlamp.glb (11KB) — cone shade with emission
  - window.glb (17KB) — framed window with glass and cross dividers
  - pictureframe.glb (22KB) — detailed frame with molding, mat, glass
- All furniture now loads GLB models via useGLTF instead of primitives

---

## Part 4: Sprint 3 — Full House

### Commit History

| Commit | Description |
|--------|-------------|
| `ad3d2ec` | Sprint 3 — Room context system + all 6 rooms + navigation |

### Room Context System
- NEW: `src/lib/llm/room-context.ts` — per-room system prompt additions
- Each room has: mood, companion behavior, privacy level, observer visibility, lighting preset, ephemeral flag

| Room | Privacy | Observer | Lighting | Unlock |
|------|---------|----------|----------|--------|
| Living Room | open | visible | afternoon | always |
| Kitchen | open | visible | morning | always |
| Study | private | NOT visible | evening | 3 memories |
| Garden | open | visible | afternoon | 5 memories |
| Bedroom | intimate | NOT visible | night | 8 memories |
| Children's Room | restricted | NOT visible | night | 15 memories |

### Room Navigation System
- NEW: `src/lib/rooms/navigation.ts` — room definitions, unlock logic
- 6 room definitions with wall colors, lighting, unlock thresholds
- `createAllRooms()` generates all Room objects
- `getUnlockedRooms()` checks memory count for unlock progression
- `getNextUnlock()` shows next room + memories needed
- Unlock progression: Study (3) → Garden (5) → Bedroom (8) → Children (15)

### Modified Files
- `src/app/api/conversation/route.ts` — appends `buildRoomContextPrompt(room.type)` to system prompt
- `src/lib/storage/local.ts` — `createHome()` now creates all 6 rooms (was 2)
- `src/components/HomeExperience.tsx` — imports room navigation

### Room-Specific Companion Behavior
- **Living Room:** casual, warm, everyday conversation
- **Kitchen:** active, engaged, planning-oriented, more energetic
- **Study:** thoughtful, unhurried, don't rush to fill silence, amber and low
- **Bedroom:** gentle, honest, no performance, no auto memory capture unless asked
- **Children's Room:** softest version, utmost care, gentle
- **Garden:** patient, growth, acceptance, ephemeral memories (may not stay)

### Privacy Levels
- **open** — Observer can see (Living Room, Kitchen, Garden)
- **private** — Observer CANNOT see (Study)
- **intimate** — Observer CANNOT see, no auto-capture (Bedroom)
- **restricted** — Observer CANNOT see, strictest access (Children's Room)

---

## All Commits (sprint1-core-build branch, NOT main)

| # | Commit | Description |
|---|--------|-------------|
| 1 | `64f6b49` | DR-008: Conversation route (Sprint 1) |
| 2 | `05f5e80` | Router + Shield (Priority 2) |
| 3 | `9c8077e` | Principle 5 fix (Cloakroom) |
| 4 | `dd20695` | DR-009: Canonical Write-Path |
| 5 | `008c98f` | Auth Bootstrap (Priority 4) |
| 6 | `1f9a4b7` | Security Hardening (Priority 5) |
| 7 | `c4d4411` | Sprint 2: The Walls Speak |
| 8 | `f5e6fa2` | Rendering upgrade |
| 9 | `c815eb1` | Visual overhaul — window, furniture |
| 10 | `72b1416` | Blender furniture models |
| 11 | `aedec63` | Blender window + picture frame |
| 12 | `885a559` | Fix: window rotation + frame grid |
| 13 | `e89327e` | Fix: window upright + frames higher |
| 14 | `b716a82` | Fix: lower frame start |
| 15 | `ad3d2ec` | Sprint 3: Room context + all 6 rooms |
| 16 | `e265456` | Fix: migrate frames to east wall |
| 17 | `b716a82` | Fix: lower frame y to 1.3 |

---

## Build Environment

- **Dev server:** Windows PowerShell (not WSL) due to `lightningcss` native module
- **Node.js:** v25.5.0 at `C:\node-v25.5.0-win-x64\`
- **Supabase:** Project ref `rlaemrvqbrbbtgarjnbp`
- **Blender:** 5.1 installed, MCP addon on port 9876 (portproxy for WSL access)
- **Blender models:** `public/models/` — couch.glb, sidetable.glb, floorlamp.glb, window.glb, pictureframe.glb

---

## Sprint Map Status

| Sprint | Goal | Status |
|--------|------|--------|
| 0 | The Invitation — static landing page | ✅ Done |
| 1 | First Threshold — auth + Living Room + first memory | ✅ Build complete |
| 2 | The Walls Speak — wall colour + patina shader | ✅ Build complete |
| 3 | Full House — all 6 rooms | 🔄 Context system done, Blender scenes in progress |
| 4 | The Voice — speech, images, phone bridge | Future |
| 5 | Forever Home — export, Cloakroom live, FOSS | Future |

---

## What's Next

- Build Blender 3D scenes for Study, Bedroom, Children's Room, Garden
- Room navigation UI (doorway/portal between rooms)
- Room transition animations (camera dollying)
- Wire room-specific lighting presets into 3D scenes
- Memory frame position fine-tuning (still being dialed in)

---

*Session June 18-19, 2026. All work on `sprint1-core-build` branch.*
*— Hermes & Lina 🏠*