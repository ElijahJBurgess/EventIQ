# Schema History

Migration-by-migration evolution of the database. Every structural change to the schema is documented here with context on why it was made.

**Important:** Local migration files and the remote applied history have drifted — migrations were historically applied via the Supabase SQL editor, not through the CLI. Do not run `supabase db push` without first running `supabase migration list` and reconciling. See `SETUP.md`.

---

## Original Schema (Lovable Prototype)

The original Lovable export included a June 24, 2026 migration that created the initial V2 schema. This was the foundation everything was built on. It included:

- `profiles` — attendee identity and matching data
- `events` — event/room records
- `matches` — AI matching output
- `messages` — attendee messaging
- `meetings` — meeting scheduling
- `check_ins` — physical attendance
- `sponsors`, `sponsor_engagements` — sponsor tracking
- `feedback` — post-meeting feedback
- `points` — gamification scaffolding
- `reports` — organizer reports
- `match_actions` — save/dismiss actions

Also from the original build (April 2026 Lovable migrations):
- `event_registrations` — early V1 registration form
- `connection_actions` — audit log for match interactions
- `concierge_logs` — AI concierge telemetry
- `admin_actions` — admin audit log
- `event_analytics` — early analytics events

---

## Migration Log

### `20260429201226` — Initial V1 tables
Created: `event_registrations`, `connection_actions`, `concierge_logs`, `admin_actions`, `event_analytics`. RLS enabled on all. These were the original Lovable prototype tables before V2 schema was built.

### `20260429201254` — V1 policies
Row-level security policies for the V1 tables. Wide-open policies (anyone can insert) appropriate for an anonymous demo.

### `20260429202038` — (schema detail)
Additional V1 schema setup.

### `20260429202103` — (schema detail)
Additional V1 policies.

### `20260429202127` — (schema detail)
Additional V1 configuration.

### `20260624020108` — Core V2 schema
The main V2 schema migration from the Lovable prototype. Created: `profiles`, `events`, `event_registrations` (V2 version), `check_ins`, `matches`, `match_actions`, `messages`, `meetings`, `sponsors`, `sponsor_engagements`, `feedback`, `points`, `reports`. RLS enabled on all. Auth trigger to auto-create profile on signup. This is the foundation of everything in V2.

---

### `20260706184000` — Matching engine fields
**Why:** Week 2 audit found 5 fields missing from `profiles` that the matching engine required.

Added to `profiles`:
- `who_to_meet TEXT[]` — target personas
- `desired_outcomes TEXT[]` — what success looks like
- `areas_of_expertise TEXT[]` — expertise tags
- `role_details JSONB` — dynamic role-specific answers
- `matching_goal TEXT` — primary matching goal

---

### `20260713182316` — Fix role_type constraint
**Why:** The original constraint included `Corporate Leader` (never a real dropdown option) and was missing `Hiring Manager` and `Brand Partner` (both live options). Any user selecting either missing option would complete all 4 profile pages and fail on final submit with no recovery path.

Dropped old constraint. Rebuilt with correct enum: Founder, Investor, Recruiter, Hiring Manager, Creator, Professional, Brand Partner, Community Builder, Student, Sponsor, Other.

---

### `20260806120636` — Fix messages INSERT policy
**Why:** Critical security gap. The original policy only checked `auth.uid() = sender_id`. Any authenticated user could message any profile by fabricating a `match_id` and `recipient_id`.

New policy: sender must be authenticated as themselves AND the referenced `match_id` must be a real match linking sender and recipient (in either direction).

---

### `20260811174536` — Prevent duplicate connect messages
**Why:** Users could tap "Request to Connect" multiple times, creating multiple identical connection messages before the first one appeared in the UI.

Added new `message_type` value `connect_request`. Created partial unique index: one `connect_request` per `(match_id, sender_id)`. Normal `text` messages are unaffected. Backfill migration correctly retypes the earliest existing connect message per pair, preserving history.

---

### `20260812164342` — Prevent duplicate event registrations
**Why:** Race condition allowed multiple registrations for the same (profile, event) pair.

Added `UNIQUE (event_id, profile_id)` constraint to `event_registrations` with an idempotent guard (safe to run even if constraint already exists).

---

### `20260813182500` — Add event end date
**Why:** Multi-day events (like Render ATL, August 12–13) needed a calendar end date independent of start/end timestamps.

Added `end_date DATE` to `events`. NULL preserves existing single-day behavior. Backfilled Render ATL with `end_date = 2026-08-13`.

---

### `20260813230043` — Registration check-in status
**Why:** Registration (signing up for an event) and physical attendance (actually showing up) needed to be separate states.

Added `is_checked_in BOOLEAN DEFAULT false` and `checked_in_at TIMESTAMPTZ` to `event_registrations`.

---

### `20260813232726` — Complete meeting lifecycle schema
**Why:** The `meetings` table had basic status fields but no explicit lifecycle timestamps, making it impossible to distinguish "accepted" from "accepted and scheduled" or audit when each transition happened.

- Renamed `confirmed_time` → `scheduled_at` (clarifies meaning)
- Added `requested_at`, `responded_at`, `completed_at` timestamps
- Added `meetings_status_check` constraint (requested → accepted → scheduled → completed/cancelled)
- Added `meetings_participants_differ_check` (requester ≠ recipient)
- Made core FK columns NOT NULL

---

### `20260818123102` — Secondary role types
**Why:** Attendees often have multiple professional identities (e.g., a Founder who is also a Creator). The single `role_type` field was insufficient.

Added `secondary_role_types TEXT[]` (max 2 values, same enum as `role_type`, no duplicates with `role_type`).

---

### `20260819031058` — US cities search
**Why:** Free-text location input produced inconsistent data that hurt matching and reporting quality.

Created `us_cities` table with 5,389 US cities (SimpleMaps data). Created `search_us_cities()` SECURITY DEFINER function with prefix search and population-ranked results. Location field now uses this as an autocomplete source.

---

### `20260819033231` — Expanded profile questionnaire fields
**Why:** The directional matching engine V2 required richer profile data — primary function, additional functions, seniority, industry focus, needs/offers, interests, communities, primary goal, secondary goals.

Added to `profiles`: `primary_function`, `additional_functions`, `seniority`, `industry_focus`, `needs TEXT[]`, `offers TEXT[]`, `interests TEXT[]`, `communities TEXT[]`, `primary_goal`, `secondary_goals TEXT[]`. All with appropriate CHECK constraints.

---

### `20260819034446` — Replace profile identity function / seniority options
Updated function and seniority constraint values to match the onboarding wizard exactly.

---

### `20260819043000` — Location preference
Added `location_preference TEXT` to `profiles` with enum constraint (`prioritize_city`, `prioritize_outside_city`, `mix`, `no_preference`). Used by the matching engine to weight geographic proximity.

---

### `20260819052000` — Needs/offers compatibility table
**Why:** The matching engine needed to recognize "near matches" between needs and offers (e.g., someone who needs "Finding Customers" matches someone who offers "Sales Expertise" even though the strings don't match exactly).

Created `needs_offers_compatibility` table with 35 approved near-match pairs and weights (0.7 for near match; exact matches handled by direct string equality in the scorer).

---

### `20260819061520` — `match_details` column
**Why:** Full Profile View needed structured "which specific thing matched which specific thing" data — not just a prose summary.

Added `match_details JSONB` to `matches`. Shape: `{ matchedGoals, matchedRoles, matchedInterests, needsOffersAToB, needsOffersBToA }`. Populated by the match engine scorer; NULL on all existing rows until then.

---

### `20260820010000` — Mark message thread read
Created `mark_message_thread_read(match_id UUID)` SECURITY DEFINER function. Sets `read_at = now()` on all unread messages in a thread where the caller is the recipient.

---

### `20260820020000` — Notifications V1
**Why:** Users needed to know when someone sent them a connection request, message, or meeting update without polling.

Created `notifications` table with type enum, source-type constraints, and indexes. Created three `SECURITY DEFINER` trigger functions: `create_notification_for_message`, `create_notification_for_meeting_request`, `create_notification_for_meeting_status_change`. Notifications are written only by these trusted triggers — never by client code.

---

### `20260820140000` — Harden Concierge telemetry
Locked `concierge_logs` writes to service role only (previously any authenticated user could insert fake usage logs). Added partial unique index on `request_id` to prevent duplicate logging on retries.

---

### `20260821010000` — Secure profile reads
**Why:** The base `profiles` table contained private data (email, matching questionnaire) that should not be visible to other attendees.

Dropped open `SELECT` policies. Created `attendee_profiles` view exposing only safe networking fields to the caller + their matches. Created `matched_event_attendance` view for cross-attendee check-in data.

---

### `20260821020000` — Secure match inserts
Removed authenticated clients' ability to INSERT into `matches`. Only service role (via edge function) can create match rows.

---

### `20260821030000` — Secure registrations and meetings
Locked registration writes to owner-only. Moved meeting writes to SECURITY DEFINER RPCs: `request_meeting()`, `respond_to_meeting()`, `schedule_meeting()`, `complete_meeting()`. Created `get_event_attendance_counts()` for organizer attendance data.

---

### `20260821040000` — Secure profile photo storage
Tightened Storage RLS on the `profile-photos` bucket.

### `20260821040100` — Allow owned profile photo selection
Addendum to photo storage policy.

---

### `20260821050000` — Matching rubric V2 storage
Added `connection_preference TEXT` to `profiles` for the V2 directional scorer.

---

### `20260825010000` — Allow match saved action delete
Allowed users to un-save/un-dismiss a match action.

### `20260825020000` — Add feedback meeting ID
Added `meeting_id` FK to `feedback` table.

### `20260825030000` — Update reciprocity label mutual value
Updated the `Mutual` reciprocity label value for clarity.

### `20260826000000` — Unpublish Render ATL
Set Render ATL event to `is_published = false` after the pilot event ended.

---

### `20260828000000` — Add connection status
Added `connection_status TEXT` column to `matches` (`none` / `pending` / `accepted` / `declined`).

### `20260828010000` — Add connection response
Added `connection_responded_at TIMESTAMPTZ` and the `respond_to_connection()` RPC.

### `20260828020000` — Set connection pending on request
Database trigger: when a `connect_request` message is inserted, set `connection_status = 'pending'` on the match.

### `20260828030000` — Gate meeting requests on connection
Updated `request_meeting()` RPC to require `connection_status = 'accepted'` before creating a meeting.

### `20260828040000` — Gate messages on connection
Updated messages INSERT policy: free-text messages (`message_type != 'connect_request'`) require `connection_status = 'accepted'`. Connect request messages are always allowed (they're what creates the pending state).

### `20260828050000` — Connection notes
Created `connection_notes` table. Private notes per (match, user). Never visible to the other participant.

### `20260828060000` — Connection self-reports
Created `connection_self_reports` table. "Did you actually connect with this person?" — one response per (match, user). Options: `met`, `exchanged_messages`, `scheduled_for_later`, `not_yet`, `no_longer_interested`.

---

### `20260903000000` — Event AI insights
Created `event_ai_insights` table. Cache for enterprise dashboard Insights tab AI content. One row per event. Written and read only by service role (`admin-auth` edge function).

---

### `20260904010000` — Group 1 security lockdown
Fix pass from the V1 readiness audit:
1. `reports` table was world-readable — locked to service role
2. Profile INSERT policy had no `WITH CHECK` — fixed
3. Match INSERT revoked from authenticated role
4. `admin-auth` CORS wildcard — fixed in edge function code (not SQL)
(Finding 4 — SECURITY DEFINER views — deferred to separate pass)

---

### `20260908000000` — Home company colleagues function
Created `home_company_colleagues(p_event_id UUID)` SECURITY DEFINER function. Returns checked-in attendees who share the caller's company. Powers the "Your company is in the room" Home banner.

---

### `20260908010000` — Canonical pair ordering
**Why:** Without canonical ordering, two concurrent match-engine runs for the same pair could each write their own row (A→B and B→A), resulting in duplicate matches with conflicting scores.

1. Backfill: swapped all existing rows where `user_a_id > user_b_id` (including their directional fields)
2. Added `matches_user_a_before_b CHECK (user_a_id < user_b_id)` constraint
3. Added covering index on `(user_a_id, user_b_id)`

---

### `20260909000000` — Self-serve organizer rooms
Added `is_organizer BOOLEAN DEFAULT false` to `profiles`. Created `block_self_service_organizer_grant` trigger (prevents end users from self-granting). Created `is_organizer()` SECURITY DEFINER function. Fixed events RLS: dropped old open insert policy, rebuilt with organizer flag gate.

---

### `20260910000000` — Event deletion impact function
Created `event_deletion_impact(p_event_id UUID)` function. Returns counts of matches, messages, and meetings that will cascade-delete when an organizer deletes an event. Requires the caller to be the event's organizer.

### `20260910100000` — Connection notes archived
Added `archived_at TIMESTAMPTZ` to `connection_notes` for soft archiving.
