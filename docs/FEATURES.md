# Feature Inventory

Complete status of every feature — what's live, what's partial, and what's planned.

---

## ✅ Live — Working in Production

### Authentication
- Email/password sign up and sign in
- Password reset via email link
- Self-serve account deletion (GDPR / App Store compliance)
- Auth session management (Supabase handles tokens)

### Profile Onboarding (5-step wizard)
- Step 1: Basic info — name, photo upload, title, company, location (US city autocomplete), LinkedIn, role type
- Step 2: Goals — primary goal, secondary goals, needs, offers
- Step 3: Who & filters — who to meet, connection preference, location preference
- Step 3b: Role-specific questions — dynamic per role type (Founder, Investor, Recruiter, Hiring Manager, Creator, Professional, Brand Partner, Community Builder, Student, Sponsor, Other)
- Step 4: Terms & AI consent checkbox
- Step 5: Event selection (must join at least one event)
- Progress indicator showing step X of 5
- Back navigation preserves all entries
- Full database save on completion
- Profile completion score (0–100)
- Photo upload wired to Supabase Storage (`profile-photos` bucket)

### Profile Editing
- Edit profile screen accessible from account menu
- Required fields enforced at save (same rules as onboarding)

### Matching Engine
- Deterministic weighted scoring (`goalToValueFit 35% / targetPersonFit 20% / needToOfferFit 15% / expertiseFit 10% / opportunityCompatibility 10% / timingConnectionFit 5% / contextFit 5%`)
- Directional scoring (`aToB` + `bToA`)
- Near-match needs/offers compatibility table (35 approved pairs)
- Canonical pair ordering (no duplicate rows)
- Atomic upsert (race condition safe)
- Auto-trigger on profile completion
- Reciprocity labels (Mutual Benefit / You Can Help Them / They Can Help You)

### Match Cards (People Tab)
- Real names, photos, titles, companies
- Match score
- Match reason (rule-based, not AI)
- Reciprocity label
- Match label (Strong / Good / Potential)
- "Request to Connect" action
- Score filter (toggle between all matches and top matches)

### Full Profile View
- Expanded modal from People tab and Home tab
- Structured match explanation: matched goals, matched roles, shared interests, needs/offers alignment
- "Make the Intro" connect action

### Connection Flow
- Request to Connect — creates `connect_request` message, sets connection to `pending`
- Accept / Decline — explicit response required before messaging or meeting
- Duplicate request protection (one request per pair, enforced at DB level)
- Connection archive (view past connections)
- Connection self-report: "Did you connect with this person?" (met / exchanged messages / scheduled for later / not yet / no longer interested)

### Messaging
- Conversation list with unread indicator and message preview
- Full message thread view
- Editable message composer on first connect (pre-filled but user can modify)
- Messages gated by accepted connection
- Read state (`mark_message_thread_read` RPC)

### Meeting Scheduling
- Request a meeting
- Accept / Decline
- Schedule (set confirmed time + location)
- Calendar export (`.ics` download via calendar export token)
- Mark complete
- All writes through SECURITY DEFINER RPCs

### Events
- Browse published events
- Join an event (creates registration + check-in record simultaneously)
- Multi-event support (profile and matches are event-aware)
- Home tab shows most recently joined event
- Browse Events empty state when no events joined

### Home Dashboard
- Live stats (matches, conversations, meetings)
- Top match card
- Event context
- "Your company is in the room" banner (colleagues at the same event)
- Fallback to most recent checked-in event when no live event

### AI Concierge
- Platform-wide natural language Q&A (no event selection required)
- Powered by OpenAI
- Answers across all the user's matches from all events
- Telemetry logged (anonymized) to `concierge_logs`

### Notifications
- In-app notification bell with unread count
- Types: connection request, new message, meeting requested, meeting accepted, meeting scheduled, meeting declined
- Written only by trusted DB triggers

### Organizer Enterprise Dashboard (`/v2/admin`)
- Password-gated (72-hour session)
- Events tab: view, create, edit, publish/unpublish, delete events (with impact preview)
- Overview tab: headline metrics, relationship funnel, experience signals
- Audience tab: attendee breakdown
- Relationships tab: connection data over time
- Outcomes tab: meeting and outcome data
- Insights tab: AI-generated insights (cached, regenerated on stats change)
- Reports tab: PDF report management

### Self-Serve Organizer Rooms (`/v2/organizer`)
- Organizer-flagged accounts can create and manage their own events
- Separate from owner dashboard — organizers see only their own events
- Edit, hide/unhide, delete with cascade impact preview
- Organizer flag must be manually granted (no self-serve path)

---

## ⚠️ Partial — Built but Incomplete

### OpenAI Match Explanations
- `ai_explanation` column exists on `matches`
- Nothing currently writes to it
- Match reasons are generated by the rule-based template layer

### AI Conversation Starters
- `conversation_starters TEXT[]` column exists on `matches`
- Nothing currently writes to it
- Planned as OpenAI-generated icebreakers per match card

### Connection Notes
- Table exists, policies set
- UI was added then removed — needs UI to be useful

### `types.ts`
- Stale — missing `event_ai_insights` table
- Requires CLI deploy privileges to regenerate (currently blocked — see `docs/KNOWN_ISSUES.md`)

---

## ❌ Not Built — Planned

### Compliance (Blocks Public Launch)
- Privacy Policy (currently no page exists)
- Real Terms of Service (currently a placeholder checkbox with no legal text)
- User consent persistence (consent is never recorded in the database)
- Email verification with real SMTP (currently disabled)

### Phase 2 — Sponsor Intelligence
- Booth visits, QR scans, product sampling tracking
- Lead capture
- Sponsor engagement reporting

### Phase 2 — Outcome Scoring
- Connection Score, Engagement Score, Sponsor Score, Community Score, Overall Outcome Score

### Phase 3 — Multi-Event Intelligence
- Cross-event outcome comparison

### Phase 3 — Longitudinal Tracking
- Outcome tracking at 1 week / 1 month / 3 month / 6 month intervals

### Phase 3 — Integrations
- CRM sync
- ATS integration
- Calendar sync

### Phase 3 — Gamification
- Points system (`points` table scaffolded but unused)
- Rewards marketplace

### OpenAI Per-Match Explanations
- `ai_explanation` column ready — just needs the edge function logic to call OpenAI per match and write results

### Google OAuth
- Auth page has a Google sign-in button (UI only)
- Backend OAuth configuration not completed
- Known gap: Google OAuth would bypass the profile setup flow
