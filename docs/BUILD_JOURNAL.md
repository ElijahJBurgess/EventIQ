# Build Journal

Week-by-week narrative of how OOO Intelligence was built — decisions made, problems hit, scope changes, and what actually shipped. Written as a reference for anyone picking this up or continuing the build.

---

## Background

OOO Intelligence started from a Lovable-generated prototype — a React app that looked like a real product but had no real data behind it. Every match, metric, and dashboard number was hardcoded. The matching engine was smoke. The concierge was a scripted demo.

The underlying Supabase schema from that prototype was actually solid — 15+ tables, proper foreign keys, RLS policies, and an auth trigger. The decision was to keep V1 as a visual reference and build V2 completely from scratch on top of that schema.

Build started: **July 1, 2026**
First live pilot: **Render ATL, August 12–13, 2026**

---

## Phase 0 — Foundation (Late June / Early July)

**Goal:** Audit what exists, lock the schema, connect V2 to a fresh Supabase project.

The Lovable export was audited and the verdict was "salvage." The V2 Supabase schema (the June 24 migration) had nearly everything from the roadmap already defined. What was missing:

- No `who_to_meet` structured field
- No `desired_outcomes` field
- `role_type` enum didn't match the actual dropdown options
- `areas_of_expertise` was a text array, not a proper many-to-many (acceptable for V1)

**What was done:**
- Connected V2 to a new clean Supabase project
- Ran all existing migrations to rebuild the schema
- Added the 5 missing matching fields to `profiles` in a new migration
- Set up Supabase CLI for auto type generation

**Commit:** `a4f5f06` — Initial commit

---

## Week 2 — Profile Setup Flow (July 6–13)

**Goal:** A real user can sign up, complete a profile, and have that data save to the database.

This was the first real build week. The scope was a 4-page profile setup wizard that a user goes through after signing up for the first time. All form data in a single top-level state object so back navigation preserves entries.

**Built:**
- `ProfileSetup.tsx` — wizard container with state management and progress indicator
- Page 1 — Basic Info: name, photo upload (wired to Supabase Storage), title, company, location, LinkedIn, role type
- Page 2 — Matching Preferences: who to meet, desired outcomes, areas of expertise, primary goal (multi-select pills with max limits)
- Page 3 — Role-Specific Questions: dynamic per role type (Founder, Investor, Recruiter, etc.)
- Page 4 — Terms & AI Consent
- Routing: signup → `/v2/setup`, returning users with incomplete profiles → `/v2/setup`, complete profiles → `/v2`
- Full database save on completion
- Profile completion score calculation
- Supabase CLI set up — `npm run generate-types` auto-generates TypeScript types

**Bug caught during testing:** Email confirmation was on in the new Supabase project, intercepting the signup → setup redirect. Turned off in dashboard.

**Bug caught before push:** Role type constraint from the June 24 migration included `Corporate Leader` (never a real option) but was missing `Hiring Manager` and `Brand Partner` (both live dropdown options). Any user selecting either would fail on final submit with no recovery path. Fixed in migration `20260713182316`.

**GitHub save points:**
- `7f3c6ab` — Pages 1 and 2 complete
- `eb9630e` — Week 2 complete, all 4 pages verified

---

## Week 3 — Matching Engine (July 13–August)

**Goal:** A user signs up, fills out their profile, and immediately sees real people they should meet with a real score explaining why.

The matching engine was the hardest and riskiest part of the entire build. Getting it wrong here would break everything built on top of it.

**Day 1:**
- Created Render ATL 2026 as the first real event in the database
- Fixed the `role_type` constraint bug (above)
- Seeded 40 realistic fake profiles to give the engine something to match against

**Day 2:**
- Built the deterministic scoring engine (`30/20/20/15/10/5` weighting model)
- Built and deployed the `match-engine` Deno Edge Function
- Ran the engine against all 40 profiles
- First run produced 531 matches
- Scores were clustering too high (most above 80). Root cause: seed profiles didn't have interests, communities, or conferences filled in, so the diversity component had no variance. Backfilled all 40 profiles with realistic data.
- Re-ran engine — 678 matches, better score distribution

**Day 3:**
- Built the real matches UI — `MatchesTab.tsx` with real cards, real scores, real photos, real names
- Match cards labeled Strong Match / Good Match / Potential Match
- "Request to Connect" button on every card
- Auto-trigger: signing up fires the matching engine automatically

**Commits:**
- `d97e6d6` — Day 1 (event, bug fix, seed profiles)
- `2c87bda` — Day 2 (scoring engine, seed backfill)
- `3be50c8` — Edge Function deployed
- `1ac7efc` — Week 3 complete, matches UI live

---

## Messaging & Connection Flow (August)

After the matching engine was live, the next priority was giving matched people a way to actually communicate.

**Built:**
- Request to Connect button creates a real `connect_request` message in the database
- Editable message composer — pre-written text, but user can modify it before sending
- `MessagesTab.tsx` — conversation list grouped by match, sorted by most recent
- `MessageThread.tsx` — full thread view, correct message alignment for sender vs recipient
- Read state — `mark_message_thread_read()` RPC

**Security fix found during build:** The original messages INSERT policy only checked `auth.uid() = sender_id`. Any authenticated user could message any profile by fabricating a `match_id` and `recipient_id`. Fixed: policy now validates the referenced match links sender and recipient.

**Duplicate connect request bug:** A user could tap "Request to Connect" multiple times before the first message appeared. Fixed with a partial unique index on `(match_id, sender_id)` scoped to `message_type = 'connect_request'`. The backfill in that migration preserved existing history correctly.

---

## Phase 2 — Full Product (August 12 — Render ATL and beyond)

After Render ATL the build continued with the full product vision:

**OFFRIP Design Migration:**
- Full visual rework to OFFRIP design tokens
- Custom font stack, color variables, design primitives
- Home tab rebuilt with live stats, event context, top match, and company banner

**Full Profile View:**
- Expanded profile modal showing structured match explanation
- Matched goals, matched roles, needs/offers alignment, shared interests
- "Make the Intro" connect flow wired from both Matches and Home

**Matching Engine V2 (Directional Rubric):**
- Rebuilt scorer to be directional — `aToB` and `bToA` score halves
- Added `needs_offers_compatibility` lookup table for near-match pairs
- Canonical pair ordering enforced via CHECK constraint and atomic upsert (race condition fix)
- `match_details` JSONB column added for structured explanation data

**Meeting Lifecycle:**
- Full request → accept/decline → schedule → calendar export → complete flow
- All writes through SECURITY DEFINER RPCs (not direct table writes)
- Calendar export token on every meeting

**Connection Status System:**
- `connection_status` column on `matches` (`none` / `pending` / `accepted` / `declined`)
- Messaging and meeting scheduling gated by `accepted` status
- Connection self-report: "Did you actually connect with this person?"
- Connection notes (private per user, never visible to the other side)

**Notifications:**
- In-app notification bell
- Types: connection request, new message, meeting requested, meeting accepted, meeting scheduled, meeting declined
- Written only by trusted database triggers

**Concierge V1:**
- Platform-wide (no event scoping required)
- OpenAI-powered Q&A across all user's matches
- Telemetry locked to service role
- Live "how would we score" comparison for unmatched people

**Enterprise Dashboard (`/v2/admin`):**
- Password-gated (72-hour session)
- Six tabs: Events, Overview, Audience, Relationships, Outcomes, Insights, Reports
- AI-generated insights cached in `event_ai_insights`
- Owner-only event creation via `admin-auth` edge function
- Self-serve room creation for `is_organizer`-flagged accounts

**Security Hardening (V1 Readiness Audit, September 2026):**
- Full 5-section audit documented in `docs/v1-readiness-audit.md`
- Group 1 fix pass: reports world-readable bug, profile insert policy gap, match insert lockdown, CORS wildcard on `admin-auth`
- `admin-gen-link` decommissioned (410 stub)
- Profile photo storage policy tightened
- Match engine authorization secured

---

## What Was Never Built (Honest Account)

These items were in the original roadmap but didn't ship:

- **OpenAI match explanations per card** — column exists (`ai_explanation`), nothing generates into it yet
- **AI-generated conversation starters** — column exists (`conversation_starters`), same gap
- **Privacy Policy** — placeholder only; blocks a real public launch
- **Real Terms of Service** — a checkbox exists; no legal text
- **User consent persistence** — consent is not recorded in the database
- **Email verification** — off in Supabase; needs production SMTP before launch
- **Sponsor Intelligence** (Phase 2)
- **Gamification / points** (Phase 3)
- **Multi-event outcome comparison** (Phase 3)
- **Longitudinal tracking** (Phase 3)
- **CRM / ATS integrations** (Phase 3)
