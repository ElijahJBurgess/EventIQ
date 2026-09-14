# Edge Functions

Deno TypeScript functions deployed on Supabase. All live in `supabase/functions/`.

---

## Deploy Note — Read This First

The Supabase CLI account currently wired to this project **lacks deploy privileges** (returns 403 on `supabase functions deploy` and `npm run generate-types`). Every function deploy in this project's history has gone through the **Supabase MCP `deploy_edge_function` tool**, passing the function's files inline.

To restore normal CLI deploys, a project owner/admin needs to grant that access in the Supabase dashboard, or run deploys themselves.

---

## Function Reference

### `match-engine`
**Purpose:** Generate match scores for all attendees at an event.

**Auth:** `verify_jwt = true` — requires a valid user session.

**How it works:**
1. Receives an `event_id`
2. Fetches all registered profiles for that event
3. Runs the directional scoring algorithm for every pair
4. Upserts results into `matches` with canonical pair ordering
5. Returns match count and score distribution

**When it runs:**
- Automatically on profile completion (triggered by the client after the user finishes onboarding and joins an event)
- Manually via the owner dashboard

**Secrets needed:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)

---

### `concierge`
**Purpose:** Platform-wide AI Q&A. Answers natural language questions about the caller's matches across all events they've participated in.

**Auth:** `verify_jwt = true`

**How it works:**
1. Receives a natural language query
2. Fetches the caller's matches (RLS-scoped, top 50 by score)
3. Sends query + match context to OpenAI
4. Returns a natural language answer with referenced match IDs
5. Logs the interaction to `concierge_logs` (telemetry only, no personally identifying content)

**Platform-wide:** Takes no `eventId`. The caller's matches from all events are included. No check-in requirement.

**Dormant path:** Contains code to score a named unmatched person, but this requires an event roster that the platform-wide flow doesn't carry. Code is present but not reachable in normal use.

**Secrets needed:** `OOO_Intellegence_Open_API_Key`, optionally `CONCIERGE_OPENAI_MODEL`, `CONCIERGE_ALLOWED_ORIGINS`

---

### `admin-auth`
**Purpose:** Enterprise dashboard data, AI insights, report CRUD, and owner-only room creation.

**Auth:** `verify_jwt = false` — gated by a shared organizer password (`OOO_ADMIN_PASSWORD`), not a JWT. Sessions last 72 hours, stored in `localStorage`.

**Actions:**
| Action | What it does |
|---|---|
| `event-stats` | Returns aggregate stats for all events |
| `list-events` | Returns all events with management data |
| `update-event` | Update event name, venue, location, published status |
| `set-event-published` | Publish or unpublish an event |
| `event-deletion-impact` | Count cascades before deleting |
| `delete-event` | Delete an event and all its cascades |
| `create-event` | Create a new event (owner-only) |
| `list-reports` | List generated PDF reports |
| `ai-insights` | Generate or return cached AI insights for an event |

**Security note:** This function uses a single static shared password. There is no per-user audit trail. This is not production-grade security — see `docs/KNOWN_ISSUES.md`.

**Secrets needed:** `OOO_ADMIN_PASSWORD`, `OOO_Intellegence_Open_API_Key`, optionally `ADMIN_AUTH_ALLOWED_ORIGINS`, `ADMIN_AUTH_OPENAI_MODEL`

---

### `delete-account`
**Purpose:** Self-serve account deletion for App Store / privacy compliance.

**Auth:** `verify_jwt = true`

**What it deletes:**
- The caller's `auth.users` row (cascades to `profiles` and all related data)
- The caller's profile photo from Storage
- Nothing belonging to other users

**Secrets needed:** `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)

---

### `admin-run-matching` (Not Deployed)
**Purpose:** One-off operator utility for backfilling matches. Written as a tool to re-run the matching engine against all profiles for an event when needed outside the normal flow.

**Status:** Never deployed. Exists in `supabase/functions/` as a reference. Delete after use if deployed.

---

### `admin-gen-link` (Decommissioned)
**Status:** Decommissioned. Returns `410 Gone`. The function slug still exists in the Supabase dashboard and should be deleted there.

---

## Secrets Reference

Set all secrets in Supabase Dashboard → Edge Functions → Secrets.

| Secret | Auto-injected | Required | Used by |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | Yes | All functions |
| `SUPABASE_ANON_KEY` | ✅ | Yes | All functions |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Yes | match-engine, delete-account, admin-auth |
| `OOO_ADMIN_PASSWORD` | ❌ | Yes | admin-auth |
| `OOO_Intellegence_Open_API_Key` | ❌ | Yes | concierge, admin-auth |
| `CONCIERGE_ALLOWED_ORIGINS` | ❌ | Optional | concierge (CORS) |
| `CONCIERGE_OPENAI_MODEL` | ❌ | Optional | concierge |
| `ADMIN_AUTH_ALLOWED_ORIGINS` | ❌ | Optional | admin-auth (CORS) |
| `ADMIN_AUTH_OPENAI_MODEL` | ❌ | Optional | admin-auth |

---

## `verify_jwt` Settings

Configured in `supabase/config.toml`. Currently only 3 functions are listed there — the others rely on the deploy-time default (true).

| Function | `verify_jwt` |
|---|---|
| `match-engine` | true |
| `concierge` | true |
| `delete-account` | true |
| `admin-auth` | **false** — password-gated internally |
