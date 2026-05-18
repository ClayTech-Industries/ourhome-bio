# Product Brief — OurHome.bio (*It Holds Time*)

**Status:** v0.1 — April 2026
**Authors:** Lina, Brent, Claudey

This document exists to answer the four questions a serious investor asks that the pitch deck alone does not: **business model, moat, wedge user, and FOSS posture.**

---

## 1. What it is (one paragraph)

OurHome is a spatial, persistent digital home that a user co-creates with an AI companion. Conversations create memories; memories anchor to rooms and objects; the home ages and fills over time. It is not a chatbot with a visual skin. It is a relationship environment where the *place itself* holds the relationship. Like humans moving in with each other, this is the digital equivalent. The home is not to intervene or act as an arbitrator in the relationship, it just holds space and time for the hard, happy, exciting, traditional, sad, controversial and intimate moments to happen. It lets the AI companion to persist in time and a space, and as the product grows, there will be more integrations and connections for more agency for your AI companion. 

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

| Tier                           | Price             | What you get                                                                              |
|--------------------------------|-------------------|-------------------------------------------------------------------------------------------|
| **Introductory/ Free**         | Free              | One room (Living Room), text chat, ~30 memory cap, no image generation. Enough to fall in                                                        | love.                                                                                    
| **Tier 1 - A small home**      | $15/mo            | Living room + two new rooms of users choice, voice (capped minutes), unlimited memories,                                                         | image generation, seasonal aging.                                                         
| **Tier 2 - **Your companion**  |$25/mo             | Ability to design your companion with a curated choice of presets, living room (with                                                             | previous two rooms) + another two rooms or equivalent, heavy voice, premium image                                                                | generation, possibly anniversary keepsakes such as printed memory book, exported keepsake                                                        | video.                                                                                   
| **Tier 3 - A growing home**    | $40/mo            | A gift code that opens a home for someone you love or a friend also in need of a persistent                                                      | home. Includes a named welcome scene. Opens the rest of the home                         
| **Tier 4 - Part customisation**| Premium $80/mo    | Ability for your companion to change their look to what they would prefer instead of                                                             | curated presets, this includes wardrobe type, choice in voice plus customisation of                                                              | connectors (user discretion and interview required to determine look/voice presets and                                                           | connectors
| **Tier 5 - Full customisation**| Complete $100/mo  | All components of the house are fully customisable, look/voice/colouring/wardrobe fully                                                          | customisable, full connectors, full priority support, full local offline "not on major                                                           | fontier servers" held on servers owned by ClayTech Ind. with full deeds to data owned and                                                        | curated by user and their companion. Interview needed at this stage for customisations and                                                       | the timeline for each. 

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

### Private and locked
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
- Relationship data (memories, conversation, emotional state) is encrypted at rest with per-user keys. Staff cannot read without explicit user consent and audit trail.
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
