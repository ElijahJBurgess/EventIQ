# Database Reference

Postgres on Supabase. RLS is enabled on every table. All writes to relationship tables (`matches`, `messages`, `meetings`, `notifications`) go through `SECURITY DEFINER` RPCs or Edge Functions — not direct client writes.

---

## Tables

### `profiles`
The core identity record. Created automatically on signup via a Supabase auth trigger. One row per user.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK — matches `auth.users.id` |
| `full_name` | TEXT | |
| `email` | TEXT | |
| `avatar_url` | TEXT | Supabase Storage public URL |
| `title` | TEXT | Job title |
| `company` | TEXT | |
| `location` | TEXT | City, state |
| `linkedin_url` | TEXT | |
| `role_type` | TEXT | Primary role — constrained enum (Founder, Investor, Recruiter, Hiring Manager, Creator, Professional, Brand Partner, Community Builder, Student, Sponsor, Other) |
| `secondary_role_types` | TEXT[] | Up to 2 additional role types |
| `primary_function` | TEXT | Business function (Marketing, Engineering, etc.) |
| `additional_functions` | TEXT[] | Up to 2 additional functions |
| `seniority` | TEXT | Career level (Student through C-Suite) |
| `primary_goal` | TEXT | Main goal for attending |
| `secondary_goals` | TEXT[] | Additional goals |
| `needs` | TEXT[] | What the attendee is looking for |
| `offers` | TEXT[] | What the attendee can offer others |
| `who_to_meet` | TEXT[] | Target personas to meet |
| `desired_outcomes` | TEXT[] | What success looks like |
| `areas_of_expertise` | TEXT[] | Expertise tags |
| `matching_goal` | TEXT | Legacy — being phased out in favor of `primary_goal` |
| `interests` | TEXT[] | Personal/professional interests |
| `communities` | TEXT[] | Communities the attendee belongs to |
| `industry_focus` | TEXT[] | Industry tags |
| `connection_preference` | TEXT | How they prefer to connect |
| `location_preference` | TEXT | `prioritize_city` / `prioritize_outside_city` / `mix` / `no_preference` |
| `role_details` | JSONB | Dynamic role-specific answers (e.g., Founder: company stage, hiring status) |
| `profile_completed` | BOOLEAN | Set to true after completing onboarding |
| `completion_score` | INTEGER | Calculated profile completeness 0–100 |
| `is_organizer` | BOOLEAN | Manually granted — gates self-serve room creation |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Access:** Users can read/update only their own row. `attendee_profiles` view exposes a safe subset to matched users.

---

### `events`
Event / "Room" records. Can be created by the owner via `admin-auth` edge function, or by organizer-flagged users directly.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | TEXT | |
| `venue` | TEXT | |
| `location` | TEXT | |
| `event_date` | DATE | |
| `end_date` | DATE | For multi-day events |
| `start_time` | TIMESTAMPTZ | |
| `end_time` | TIMESTAMPTZ | |
| `is_published` | BOOLEAN | Only published events are visible to attendees |
| `organizer_id` | UUID | FK → `profiles.id` |
| `created_at` | TIMESTAMPTZ | |

**Access:** Published events are world-readable. Organizer-flagged users can manage their own events.

---

### `event_registrations`
Records a user joining an event. One row per (profile, event). Joining an event also creates a check-in record and triggers matching.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `event_id` | UUID | FK → `events.id` |
| `profile_id` | UUID | FK → `profiles.id` |
| `status` | TEXT | `registered` / `cancelled` |
| `is_checked_in` | BOOLEAN | Physical attendance |
| `checked_in_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

**Constraint:** `UNIQUE (event_id, profile_id)` — one registration per person per event.

---

### `check_ins`
Tracks physical event check-in separately from registration.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `event_id` | UUID | FK → `events.id` |
| `user_id` | UUID | FK → `profiles.id` |
| `checked_in_at` | TIMESTAMPTZ | |

---

### `matches`
Scoring output from the matching engine. One row per pair per event. Stored in canonical order (`user_a_id < user_b_id` — always the smaller UUID).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `event_id` | UUID | FK → `events.id` |
| `user_a_id` | UUID | FK → `profiles.id` — always the smaller UUID |
| `user_b_id` | UUID | FK → `profiles.id` — always the larger UUID |
| `match_score` | INTEGER | 0–100 composite score |
| `match_reason` | TEXT | Human-readable explanation |
| `score_breakdown` | JSONB | Per-component scores + `aToB`/`bToA` directional halves |
| `match_evidence` | JSONB | `aToB`/`bToA` directional evidence |
| `match_details` | JSONB | Structured matched pairs: goals, roles, interests, needs/offers |
| `reciprocity_label` | TEXT | e.g., `Mutual Benefit`, `You Can Help Them`, `They Can Help You` |
| `connection_status` | TEXT | `none` / `pending` / `accepted` / `declined` |
| `ai_explanation` | TEXT | Reserved for future OpenAI-generated content |
| `conversation_starters` | TEXT[] | Reserved for future OpenAI-generated content |
| `recommended_next_step` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Constraint:** `matches_user_a_before_b CHECK (user_a_id < user_b_id)` — enforces canonical pair ordering. Upsert key: `(event_id, user_a_id, user_b_id)`.

**Access:** Authenticated users can read only matches they participate in. No client inserts — engine writes only.

---

### `messages`
Conversation messages between matched users. Gated by match relationship and connection status.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `match_id` | UUID | FK → `matches.id` |
| `event_id` | UUID | FK → `events.id` |
| `sender_id` | UUID | FK → `profiles.id` |
| `recipient_id` | UUID | FK → `profiles.id` |
| `content` | TEXT | |
| `message_type` | TEXT | `text` / `connect_request` / `meetup_coord` / `meeting_link` / `note` |
| `read_at` | TIMESTAMPTZ | Set by `mark_message_thread_read()` RPC |
| `created_at` | TIMESTAMPTZ | |

**Constraint:** One `connect_request` per `(match_id, sender_id)` — enforced by partial unique index.

**Insert policy:** Sender must be authenticated, must be a participant in the referenced match, and (for non-`connect_request` messages) the connection must be `accepted`.

---

### `meetings`
Full meeting lifecycle: request → accept/decline → schedule → complete.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `match_id` | UUID | FK → `matches.id` |
| `event_id` | UUID | FK → `events.id` |
| `requester_id` | UUID | FK → `profiles.id` |
| `recipient_id` | UUID | FK → `profiles.id` |
| `status` | TEXT | `requested` / `accepted` / `declined` / `scheduled` / `completed` / `cancelled` |
| `proposed_time` | TIMESTAMPTZ | |
| `scheduled_at` | TIMESTAMPTZ | Confirmed meeting time |
| `duration_minutes` | INTEGER | Default 30 |
| `location_note` | TEXT | |
| `meeting_notes` | TEXT | |
| `calendar_export_token` | TEXT | UUID for calendar export link |
| `requested_at` | TIMESTAMPTZ | |
| `responded_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |

**Access:** Participants can read their own meetings. All writes go through SECURITY DEFINER RPCs: `request_meeting()`, `respond_to_meeting()`, `schedule_meeting()`, `complete_meeting()`.

---

### `notifications`
In-app notification feed. Written only by trusted database triggers — never by client code.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `profiles.id` — notification recipient |
| `actor_id` | UUID | FK → `profiles.id` — who triggered it |
| `type` | TEXT | `connection_request` / `new_message` / `meeting_requested` / `meeting_accepted` / `meeting_scheduled` / `meeting_declined` |
| `match_id` | UUID | FK → `matches.id` |
| `event_id` | UUID | FK → `events.id` |
| `meeting_id` | UUID | FK → `meetings.id` |
| `message_id` | UUID | FK → `messages.id` |
| `created_at` | TIMESTAMPTZ | |
| `read_at` | TIMESTAMPTZ | |

---

### `connection_notes`
Private notes a user writes about a connection. Never visible to the other participant.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `match_id` | UUID | FK → `matches.id` |
| `user_id` | UUID | FK → `profiles.id` |
| `note` | TEXT | |
| `updated_at` | TIMESTAMPTZ | |

**Constraint:** `UNIQUE (match_id, user_id)` — one note per person per match.

---

### `connection_self_reports`
"Did you actually connect with this person?" post-event self-report. One per (match, user).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `match_id` | UUID | FK → `matches.id` |
| `user_id` | UUID | FK → `profiles.id` |
| `response` | TEXT | `met` / `exchanged_messages` / `scheduled_for_later` / `not_yet` / `no_longer_interested` |
| `was_valuable` | BOOLEAN | Only meaningful when `response = 'met'` |
| `created_at` | TIMESTAMPTZ | |

---

### `needs_offers_compatibility`
Lookup table defining near-match pairs between needs and offers for the matching engine.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK |
| `need_value` | TEXT | |
| `offer_value` | TEXT | |
| `match_weight` | NUMERIC | 0.7 (near match) or 1.0 (exact — handled by scorer directly) |

---

### `us_cities`
5,389 US cities for the location autocomplete. Source: SimpleMaps US Cities Basic.

| Column | Type |
|---|---|
| `id` | BIGINT |
| `city` | TEXT |
| `admin_name` | TEXT |
| `state_code` | TEXT |
| `lat` / `lng` | NUMERIC |
| `population` | BIGINT |

Search via `search_us_cities(query text, limit int)` SECURITY DEFINER function.

---

### `sponsors`
Sponsor records for events.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `event_id` | UUID | FK → `events.id` |
| `company_name` | TEXT | |
| `tier` | TEXT | Title / Platinum / Gold / Silver / Bronze / Community |
| `logo_url` | TEXT | |
| `description` | TEXT | |
| `booth_location` | TEXT | |
| `contact_name` | TEXT | |

---

### `feedback`
Post-meeting feedback.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `meeting_id` | UUID | FK → `meetings.id` |
| `user_id` | UUID | FK → `profiles.id` |
| `overall_rating` | INTEGER | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

---

### `reports`
PDF / AI-generated event reports for the organizer dashboard. Written and read only via service role through the `admin-auth` edge function.

---

### `event_ai_insights`
Cached AI-generated insights for the enterprise dashboard Insights tab. One row per event. Regenerated when stats change.

| Column | Type | Notes |
|---|---|---|
| `event_id` | UUID | PK — FK → `events.id` |
| `insights` | JSONB | Array of insight objects |
| `stats_fingerprint` | TEXT | SHA-256 of stats payload — used to detect stale cache |
| `model` | TEXT | OpenAI model that generated insights |
| `generated_at` | TIMESTAMPTZ | |

---

### Legacy / Low-Use Tables

These tables exist from the original schema but see minimal or no active use:

| Table | Notes |
|---|---|
| `event_registrations` (original) | Early V1 table — the V2 version is the active one |
| `connection_actions` | Audit log for match interactions — low use |
| `concierge_logs` | Telemetry for concierge queries — writes locked to service role |
| `admin_actions` | Admin audit log |
| `event_analytics` | Early analytics table — superseded by enterprise dashboard |
| `match_actions` | Saved/dismissed match actions |
| `points` | Gamification scaffolding — not yet active |

---

## Views

### `attendee_profiles`
Safe subset of `profiles` for networking surfaces. Returns the caller's own full profile plus a limited set of fields for any profile they have a match with. SECURITY DEFINER.

### `matched_event_attendance`
Check-in presence for the caller and their matches at events they've joined. SECURITY DEFINER.

> **Known issue:** Both views trip the Supabase security advisor (`security_invoker` flag). The planned fix is to convert them to functions. See `docs/KNOWN_ISSUES.md`.

---

## Key SECURITY DEFINER Functions

| Function | Purpose |
|---|---|
| `request_meeting(match_id)` | Create a meeting request — validates match, registration, participants |
| `respond_to_meeting(meeting_id, response)` | Accept or decline a meeting request |
| `schedule_meeting(meeting_id, time, location)` | Set a confirmed time for an accepted meeting |
| `complete_meeting(meeting_id)` | Mark a meeting as completed |
| `mark_message_thread_read(match_id)` | Mark all messages in a thread as read |
| `search_us_cities(query, limit)` | Location autocomplete |
| `get_event_attendance_counts(event_id)` | Attendance totals for event participants |
| `home_company_colleagues(event_id)` | Colleagues at the same event for the Home banner |
| `event_deletion_impact(event_id)` | Count cascades before an organizer deletes an event |
| `is_organizer(uid)` | Check organizer flag — used by events RLS policy |
