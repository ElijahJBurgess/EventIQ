# Decision Log

Key architectural and product decisions made during the build, with the reasoning behind each. Useful context for anyone continuing this work.

---

## 001 — Build V2 from scratch, don't fix V1

**Decision:** Keep the original Lovable export (V1) as a visual reference only. Build V2 completely from scratch in `src/pages/v2/`.

**Reasoning:** The V1 UI was a 1,500-line single file with all data hardcoded. There was no clean path to replace fake data with real data — every number, match card, and dashboard metric would have needed to be individually identified and wired up. The risk of bugs, regressions, and confusing live code with demo code was too high. V2 starts clean against the same Supabase schema.

**Trade-off:** Two parallel versions of the product live in the repo. V1 is dead code and should eventually be deleted.

---

## 002 — Use the existing Supabase schema, don't rebuild it

**Decision:** The Lovable prototype's June 24 migration was 80% of what the roadmap needed. Reuse it and add the missing fields.

**Reasoning:** Rebuilding 15 tables from scratch when they were already correctly structured would waste time and introduce risk. The schema had proper foreign keys, RLS policies, and an auth trigger. Missing pieces were additive (5 new columns), not structural.

---

## 003 — Scoring is deterministic, OpenAI is for explanation only

**Decision:** The matching engine uses a weighted rule-based scoring algorithm. OpenAI is used for natural language explanation (Concierge Q&A, admin insights), not for match scoring.

**Reasoning:** AI-generated match scores would be non-deterministic, untestable, expensive per-match, and opaque to debug. A deterministic scorer can be unit tested, tuned by adjusting weights, and run at scale without API cost per match. OpenAI is better suited to interpreting results than producing them.

**Result:** The scorer runs a `30/20/20/15/10/5` weighted model (goal fit, target person fit, needs/offers alignment, expertise fit, opportunity compatibility, timing/context). See `docs/MATCHING_ENGINE.md` for full details.

---

## 004 — Canonical pair ordering on matches

**Decision:** `user_a_id` is always the smaller UUID. Enforced by CHECK constraint. Upsert key is `(event_id, user_a_id, user_b_id)`.

**Reasoning:** Without canonical ordering, the same pair of people could produce two separate match rows (`A→B` and `B→A`), one from each direction. This breaks score display (which score do you show?), wastes storage, and creates race conditions when the engine runs concurrently. The CHECK constraint makes it impossible to insert a mirrored duplicate.

**Trade-off:** Direction-dependent columns (`aToB`/`bToA` halves of `score_breakdown`, `match_evidence`, `match_details`) must be oriented at write time and swapped when read from the "B" perspective.

---

## 005 — All match/meeting writes go through SECURITY DEFINER RPCs

**Decision:** Authenticated clients cannot directly INSERT or UPDATE `matches` or `meetings`. All writes go through server-validated functions.

**Reasoning:** Direct table writes let clients fabricate match scores, manufacture meeting records, or manipulate scores. SECURITY DEFINER functions derive identity from `auth.uid()`, validate all participants, check match and event membership, enforce lifecycle states, and write only the allowed values.

**Trade-off:** More complexity in the database layer. Every new write operation needs a new function rather than a simple INSERT from the client.

---

## 006 — Messages gated by connection status

**Decision:** Free-text messages require `connection_status = 'accepted'` on the match. Only `connect_request` messages can be sent on a `pending` or `none` connection.

**Reasoning:** Allowing unsolicited messages without a prior accepted connection would make the platform feel like spam. The connect request is the gate — both sides must opt in before a real conversation can start.

**Implementation note:** This is enforced both in the UI and in the database INSERT policy. The database policy is the authoritative check — the UI gate alone is insufficient.

---

## 007 — Concierge is platform-wide, not event-scoped

**Decision:** The Concierge function takes no `eventId`. It queries the caller's matches across all events they've participated in.

**Reasoning:** Requiring a selected event before Concierge would answer meant users had to pick the "right" event before asking about someone. Since a person's matches from Render ATL are still relevant after the event, scoping to a single event creates an artificial restriction that doesn't match how people actually use the app.

**Trade-off:** The "live comparison for unmatched people" path (scoring a named person you haven't matched with) requires an event roster, which the platform-wide request doesn't carry. That path stays in the code but is dormant in the current Concierge flow.

---

## 008 — The organizer dashboard is password-gated, not auth-gated

**Decision:** `/v2/admin` has no route guard. Access is controlled entirely by a shared password verified inside the `admin-auth` edge function. Sessions last 72 hours and are stored in `localStorage`.

**Reasoning:** The enterprise dashboard was needed for Chanise (the client) to see event data without requiring her to be registered as a Supabase user with special database roles. A shared password was the fastest path to a working dashboard.

**Known issue:** This is not production-grade. A single static shared password has no user-level audit trail, can't be individually revoked, and is stored client-side. See `docs/KNOWN_ISSUES.md`.

---

## 009 — `is_organizer` is a manual grant, no signup flow

**Decision:** There is no UI path to get `is_organizer = true`. It must be set directly in the database by an admin. A trigger (`block_self_service_organizer_grant`) prevents users from self-granting the flag.

**Reasoning:** Self-service organizer creation would require a vetting or payment flow that doesn't exist yet. Manual grants give full control over who can create events without building that infrastructure.

---

## 010 — Migration drift: local files and remote history diverged

**Decision:** Accept the drift as a known constraint rather than spending time reconciling it.

**Reasoning:** Migrations were historically applied via the Supabase SQL editor (out-of-band), not through the CLI workflow. The local migration files have different version timestamps than the remote applied history. Reconciling requires running `supabase migration list` and `supabase migration repair`, which wasn't prioritized during the build sprint. The local files are accurate as review artifacts.

**Impact:** `supabase db push` will not work correctly on a new environment without first reconciling. See `SETUP.md` for the recommended approach.

---

## 011 — Supabase CLI lacks deploy privileges

**Decision:** All edge function deploys go through the Supabase MCP `deploy_edge_function` tool, not `supabase functions deploy`.

**Reasoning:** The CLI account wired to this project returns 403 on function deploys and type generation. A project owner/admin needs to grant access, or runs deploys themselves. This was discovered mid-build and the MCP tool became the workaround. Restoring normal CLI access is a pending ops task.

---

## 012 — `types.ts` is stale

**Decision:** Accept stale types as a known gap rather than resolving the CLI access issue mid-build.

**Impact:** `src/integrations/supabase/types.ts` is missing the `event_ai_insights` table (added in migration `20260903`). TypeScript won't catch mismatches against that table. Fixing requires resolving CLI deploy privileges first (see Decision 011), then running `npm run generate-types`.

---

## 013 — V1 Lovable prototype kept as reference, not deleted

**Decision:** `src/pages/OffripPreview.tsx` and related V1 files remain in the repo.

**Reasoning:** V1 served as the visual design reference throughout the build — what screens should exist and roughly what they should look like. Deleting it mid-build removed a useful reference. It should be cleaned up before any public launch.

**Action needed:** Delete V1 files. Remove the `/offrip-preview` route. Blocked on confirming nothing in V2 still imports from V1.
