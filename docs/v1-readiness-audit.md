# V1 Readiness Audit

**Status:** ✅ complete — all six sections done. Written and committed section-by-section (commits `6106ee6` → `4626086` → `bd0969e` → `b0717e5` → `d913c53` → this one) against a running audit, not in one dump.

**Method:** Discovery + documentation only. **Nothing was fixed.** Every "broken" / "working" claim is backed by an actual test; the verification method is stated per finding. [Appendix B](#appendix-b--trivially-safe-fixes-applied-during-the-audit) is intentionally empty — no code was changed.

**Environment:** Production Supabase project `qdknsjoddmrvwjrrwwiq` ("Event IQ"), deployed app `event-iq-six.vercel.app`. All destructive testing used throwaway `audit-20260903-*@offriptest.dev` accounts + one isolated test event; the 83 real `auth.users` and their data were never touched. **All test artifacts cleaned up — baseline restored and re-verified** (see [Appendix A](#appendix-a--test-accounts--artifacts)).

**Severity legend:** 🔴 blocking · 🟠 should-fix · 🟡 nice-to-have · ⚪ dead-code · ✅ verified-ok

---

## Findings index

### 🔴 Blocking (for a compliant public launch)

| # | Finding | §|
|---|---|---|
| B1 | **No Privacy Policy exists** at all (menu item is `disabled`, no route, no document). App collects name/email/employer/title/LinkedIn/location/interests/messages and sends data to OpenAI. | 5.3 |
| B2 | **Terms of Service is a "Coming Soon" placeholder** — but onboarding forces a checkbox agreeing to it. | 5.1 |
| B3 | **Consent is never recorded** — no `terms_accepted`/`ai_consent` column; no timestamp; no version. No proof any user agreed. | 1.3 / 5.1 |

*(B1–B3 are only "blocking" against a real-users / App-Store bar. If the near-term goal is continued controlled testing, they drop to should-fix — but they gate launch.)*

### 🟠 Should-fix

| # | Finding | §|
|---|---|---|
| S1 | `reports` table is **world-readable, including by anonymous users** (`SELECT` policy `true` for PUBLIC) — verified live: an unauthenticated request returned the full `executive_summary`. Aggregate data, but it's an event's private analytics on the open internet. | 3.2 / 3.4 |
| S2 | `feedback` table is **readable by every authenticated user** (`SELECT true`) — verified live: a test user read another user's feedback incl. free-text fields. | 3.2 / 3.4 |
| S3 | **`admin-gen-link`** — a deployed, `verify_jwt:false`, **not-in-the-repo** edge function that mints a service-role magic-link (full sign-in) for an allowlisted real address, gated only by one shared static secret. Delete it or harden + version it. | 2.5 |
| S4 | `admin-auth` posture: `Access-Control-Allow-Origin: *` to any origin (verified), a single static shared password with no rotation/rate-limit/lockout, and a catch-all that returns the same `{valid:false}` shape for downstream errors as for auth failure (the pattern behind today's `.in()` outage). | 2.2 / 3.5 |
| S5 | `profiles` UPDATE policy has **no `WITH CHECK`** → `UPDATE profiles SET id='<other>'` isn't blocked by RLS; exploitable against the ~44 `auth.users` that have no profile row. | 3.2 |
| S6 | `attendee_profiles` + `matched_event_attendance` are **`SECURITY DEFINER` views** (Supabase advisor: ERROR) — they bypass the caller's RLS; only their own WHERE clause contains them. Recreate as `security_invoker`. | 3.3 |
| S7 | **Email verification is disabled** in prod (`enable_confirmations = false`). | 3.6 / 5.4 |
| S8 | `EditProfileScreen` **cannot save** a profile whose `location_preference` is `NULL` (all 39 current rows) unless the user picks a value — writes `""` → check-constraint violation → generic "save failed". | 1.3 |
| S9 | Over-permissive INSERT policies on `points` (`WITH CHECK true`), `sponsors` (`FOR ALL` any authed), `events` (`organizer_id` not forced to `auth.uid()`), `reports` (INSERT not organizer-checked). Mostly on dead tables. | 3.2 |
| S10 | **`matching_goal` is not fully resolved** — still dual-written in 2 places, fallback-read in 6, and in the `attendee_profiles` view. | 4.2 |
| S11 | No path to **delete an organizer/admin account** (`events.organizer_id` NO ACTION; `delete-account` blocks it; no reassignment tooling). | 1.3 / 4.3 |

### 🟡 Nice-to-have

Leaked-password protection off (3.6); `config.toml` only lists 2 of 6 functions (2.0); `handle_new_user`/`rls_auto_enable`/`search_us_cities` exposed to `anon` via `/rpc/` (3.3); CORS allow-lists exclude Vercel preview URLs (3.5); `areas_of_expertise` is an exact copy of `offers` (4.2); `matches` has redundant scoring columns (4.2); `profiles.location` vs `location_city`/`state_code` redundancy (4.2); onboarding step/component naming drift (1.3); signup name not carried into onboarding (1.2); no data-export / "right to access" path (5.4); anon can write junk to 3 dead telemetry tables (3.2).

### ⚪ Dead / safe to remove

- **V1:** already gone — no `src/pages/Index.tsx`, no V1 routes. Nothing to remove. (1.1)
- **Tables (8):** `points`, `check_ins`, `admin_actions`, `connection_actions`, `event_analytics`, `sponsors`, `sponsor_engagements`, `needs_offers_compatibility`. (4.1)
- **Columns:** `profiles` — `total_points`, `festivals`, `activities`, `travel_interests`, `sports`, `funding_raised`, `check_size`, `investment_stage`, `open_roles`, `hiring_priorities`, `candidate_level`, `company_stage`; `meetings` — `calendar_export_token`, `meeting_notes`, `proposed_time`; `feedback` — `would_return`. (4.2)
- **Field:** `ProfileSetupFormData.aiConsent` (declared, never used). (1.3)
- **Function:** `admin-run-matching` — committed today, not deployed; its own header says delete after the v2.1 backfill. (2.6)

### ✅ Verified working (headline)

V2 signup + onboarding render/validate/submit; matching engine; messaging with connection-gating; connection accept/decline; full meeting lifecycle; feedback + self-reports; account deletion (re-verified); all 6 enterprise dashboard tabs on real data. Core relationship data (profiles/matches/messages/meetings/notifications) is correctly per-user-scoped with all writes funnelled through guarded `SECURITY DEFINER` RPCs — every negative case tested. No secrets in the codebase or git history.

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

*Status: complete.* Verified against the deployed function list (`list_edge_functions`), each function's source, live CORS preflights from prod + a foreign origin, and live auth-boundary probes.

### 2.0 Inventory — **6 functions deployed, repo tracks 5, config.toml lists 2**

| Function | Deployed | `verify_jwt` | In repo | In `config.toml` | Verdict |
|---|---|---|---|---|---|
| `match-engine` | v22 | `true` | ✅ | ❌ (relies on platform default `true`) | ✅ ok |
| `admin-auth` | v21 | **`false`** | ✅ | ✅ (`false`, deliberate) | ⚠️ see 2.2 |
| `concierge` | v14 | `true` | ✅ | ✅ (`true`) | ✅ ok |
| `delete-account` | v1 | `true` | ✅ | ✅ (`true`) | ✅ ok |
| **`admin-gen-link`** | **v4** | **`false`** | **❌ not in repo** | **❌** | 🟠 see 2.5 |
| `admin-run-matching` | **not deployed** | n/a | ✅ (committed `8cc4eb1` today) | ❌ | see 2.6 |

- 🟡 **`config.toml` is not the source of truth.** It lists only `admin-auth` and `concierge`. `match-engine` and `delete-account` are `verify_jwt:true` only because that's the platform default; a future `supabase functions deploy` from a machine with a stale/rewritten config could silently flip them. Add explicit entries for every function.

### 2.1 `match-engine` — ✅ ok

`verify_jwt:true`; own `Bearer` → `getUser`; **authorizes** the caller is a registered attendee of `eventId` (403 otherwise — verified live); ignores any `profileId` in the body ("never read or trusted"); body-size caps (4 KB, 413); generic error strings + `console.error` on every failure path (no silent swallow); CORS = origin allow-list, reflects the prod origin (verified). Runs the write with the service-role key. No issues.

### 2.2 `admin-auth` — ⚠️ should-fix items (function works; posture is thin)

`verify_jwt:false` is **deliberate and defensible** — the enterprise dashboard has no user session; it is gated by a shared organizer password. The client SHA-256-hashes the password and sends only the hash; the function `secureEqual`-compares it against `sha256(OOO_ADMIN_PASSWORD)`. Live: correct hash → data; wrong hash → `{"valid":false}` `200`.

- 🟠 **`Access-Control-Allow-Origin: *`.** Verified live: `admin-auth` returns `ACAO: *` to `https://evil.example.com`. Every other function uses an origin allow-list. Because there is no cookie/session auth this isn't classic CSRF, but it means the password hash is the *entire* boundary and any web page anywhere can submit guesses. Tighten to the known origins.
- 🟠 **The shared password is the whole security model** — one static credential, no rotation, no per-request rate limit, no lockout. It sits in `localStorage` on every organizer's browser and rides every request. A leak or a weak password = full read of all event analytics + AI generation + `create-report`. (`create-report` writes rows; `generated_by` is null so no data-integrity risk, but it's an unauthenticated-user write path.)
- 🟠 **Silent-failure shape (the bug pattern that caused today's outage).** The top-level `catch` returns `json({ valid: false }, 400)` for *any* thrown error — a bad query, a PostgREST limit, OpenAI being down. The body is byte-identical to an auth failure; only the status differs (`400` vs `200`), which the client UI does not distinguish. This is exactly how the 703-id `.in()` outage hid for three deploys. Mitigations already in place: a `console.error` in the catch (added today) and per-action graceful handling for `insights`/`copilot`/`create-report` (they return specific error codes like `generation_failed`). Still unmitigated for `event-stats` and `list-reports`, which throw straight to the catch-all. Recommend: distinct error codes + non-`valid:false` bodies for downstream failures.
- 🟡 exposure check: every action requires the password; nothing is reachable unauthenticated. `event-stats` returns aggregate analytics only (no PII rows). OK.

### 2.3 `concierge` — ✅ ok

`verify_jwt:true`; own `Bearer` → `getUser`; **authorizes** the caller is `status='registered'` for the requested `eventId` (403 otherwise); thorough input validation (`validateConciergeRequest` — question ≤1000 chars, history caps, UUID checks, timezone validated via `Intl`); CORS origin allow-list — **verified live** that it reflects `https://event-iq-six.vercel.app` (so `CONCIERGE_ALLOWED_ORIGINS` is set in prod). Specific error messages, `console.error` on failures. The model only ever receives pre-aggregated context, not raw rows. No issues. 🟡 minor: Vercel *preview* deployment URLs (random subdomains) would be CORS-rejected — only the prod alias is allow-listed.

### 2.4 `delete-account` — ✅ ok

Covered in depth by today's account-deletion work. `verify_jwt:true`; deletes only `auth.uid()`; organizer 409-block; `console.error` in catch; CORS origin allow-list (verified live). No issues.

### 2.5 `admin-gen-link` — 🟠 undocumented account-takeover primitive in production

**Not in the repo, not in `config.toml`, not referenced by any code.** Retrieved its source via the API. It is 30 lines: `POST {email, secret}` → if `secret === ADMIN_LINK_SECRET` **and** `email` is in a hardcoded 4-entry allowlist (`chanise@oooevents.org` + three `offrip.loadtest.*@example.com`), it calls the **service-role `auth.admin.generateLink({type:"magiclink"})`** and returns the `action_link`. That link is a full sign-in for that account.

- Security rests **entirely** on `ADMIN_LINK_SECRET` (a shared static string) staying secret. No `verify_jwt`, no rate limit. Live probe: wrong secret → `403 {"error":"forbidden"}` (works), but it *is* reachable with no `apikey` and no JWT.
- `redirectTo` is hardcoded `http://localhost:8080/` → this is clearly a dev/QA login helper, but the token it mints is valid regardless of redirect.
- `chanise@oooevents.org` is a real-looking `@oooevents.org` address; if that account has organizer/admin capability, a leak of `ADMIN_LINK_SECRET` is account takeover of a privileged user.
- `catch (e) { ... String(e) }` leaks raw error text to the caller.
- **Recommendation:** if the load testing that motivated it is done, **delete the function**. If it must stay, move the source into the repo, drop the three `loadtest` allowlist entries, fix `redirectTo`, and consider `verify_jwt:true` + an allow-listed caller instead of a shared secret.

### 2.6 `admin-run-matching` — not deployed; do not deploy without review

Committed today (`8cc4eb1`) but **not deployed** → inert in prod. Source review: it *does* authenticate (`Bearer` → `getUser` → `ADMIN_ALLOWLIST.has(user.id)` of two hardcoded UUIDs → 403), and it accepts an arbitrary `profileId` by design (an operator regenerating other users' matches). Acceptable as a gated one-off. Its own header says delete it after the v2.1 backfill. 🟡 If it is ever deployed: confirm the two allowlisted UUIDs are current admin accounts and add a `config.toml` entry.

## Section 3 — Security

*Status: complete.* Method: full `pg_policy` dump analysed table-by-table; Supabase security advisor; **live auth-boundary probes** as an authenticated test user and as anon against prod REST; full git-history secret scan (every blob, every branch); client-bundle inspection.

### 3.1 Secrets — ✅ clean

- **No `.env*` file was ever committed** on any branch (`git log --all --diff-filter=A` empty).
- **Full-history blob scan** for `sb_secret_*`, service-role JWTs, `sk-`/`sk-proj-` OpenAI keys, `ADMIN_LINK_SECRET=`, `OOO_ADMIN_PASSWORD=`, PEM private keys → **zero hits** across all objects and branches.
- No file ever named `*.pem` / `*.key` / `*secret*` / `*credential*`.
- Client code reads only `import.meta.env.VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `import.meta.env.DEV`. No `SERVICE_ROLE` / `SUPABASE_SECRET_KEY` reference anywhere in `src/`.
- Deployed JS bundle (`event-iq-six.vercel.app`) contains no `sb_secret_`, `service_role`, or `sk-proj-` strings — only the publishable (anon) key, which is designed to be public.
- `.gitignore` is deliberate and correct (comments call out that `.env` "contains live Supabase keys, including a secret key").
- 🟡 the two secrets that gate admin surfaces — `OOO_ADMIN_PASSWORD` (enterprise dashboard) and `ADMIN_LINK_SECRET` (`admin-gen-link`) — are static shared strings with no rotation. Not leaked; just fragile single credentials. See 2.2 / 2.5.

### 3.2 RLS — table by table

RLS is **enabled on all 23 tables**. Findings:

| Table | Posture | Finding |
|---|---|---|
| `profiles` | SELECT/INSERT own only; other profiles via the `attendee_profiles` view | 🟠 **UPDATE policy has `USING (auth.uid()=id)` but NO `WITH CHECK`.** The new row is unchecked, so `UPDATE profiles SET id='<other-uuid>' WHERE id=auth.uid()` is not blocked by RLS. PK/FK stop it *if* the target already has a profile row — but ~44 `auth.users` have **no** profile row (see 4.x), so an attacker could move their profile onto one of those identity slots. Add `WITH CHECK (auth.uid() = id)`. |
| `feedback` | INSERT `auth.uid()=user_id` ✅ | 🟠 **SELECT policy is `true` for every authenticated user.** Live-confirmed: a signed-in test user read another user's `feedback` row. `highlights` / `improvements` are free-text. Scope to `user_id = auth.uid()` (+ event organizer). |
| `reports` | INSERT `auth.uid()=generated_by` | 🟠 **SELECT policy is `true` for role `{}` (PUBLIC).** Live-confirmed: **an unauthenticated request read the full `executive_summary`.** Content is aggregate (no PII rows), but it is an event's private analytics readable by the entire internet. Also INSERT isn't organizer-checked — any signed-in user can create `reports` rows with an attacker-controlled `raw_metrics` jsonb. |
| `points` | SELECT own ✅ | 🟠 **INSERT `WITH CHECK (true)`** — any authenticated user can insert points rows for anyone. Moot only because the table is dead (4.x); fix or drop. |
| `sponsors` | SELECT PUBLIC `true` | 🟠 **`FOR ALL` to any authenticated user** (`auth.uid() IS NOT NULL`) — any signed-in user can insert/update/**delete** any sponsor row. Dead feature (0 rows); drop the table or replace the policy. |
| `sponsor_engagements` | INSERT own ✅ | 🟡 SELECT `true` for authenticated — reads all rows. Dead feature. |
| `events` | SELECT published-or-own ✅; manage own ✅ | 🟡 **INSERT `WITH CHECK (auth.uid() IS NOT NULL)`** — any signed-in user can create an event, and `organizer_id` isn't forced to `auth.uid()`. No UI exposes this; still an unbounded write. |
| `admin_actions`, `connection_actions`, `event_analytics` | INSERT for `anon`+`authenticated`, only length/enum checks; no SELECT policy | 🟡 **anon can write junk rows** to all three, no rate limit. All are dead telemetry tables (0 rows, no code reads or writes them — 4.x). Drop them. |
| `check_ins`, `connection_notes`, `connection_self_reports`, `event_registrations`, `match_actions` | own-row scoped, participant-checked on the two connection tables | ✅ correct |
| `matches`, `meetings`, `messages`, `notifications` | SELECT restricted to participants; **no client INSERT/UPDATE/DELETE** — all mutations go through guarded SECURITY DEFINER RPCs | ✅ correct (live-verified — a signed-in user sees only their own match / thread / notifications) |
| `concierge_logs`, `event_ai_insights`, `needs_offers_compatibility`, `us_cities` | RLS on, **0 policies** = deny-all to client; access only via service role or a SECURITY DEFINER RPC | ✅ intentional (advisor flags as INFO only). `concierge_logs` also has no `GRANT` to `authenticated` — belt and braces. |

### 3.3 SECURITY DEFINER surface (from the Supabase advisor + source review)

- 🟠 **`attendee_profiles` and `matched_event_attendance` are `SECURITY DEFINER` views** (advisor level **ERROR**). They run as the superuser and **bypass the querying user's RLS**; only their own `WHERE` clause (`id = auth.uid() OR EXISTS shared-match`) contains them. Live-verified the WHERE clause currently works (a test user saw only their own profile + shared-match profiles, and `email`/`linkedin_url` are not in the view's column list). But the pattern is brittle — recreate with `security_invoker = true`. `attendee_profiles` is load-bearing (every matches / messages / profile-view screen depends on it), so this needs care, not just a flip.
- ✅ **The 8 meeting/connection/notification RPCs are SECURITY DEFINER by necessity and are correctly guarded** — every one checks `auth.uid() IS NOT NULL`, checks the caller is a participant of the target row, enforces the state machine, and sets `search_path = ''`. Live-verified the negative cases (non-recipient responding, requester self-accepting, wrong-state transitions all rejected). The advisor lists them as WARN informationally; reviewed and acceptable.
- 🟡 **`handle_new_user()` and `rls_auto_enable()` are exposed at `/rest/v1/rpc/` to `anon`+`authenticated`** (advisor WARN). Both are trigger/maintenance functions that should never be called directly. `REVOKE EXECUTE ... FROM anon, authenticated` (keep the trigger binding).
- 🟡 **`search_us_cities` is `anon`-executable** but the only caller is the onboarding form, which is behind `ProtectedRoute`. Tighten to `authenticated`.

### 3.4 Auth boundary — live probe results

| Probe (as authenticated test user unless noted) | Result |
|---|---|
| Read another user's `profiles` row directly | `[]` ✅ |
| Read `matches` — how many of 718 visible | 1 (only own) ✅ |
| Read `concierge_logs` | `42501 permission denied` ✅ |
| `connection_self_reports` insert with `user_id` = another user | `42501` RLS block ✅ |
| `respond_to_meeting` as the requester (not recipient) | `42501 Access denied` ✅ |
| `messages` free-text insert before `connection_status='accepted'` | `42501` RLS block ✅ |
| `match-engine` for an event the caller isn't registered to | `403 Access denied` ✅ |
| **Read all `feedback`** | **rows returned — over-share** 🟠 |
| **Read all `reports` with no auth at all (anon)** | **rows returned — public leak** 🟠 |
| Anon read `profiles` | `42501` ✅ |
| Anon read `feedback` | `[]` ✅ |

**Verdict:** the core relationship data (profiles, matches, messages, meetings, notifications, connection notes/reports) is correctly walled off per-user, and the write paths are all funnelled through guarded RPCs. The boundary breaks are `feedback` (any signed-in user) and `reports` (the whole internet), plus the `profiles` UPDATE `WITH CHECK` gap and the SECURITY DEFINER views.

### 3.5 CORS (per-function, live-verified)

| Function | `Access-Control-Allow-Origin` | Verdict |
|---|---|---|
| `concierge` | reflects `https://event-iq-six.vercel.app`; foreign origin gets none | ✅ |
| `delete-account` | reflects the prod origin | ✅ |
| `match-engine` | reflects the prod origin | ✅ |
| `admin-auth` | **`*`** — returned `*` to `https://evil.example.com` | 🟠 tighten to an allow-list |
| `admin-gen-link` | no CORS headers (not browser-called) | n/a |

🟡 None of the allow-lists include Vercel *preview* URLs, so preview deployments can't call `concierge`/`match-engine`/`delete-account`.

### 3.6 Auth configuration

- 🟡 **Leaked-password protection is disabled** (advisor WARN) — enable the HaveIBeenPwned check in Auth settings.
- 🟡 `minimum_password_length = 8`, `otp_length = 8`. 8 is the floor; consider 10–12.
- `enable_confirmations = false` — email verification is **off** (a `config.toml` comment marks it "Temporary V1 testing behavior; restore once production SMTP is configured"). 🟠 for launch: anyone can sign up with an email they don't control and reach the full app. Tied to compliance (Section 5) and to the ToS/consent gap.

## Section 4 — Database schema health

*Status: complete.* Method: every table name grepped across `src/` + `supabase/functions/` (excluding generated `types.ts` and tests); RPC bodies read to catch indirect use; every FK's `ON DELETE` action dumped; suspect columns grepped individually.

### 4.1 Dead / orphaned tables — ⚪ safe to drop

| Table | Rows | Why it's dead |
|---|---|---|
| `points` | 0 | No `from("points")` anywhere; check-in/gamification never shipped. `profiles.total_points` also unread. |
| `check_ins` | 0 | Check-in state actually lives on `event_registrations.is_checked_in` (that's what `get_event_attendance_counts` and `event-stats` read). This table — with its own `status` enum — has no reader. **Duplicate-purpose, lost to `event_registrations.is_checked_in`.** |
| `admin_actions` | 0 | "Visitors can record dashboard actions" — no code writes or reads it. `anon` INSERT policy. |
| `connection_actions` | 0 | Same — orphan telemetry with an `anon` INSERT policy. |
| `event_analytics` | 0 | Same — orphan telemetry with an `anon` INSERT policy. |
| `sponsors` | 0 | Sponsor feature never built. Over-permissive `FOR ALL` policy (3.2). |
| `sponsor_engagements` | 0 | Same. |
| `needs_offers_compatibility` | 36 | **Has seed data but no reader** — referenced only in its own migration + generated types. The match scorer computes needs↔offers fit with its own logic and never consults this lookup. Either wire it into the scorer or drop it. |

`us_cities` (5 389 rows) looks unreferenced by the same grep but is **live** — reached through the `search_us_cities` SECURITY DEFINER RPC. Not dead.

**Live tables (14):** `profiles`, `events`, `event_registrations`, `matches`, `messages`, `meetings`, `match_actions`, `notifications`, `connection_notes`, `connection_self_reports`, `feedback`, `reports`, `event_ai_insights`, `concierge_logs`.

### 4.2 Dead / redundant columns

**`profiles` — 12 columns with zero code references** (only in generated types):
`total_points`, `festivals`, `activities`, `travel_interests`, `sports`, `funding_raised`, `check_size`, `investment_stage`, `open_roles`, `hiring_priorities`, `candidate_level`, `company_stage`.
Most are role-specific (investor / recruiter) fields that were superseded by the `role_details` jsonb blob. ⚪/🟡 — drop, or consciously decide to keep for a future feature.

**`meetings` — dead columns:** `calendar_export_token`, `meeting_notes`, `proposed_time` (the flow uses `scheduled_at`) — 0 references. **`feedback.would_return`** — 0 references (nothing reads it).

**Two-fields-one-job situations:**

- 🟠 **`matching_goal` vs `primary_goal` — NOT fully resolved.** The earlier "goal field standardization" made the *edge-function reads* prefer `primary_goal`, but:
  - **still dual-written:** `ProfileSetup.onSubmit:97` and `EditProfileScreen.tsx:120` both write `matching_goal: formData.primaryGoal` alongside `primary_goal`.
  - **still fallback-read in 6 places:** `match-engine/scorer.ts` (×3 lines), `admin-run-matching/scorer.ts` (×3), `concierge/context.ts` (×2), `EditProfileScreen.tsx:66` — all `primary_goal ?? matching_goal`.
  - **still in the `attendee_profiles` view** (`20260821010000_secure_profile_reads.sql:33`).
  - Fully resolving means: drop the 2 writes → drop the 6 fallback reads → remove from the view → drop the column. Internally consistent today (both are written to the same value), so not urgent, but it is unfinished.
- 🟡 **`areas_of_expertise` is an exact copy of `offers`.** Both `ProfileSetup.tsx:96` and `EditProfileScreen.tsx:119` write `areas_of_expertise: formData.offers`. Two columns, always identical. `FullProfileView` / `matchDetail` read `areas_of_expertise`; the scorer reads `offers`. Same pattern as `matching_goal`.
- 🟡 **`profiles.location` (display string) vs `location_city` + `location_state_code` (structured).** Three columns for one concept; `location` is written as `"Atlanta, GA"` while the structured pair is written from the city picker. The scorer prefers the structured pair. Redundant but low-risk.
- 🟡 **`matches` has accumulated overlapping scoring columns across rubric v1 → v2 → v2.1:** `match_score` (largely superseded by `a_to_b_score`/`b_to_a_score`), and three JSON columns `score_breakdown` / `match_details` / `match_evidence` that serve similar "why this match" purposes. Not untangled here — flagging that the table is due for a scoring-column consolidation.

### 4.3 Foreign-key integrity — the `NO ACTION` landmines

Complete list of `ON DELETE NO ACTION` / `RESTRICT` FKs (there are exactly 4):

| Child → Parent | Status |
|---|---|
| `events.organizer_id → profiles` | ⚠️ **handled only in `delete-account`** (blocks an organizer from self-deleting). There is still **no path to delete an organizer/admin account** and no event-reassignment tooling. Flagged in Section 1.3 / the account-deletion memo. |
| `reports.generated_by → profiles` | ✅ handled — `delete-account` nulls it before deleting. (All rows currently have `generated_by = NULL` anyway.) |
| `matches.connection_requested_by → profiles` | ✅ handled — verified 0 rows point to a non-participant, so the match's own `CASCADE` clears it in the same statement. |
| `points.event_id → events` | ⚪ **unhandled**, but `points` is dead (4.1). Deleting an `event` with `points` rows would throw; there are 0 such rows. Resolves itself when `points` is dropped. |

No *other* landmines exist — every remaining user-data FK is `ON DELETE CASCADE` (confirmed in the account-deletion discovery and re-confirmed here). So the account-deletion audit was complete on this point.

### 4.4 Migrations

42 migrations, all forward, consistent `YYYYMMDD…` naming. The bulk of the dead tables (`sponsors`, `points`, `event_analytics`, …) trace to the initial scaffold migration `20260624020108_9dce6e02-…`. No reverts or no-op migrations of concern.

## Section 5 — Compliance gaps

*Status: complete.* Method: grep of the whole app for ToS / privacy / cookie / GDPR / CCPA / AI-disclosure strings and routes; inspection of `Page4Terms`, the account menu, the landing footer, and `public/`.

### 5.1 Terms of Service — 🔴 placeholder only

- `Page4Terms.tsx` renders the literal text **"Terms of Service — Coming Soon"** with `{/* TODO: Replace with real terms URL when available */}`.
- **No ToS document exists** — no `/terms` route, no file in `public/`, no external URL.
- Yet the onboarding checkbox users must tick reads *"I agree to the Terms of Service and consent to the use of AI-powered features within OFFRIP."* — an agreement to a document that does not exist.
- And (Section 1.3) **the tick is never persisted** — no `terms_accepted` column, no timestamp, no version. There is no record any user ever agreed.

### 5.2 AI-use disclosure — 🟠 partial

- **In-product disclosure exists:** the `Page4Terms` "AI Consent" card explains *"OFFRIP uses artificial intelligence to power match recommendations, conversation starters, and event insights,"* and the enterprise `InsightsTab` header says "AI-generated intelligence from {event}".
- **Gaps:** the *"Learn more about how we use AI — Coming Soon"* link is a placeholder (no AI-use policy page); the consent is bundled into the same unticked-by-default checkbox as ToS and is **not recorded**; there is no disclosure of *which* provider (OpenAI) processes the data, what data is sent (the code is careful to send only aggregates for insights, and profile/match context for concierge — but this isn't disclosed to users), or a way to opt out of AI features while still using the app.

### 5.3 Privacy Policy — 🔴 does not exist

- The only reference is a **`disabled` "Privacy Policy" menu item** in the dashboard account dropdown (`Dashboard.tsx:261`). It links nowhere.
- No `/privacy` route, no document in `public/`, no footer link on the landing page (`Landing.tsx` footer is just the copyright line).
- For an app that collects name, email, employer, job title, LinkedIn, location, detailed professional interests, and free-text messages/notes, and runs that data through a third-party AI provider, the absence of a privacy policy is a launch blocker in essentially every jurisdiction (GDPR, CCPA/CPRA, and the Apple App Store's own review guideline 5.1.1(i), which requires a privacy policy link).

### 5.4 Related gaps (cross-referenced)

- 🟠 **Email verification is disabled** (`config.toml` `enable_confirmations = false`, marked "temporary V1 testing behavior"). Users can register with addresses they don't control. Restore before launch.
- 🟡 **No cookie/analytics consent** — currently moot (the only cookie is the shadcn `sidebar:state` UI cookie; the `event_analytics` telemetry table is dead), but the moment any analytics/marketing script is added, a consent mechanism is needed for EU/UK visitors.
- 🟡 **Account deletion (shipped today) partially satisfies the "right to erasure"** — good — but there is **no data-export / "right to access" path**, and (Section 4.3) organizer accounts cannot be deleted at all.
- 🟡 **Leaked-password protection is off** (Section 3.6) — not strictly compliance, but part of a defensible "reasonable security measures" posture.

### 5.5 What exists and is fine

- Account deletion is real, self-serve, and verified (Section 1.9) — this is the hardest erasure requirement and it's done.
- The AI pipeline is built to minimise data exposure (aggregates only for insights; no raw DB rows to the model) — the engineering is privacy-conscious even though the *disclosure* isn't written.
- No third-party trackers, no ad SDKs, no data sold.

---

## Appendix A — Test accounts & artifacts

*Populated as accounts are created; every entry is cleaned up or explicitly noted as intentionally retained.*

| Created (UTC) | Identifier | Purpose | Cleaned up? |
|---|---|---|---|
| 2026-09-04 | `audit-20260903-a@offriptest.dev` (`5bcf7d92…`) | Founder test profile — onboarding, matching, messaging, meetings, feedback | ✅ deleted (auth.users + cascade) |
| 2026-09-04 | `audit-20260903-b@offriptest.dev` (`3cf616a9…`) | Investor test profile — counterpart for all two-sided flows | ✅ deleted (auth.users + cascade) |
| 2026-09-04 | `audit-20260903-del@offriptest.dev` (`5f51bf24…`) | Account-deletion re-test | ✅ deleted by the flow under test |
| 2026-09-04 | Event `a0d17e00-…-0001` "AUDIT Flow Event" + 2 registrations, 1 match, 2 messages, 1 meeting, 1 feedback, 1 self-report | Isolated container for flow tests (not the seeded event) | ✅ deleted (event + child cascade) |

**Post-cleanup baseline re-verified:** `auth.users` 83, `profiles` 39, `events` 2, `matches` 718, `messages` 19, `meetings` 6, `feedback` 1, `connection_self_reports` 2, `reports` 1 (`generated_by` null) — all identical to the pre-audit counts. `leftover_audit_users` = 0. No edge functions were deployed during the audit.

## Appendix B — Trivially-safe fixes applied during the audit

**None.** This pass changed no application code, schema, RLS, or edge functions. The only writes to the database were the creation and subsequent full deletion of the `audit-*` test accounts / test event described in Appendix A. Every finding above is left for your review and approval before any fix.
