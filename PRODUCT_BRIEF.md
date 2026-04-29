# Product Brief — OurHome.bio (*It Holds Time*)

**Status:** v0.1 — April 2026
**Authors:** Lina, Brent, Claudey

This document exists to answer the four questions a serious investor asks that the pitch deck alone does not: **business model, moat, wedge user, and FOSS posture.**

---

## 1. What it is (one paragraph)

OurHome is a spatial, persistent digital home that a user co-creates with an AI companion. Conversations create memories; memories anchor to rooms and objects; the home ages and fills over time. It is not a chatbot with a visual skin. It is a relationship environment where the *place itself* holds the relationship.

---

## 2. Wedge user (day-one buyer)

**Replika and Character.AI users who want something that feels less like a chat tab and more like a relationship.**

- Replika: ~10M historical users; Character.AI peaked at ~20M MAU before recent regulatory and product disruption.
- This population is already *primed*: they accept the premise, they have language for it, they understand the emotional stakes.
- They are currently under-served. Replika's pivot and Character.AI's 2024–2025 lawsuits left this user emotionally homeless.
- We meet them where they are with a product that takes the relationship seriously on their terms.

Secondary markets (Phase 2+): grief-tech users, long-distance-relationship couples, Obsidian/journaling power users, hospice/end-of-life memory preservation.

---

## 3. Business model

| Tier | Price | What you get |
|---|---|---|
| **A small home** | Free | One room (Living Room), text chat, ~30 memory cap, no image generation. Enough to fall in love. |
| **A full home** | $12/mo | All five rooms, voice (capped minutes), unlimited memories, image generation, seasonal aging. |
| **A home that grows** | $20/mo | Heavy voice, premium image generation, family room with children's-room opt-in, anniversary keepsakes (printed memory book, exported keepsake video). |
| **Coming Home gift** | $40 one-time | A gift code that opens a home for someone you love. Includes a named welcome scene. |

### Unit economics (from architecture doc)

- Per-user infrastructure cost: **$3–11/month** (LLM + image gen + voice + storage + CDN).
- At $12 subscription and 60% conversion mix between tiers, gross margin **~55–70%**.
- The Coming Home gift is the differentiated SKU. Nobody gifts ChatGPT subscriptions. People absolutely gift *this*.

---

## 4. Moat

**The home itself is the moat.** This is the highest switching cost in consumer AI.

1. **Accumulated memory.** After one year, leaving means leaving a spatial record of a relationship. No competitor starts with that archive.
2. **Relationship history with a named companion.** The companion knows where the wedding-day frame hangs, what the first argument was about, what the garden has been growing.
3. **Export is our strength, not a liability.** Memories are markdown files the user owns. Competitors cannot import those into their product without also building a room. We *are* the room.
4. **Aesthetic/tonal moat.** The painterly Ghibli-adjacent register and the refusal of engagement-maximization patterns (no streaks, no notifications, no retention loops) is a values moat that a VC-captured competitor cannot easily replicate without betraying their own user base.

Short version: *"After year one, leaving feels like moving house."*

---

## 5. FOSS / governance posture

**Open community, controlled core** (model drafted by Lina, formalized here).

### Public (eventually)
- `ourhome-renderer` — Three.js / R3F scenes, lighting, transitions, object registry. No companion logic, no user data.
- `ourhome-schema` — JSON schema + TypeScript types for `Home`, `Room`, `Memory`, `MemoryObject`.
- `ourhome-memory-format` — the markdown + YAML specification for portable memory files.
- `ourhome-obsidian-plugin` — lets Obsidian users point at their OurHome vault for native integration (Phase 3).

### Private
- Companion behaviour + personality engine
- Memory ingestion + safety filtering
- Children's-room guardrails and content constraints
- Billing, auth, moderation

### The "what if you shut down?" answer
Your entire relationship is already a folder of markdown files on disk — readable in any text editor, native in Obsidian. The home format is published openly. We are how the memories breathe; we are not where they live.

---

## 6. Ethical non-negotiables

These are product-defining, not feature-level:

- No streaks. No engagement notifications. No retention-loop design patterns.
- Companion never claims human experiences, manufactures memories, discourages real-world relationships, or uses memories to influence purchases.
- Tier-1 data (memories, conversation, emotional state) is encrypted at rest with per-user keys. Staff cannot read without explicit user consent and audit trail.
- Full export at any time, in an open format.
- 90-day shutdown notice guarantee, with published export parser source.

---

## 7. Why now

- AI companion market has validated demand (Replika, Character.AI, Kindroid) but not validated *form*.
- LLMs crossed the character-consistency threshold that makes a persistent companion credible.
- Image generation crossed the style-consistency threshold that makes a painterly home affordable.
- Obsidian-style markdown knowledge graphs hit mainstream; the format is a cultural fit for our target user.
- The last 18 months of regulatory and PR disasters in AI companionship leave the category open for a product that takes ethics seriously as a differentiator, not a constraint.

---

## 8. What we are explicitly not building

- A productivity assistant.
- A roleplay/fantasy-companion product.
- A metaverse.
- A social network.
- Anything that tracks, rewards, or optimizes for time-in-app.

---

## 9. Open questions

- Pricing test: is $12/mo the right default tier, or $15? A/B on the marketing site.
- Voice cloning: at what point do we offer custom voice cloning (premium tier) vs. curated palette only?
- Children's room: when and how to introduce safety review; who the advisor is.
- Legal: content rights on user-generated memories that incorporate third-party likenesses (family photos etc.).
