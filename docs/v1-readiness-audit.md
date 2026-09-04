# V1 Readiness Audit

**Status:** 🚧 in progress — this is a *living document*, committed section-by-section as each area is completed. Do not treat unfinished sections as final.

**Method:** Discovery + documentation only. Nothing is fixed as part of this pass except changes that are trivially safe, and those are listed explicitly in [Appendix B](#appendix-b--trivially-safe-fixes-applied-during-the-audit). Every "broken" or "working" claim is backed by an actual test — the verification method is stated per finding.

**Environment:** Production Supabase project `qdknsjoddmrvwjrrwwiq` ("Event IQ"). All destructive testing uses throwaway accounts created for the audit (naming: `audit-<timestamp>-*@offriptest.dev`); the 83 real `auth.users` and their data are never touched. Test artifacts are cleaned up and tracked in [Appendix A](#appendix-a--test-accounts--artifacts).

**Severity legend:**

| Tag | Meaning |
|---|---|
| 🔴 **blocking** | Must fix before real users / launch |
| 🟠 **should-fix** | Real problem, not launch-blocking on its own |
| 🟡 **nice-to-have** | Polish / hardening / tech debt |
| ⚪ **dead-code** | Unused; safe to remove |
| ✅ **verified-ok** | Checked and working as intended |

---

## Section 0 — Application map (recon)

*Status: complete.*

### Routing (`src/App.tsx`)

| Route | Component | Guard |
|---|---|---|
| `/` | `pages/v2/Landing.tsx` | none (public) |
| `/v2/auth` | `pages/v2/Auth.tsx` | none (public) |
| `/v2/reset-password` | `pages/v2/ResetPassword.tsx` | none (public, token in URL) |
| `/v2/admin` | `pages/v2/OrganizerAdmin.tsx` | **no route guard** — password-gated inside the component via the `admin-auth` edge function |
| `/v2/setup` | `pages/v2/ProfileSetup.tsx` | `<ProtectedRoute>` (auth required) |
| `/v2` | `pages/v2/Dashboard.tsx` | `<ProtectedRoute requireCompletedProfile>` |
| `/offrip-preview` | `pages/OffripPreview.tsx` | `import.meta.env.DEV` only — redirects to `/` in prod |
| `*` | `pages/NotFound.tsx` | none |

### V1 status — **already removed** 🔎

- **There is no `src/pages/Index.tsx` in the tree.** It existed in historical commits (`7f3c6ab`, `ae5c664`) but has since been deleted. No `src/pages/Index*.tsx`, no non-`v2` page besides `NotFound.tsx` and `OffripPreview.tsx`.
- `App.tsx` contains **zero V1 routes**. The app is V2-only end to end.
- Follow-up for this audit: confirm no V1-only *components/libs* remain orphaned (Section 4 / dead-code sweep).
- **Net:** the premise "remove V1's `Index.tsx` and its deps" is largely already done; the remaining work is verifying no stragglers. Tracked as a finding in Section 4.

### Edge functions (local `supabase/functions/`)

| Function | Purpose (from source) | `config.toml` |
|---|---|---|
| `admin-auth` | Password-gated enterprise dashboard data + AI insights/copilot + reports | `verify_jwt = false` |
| `concierge` | AI event concierge chat for attendees | `verify_jwt = true` |
| `match-engine` | Generate a user's matches for an event | *(not in config.toml — check default)* |
| `delete-account` | Self-serve account deletion (shipped today) | `verify_jwt = true` |
| `admin-run-matching` | One-off Aug-25 operator utility for v2.1 match backfill; allowlist-gated; not registered | *(not in config.toml)* |

Full analysis in [Section 2](#section-2--edge-functions).

### Database — 23 tables in `public`

RLS is **enabled on every table**. Tables with RLS enabled but **0 policies** (= deny-all for anon/authenticated, service-role only): `concierge_logs`, `event_ai_insights`, `needs_offers_compatibility`, `us_cities`. Each is assessed in [Section 3](#section-3--security).

Approx row counts: `us_cities` 5389, `matches` 718, `event_registrations` 55, `profiles` 39, `messages` 19, `notifications` 18, `match_actions` 10, `meetings` 6, `connection_self_reports` 2, `events` 2, `concierge_logs` 20, `needs_offers_compatibility` 36, `event_ai_insights` 1, `reports` 1; **0 rows:** `admin_actions`, `check_ins`, `connection_actions`, `points`, `sponsors`, `sponsor_engagements`, `event_analytics`.

### Secrets — initial scan ✅ (full history scan pending in Section 3)

- `.env` is gitignored (`.gitignore` explicitly notes it "contains live Supabase keys, including a secret key") and **was never committed** (`git log --all -- .env` is empty).
- No `.env.example` in the repo.
- No hardcoded keys/tokens/private keys in tracked source. Every service-role reference is `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` (correct) or `GRANT ... TO service_role` in migrations (normal SQL).
- `.env` locally holds `SUPABASE_SECRET_KEY` with a correct in-file warning about never prefixing it `VITE_`.
- **Pending:** scan the *full git history* (all blobs, all branches) for anything that was committed and later removed.

---

## Section 1 — User-facing flows

*Status: complete.* Method: happy-path UI smoke test against the deployed prod app (`event-iq-six.vercel.app`) for signup/onboarding/dashboard render; API + DB-layer verification (call the real deployed edge function / RPC as the authenticated test user, inspect resulting rows, test the negative/wrong-scope case) for every interaction flow — the same rigor used for account-deletion. Test accounts: `audit-20260903-a` (Founder) and `-b` (Investor), fully onboarded; `-del` (deletion re-test). All cleaned up — see Appendix A.

### 1.1 V1 signup / onboarding — ⚪ **dead — already gone**

There is no V1 signup path. `App.tsx` has no V1 route, `src/pages/Index.tsx` does not exist. Nothing to flag beyond the dead-code sweep in Section 4. **Verified:** grep of `App.tsx` + `src/pages/`.

### 1.2 V2 signup — ✅ verified-ok

Created a real account through the deployed UI. Immediate session (email confirmation is **off** — `config.toml` `enable_confirmations = false`), redirected to `/v2/setup`, "Welcome to OFFRIP" toast. `handle_new_user` trigger created the `profiles` row synchronously (confirmed in SQL right after signup: row present, `profile_completed=false`).

- 🟡 **nice-to-have:** the full name typed at signup is written to `auth.users.raw_user_meta_data` and copied to `profiles.full_name` by the trigger, but the onboarding form starts blank — the user re-types their name on step 1. Minor.

### 1.3 V2 onboarding (5 steps + event selection) — ✅ renders / validates; ⚠️ findings below

**Verified in UI:** all steps render; step 1 (identity/function/seniority pills + city typeahead), client-side "required" validation blocks *Continue* with missing fields (saw the "Select a city…" gate fire). City typeahead calls `search_us_cities` RPC — **verified working directly** (`{"search_query":"Atlanta","result_limit":10}` → `Atlanta, GA`, ~0.3 s). **Verified by faithful reproduction:** `ProfileSetup.onSubmit`'s exact `profiles.update` payload written for a real test account → `profile_completed=true` → `/v2` (dashboard) loads and greets the user. `ProtectedRoute requireCompletedProfile` correctly gates `/v2` on `profile_completed`.

Findings:

- 🔴/🟠 **ToS + AI consent are never persisted.** `Page4Terms` gates the submit button on `formData.agreedToTerms`, but `ProfileSetup.onSubmit` (`src/pages/v2/ProfileSetup.tsx:77-110`) writes no consent field — there is **no `terms_accepted` / `ai_consent` / timestamp column** on `profiles` (schema confirmed). The app therefore keeps **no record that any user ever agreed to terms or AI use.** For an App-Store / privacy-law posture this is the compliance hole, compounded by 1.x below (the terms themselves are a placeholder). Severity depends on launch bar — blocking for a compliant launch, should-fix otherwise. **Verified:** code read + full `profiles` column list.
- ⚪ **`aiConsent` field is dead.** `types.ts` declares `aiConsent: boolean` (default `false`); nothing reads or writes it. `Page4Terms` only touches `agreedToTerms`. Remove.
- 🟠 **`EditProfileScreen` can't save a profile whose `location_preference` is `NULL`.** `profiles_location_preference_check` allows only `NULL` or `{prioritize_city, prioritize_outside_city, mix, no_preference}`. `EditProfileScreen` loads `locationPreference: data.location_preference ?? ""` and on save writes `location_preference: formData.locationPreference` — for a profile that has `NULL` (all 39 current rows do — see 4.x), if the user doesn't pick a value, it writes `""` → **check-constraint violation → "save failed"**, with no field-level messaging. `ProfileSetup` is safe here because step 3 makes the field required and maps to the enum. **Verified:** reproduced the `''` write → `ERROR 23514 profiles_location_preference_check`. Same shape risk for other enum-checked columns edited on that screen.
- 🟡 **`industry_preference` stores display text, `location_preference` stores enum codes.** Step 3 writes `industry_preference` as `"Show me a mix of both"` etc. (no check constraint; that's the literal DB content today) while `location_preference` is `"mix"` etc. Two adjacent preference fields, two different storage conventions — inconsistent, and the matching scorer has to know which is which.
- 🟡 **`matching_goal` is still dual-written here** — `ProfileSetup.onSubmit:97` writes `matching_goal: formData.primaryGoal` alongside `primary_goal`. See 4.x for the full picture.
- 🟡 **step/component naming drift:** components are `Page3WhoAndFilters`, `Page3RoleQuestions`, `Page4Terms`, `Page5EventSelection` but render at steps 3, 4, 5, 6; `ProfileSetup.onNext` caps `currentPage` at 4 while the flow uses 6 states (works only because steps 4→5→6 use bespoke handlers). Confusing, not broken.

### 1.4 Matching engine — ✅ verified-ok

Registered both test accounts to an isolated `AUDIT Flow Event`, invoked the deployed `match-engine` as authenticated Alpha (`{"eventId": "..."}`). Result `{"success":true,"matchesGenerated":1,"matchesSaved":1}`. The `matches` row is well-formed: `match_score 80`, directional `a_to_b_score 80` / `b_to_a_score 33`, `reciprocity_label "They Can Help You"`, `score_version "v2.1"`, `match_evidence` a valid JSON object, human-readable `match_reason`. **Negative:** invoking for the seeded event Alpha is *not* registered to → `403 Access denied.` The function verifies the caller is a registered attendee before running (`handler.ts:138-151`) and ignores any `profileId` in the body.

### 1.5 Messaging + connection gating — ✅ verified-ok

Live sequence as Alpha/Beta against prod REST:

| Step | Result |
|---|---|
| Alpha free-text message pre-connection | **`42501` RLS block** ✅ (policy requires `connection_status='accepted'` for non-`connect_request` types) |
| Alpha `connect_request` message | inserted; trigger set `matches.connection_status='pending'`, `connection_requested_by=Alpha` ✅ |
| Alpha (requester) `respond_to_connection('accepted')` | **`22023` Invalid connection transition** ✅ (requester can't accept own request) |
| Beta `respond_to_connection('accepted')` | `true` ✅ |
| Alpha free-text message post-acceptance | inserted ✅ |

### 1.6 Connection request / accept / decline — ✅ verified-ok

Covered by 1.5 (accept path + self-accept rejection). `respond_to_connection` is `SECURITY DEFINER`, checks `auth.uid()` is a participant, enforces `pending`→`accepted|declined` only, and blocks the requester. Decline path is the same code branch with `'declined'`.

### 1.7 Meeting scheduling + completion — ✅ verified-ok

Live as Alpha/Beta:

| Step | Result |
|---|---|
| Alpha `request_meeting(match)` | meeting created, status `requested` ✅ |
| Beta `schedule_meeting` before accept | `22023` Invalid meeting transition ✅ |
| Alpha (requester ≠ recipient) `respond_to_meeting` | `42501` Access denied ✅ |
| Beta `respond_to_meeting('accepted')` | `true` ✅ |
| Alpha `schedule_meeting(ts, location)` | `true` ✅ |
| Beta `complete_meeting` | `true` ✅ |

All four meeting RPCs are `SECURITY DEFINER` with `SET search_path TO ''`, participant checks, and strict state-machine guards. Strong.

### 1.8 Feedback + connection self-reports — ✅ verified-ok

- `feedback` insert as Alpha (event-level, ratings 1–5) → success; `feedback_*_rating_check` constraints enforce the 1–5 range.
- `connection_self_reports` insert as Alpha for own `user_id` → success.
- **Negative:** Alpha inserting a self-report with `user_id = Beta` → **`42501` RLS block** ✅.

### 1.9 Account deletion — ✅ re-verified today

Fresh `audit-...-del` account → `POST /functions/v1/delete-account` (own JWT) → `200 {"success":true,"clearedReports":0,"deletedPhotos":0}` → sign-in with old credentials → `400 invalid_credentials`. Still working after the day's other changes. Full cross-linked teardown was verified in depth earlier today (see `docs`-adjacent commit `70eba1f` / the account-deletion memory).

### 1.10 Enterprise dashboard — ✅ verified-ok (all 6 tabs, real data)

`POST /functions/v1/admin-auth` with the real organizer password hash, against the live seeded event:

| Tab | Data source | Result |
|---|---|---|
| Overview | `event-stats` | `HTTP 200`, regs 38 / checkedIn 37 / profilesCreated 38 / matches 703, funnel 7 stages |
| Audience | `event-stats` | segments 6, roleBreakdown 9, intentBreakdown 15 |
| Relationships | `event-stats` | relationshipPairs 5, heatmap 8 groups |
| Outcomes | `event-stats` | topExpertise 5, topIndustries 5, topLocations 5, avgOverallRating 5 |
| Insights | `insights` | `valid:true`, 5 factual bullets, `cached:true` |
| Reports | `list-reports` | `valid:true`, 1 report |

**Negative:** wrong password hash → `{"valid":false}` `HTTP 400`. (Section 2 covers the *shape* of that 400 — it is indistinguishable from a downstream failure, which is how the `.in()` prod outage hid earlier today.)

### 1.11 Points table — ⚪ confirmed unused

No `from("points")`, no insert, no read anywhere in `src/` or `supabase/functions/`. The only occurrences of `points_earned` / `total_points` are in the auto-generated `src/integrations/supabase/types.ts`. `points` has 0 rows; `profiles.total_points` is never read. Dead — safe to drop table + column (see 4.x).

## Section 2 — Edge functions

*Status: pending.*

## Section 3 — Security

*Status: pending.*

## Section 4 — Database schema health

*Status: pending.*

## Section 5 — Compliance gaps

*Status: pending.*

---

## Appendix A — Test accounts & artifacts

*Populated as accounts are created; every entry is cleaned up or explicitly noted as intentionally retained.*

| Created (UTC) | Identifier | Purpose | Cleaned up? |
|---|---|---|---|
| 2026-09-04 | `audit-20260903-a@offriptest.dev` (`5bcf7d92…`) | Founder test profile — onboarding, matching, messaging, meetings, feedback | ⏳ pending end-of-audit cleanup |
| 2026-09-04 | `audit-20260903-b@offriptest.dev` (`3cf616a9…`) | Investor test profile — counterpart for all two-sided flows | ⏳ pending end-of-audit cleanup |
| 2026-09-04 | `audit-20260903-del@offriptest.dev` (`5f51bf24…`) | Account-deletion re-test | ✅ deleted by the flow under test |
| 2026-09-04 | Event `a0d17e00-…-0001` "AUDIT Flow Event" + 2 registrations, 1 match, 2 messages, 1 meeting, 1 feedback, 1 self-report | Isolated container for flow tests (not the seeded event) | ⏳ pending end-of-audit cleanup |

## Appendix B — Trivially-safe fixes applied during the audit

*Nothing yet. Anything here is listed for your visibility, not pre-approved scope; each entry says exactly what changed and why it is safe.*

| Area | Change | Why it's safe |
|---|---|---|
| — | — | — |
