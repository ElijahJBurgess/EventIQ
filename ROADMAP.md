# Product Roadmap

OOO Intelligence is an AI-powered Relationship & Outcome Intelligence Platform. The goal is not simply to measure attendance — it's to help people build meaningful relationships and help organizations understand the outcomes created from those connections.

---

## Vision

The platform combines:
- AI-Powered Matchmaking
- Relationship Intelligence
- Community Intelligence
- Recruiting Intelligence
- Sponsorship Intelligence
- Event Intelligence
- Executive Reporting

Target event types: conferences, corporate events, recruiting events, community events, festivals, industry events, employee experiences, sponsorship activations.

---

## Phase 1 — August Pilot Launch (Major Matches / Render ATL)

**Goal:** Validate that OOO Intelligence can successfully create meaningful attendee matches and facilitate real-world connections.

### ✅ Completed
- Reusable attendee profiles (users onboard once, profile persists across events)
- 5-step profile setup wizard with role-specific dynamic questions
- Structured data collection (dropdowns, multi-select, checkboxes — minimal free text)
- Weighted deterministic matching engine (see `docs/MATCHING_ENGINE.md`)
- Real match cards with score, reason, reciprocity label
- Full Profile View with structured match explanation
- Connection request flow (request → accept → message → schedule)
- In-app messaging (gated by accepted connection)
- Meeting lifecycle (request, accept/decline, schedule, calendar export, complete)
- Event check-in
- Multi-event support
- AI Concierge (platform-wide, OpenAI-powered)
- Notification system
- Home dashboard with live stats and top match
- Self-serve account deletion

### ⚠️ Partially Complete
- Organizer dashboard — enterprise tabs built, some data gaps
- OpenAI match explanations — column reserved, not populated yet
- Conversation starters — column reserved, not populated yet

### ❌ Not Built (Phase 1 scope, deferred)
- Privacy Policy (blocks public launch)
- Real Terms of Service (currently a placeholder)
- User consent persistence
- Email verification (SMTP needed for production)
- AI-generated conversation starters per match card

---

## Phase 2 — September Enterprise Beta

**Goal:** Demonstrate measurable event outcomes and sponsorship value.

### Sponsor Intelligence
- Booth visits, QR scans, product sampling, content creation, social sharing, survey participation, lead capture

### Engagement Tracking
- Match viewed, match accepted, message sent, meeting scheduled, meeting completed, follow-up requested, sponsor engagement, feedback submitted

### OOO Outcome Score
- Connection Score, Engagement Score, Sponsor Score, Community Score, Overall Outcome Score

### Automated Reporting
- Dashboard, PDF report
- Attendance, match performance, meeting performance, sponsor engagement, community insights, outcome score, recommendations
- AI-generated executive summary, key insights, recommendations

---

## Phase 3 — October AfroTech Launch

**Goal:** Launch an enterprise-ready platform supporting conferences, communities, recruiting programs, employee experiences, and sponsorship activations.

### Multi-Event Intelligence
- Compare outcomes across AfroTech, OOO Summit, Office to After Hours, Major Matches, Shopify Block Party, NSBE, future enterprise events

### Longitudinal Outcome Tracking
- Track outcomes at 1 week, 1 month, 3 months, 6 months post-event

### Enterprise Reporting
- Integrations (CRM, ATS, calendar sync)
- Gamification foundations (points, rewards marketplace)

---

## Success Metrics (By AfroTech)
- 500+ attendee profiles created
- Thousands of AI-generated matches
- Hundreds of meetings scheduled
- Active AI Concierge usage
- Sponsor engagement reporting
- Executive-ready outcome reporting
- Enterprise customer pilots
- Validation as both a matchmaking platform and an outcome intelligence platform

---

## Data Quality Standards

Default to structured inputs wherever possible:
- Dropdowns
- Multi-select dropdowns
- Radio buttons
- Checkboxes

Free text only where absolutely necessary (Company Name, Job Title). This ensures higher quality matching, cleaner reporting, better AI recommendations, and stronger enterprise analytics.

All dropdown options should use unique backend IDs rather than relying on text values (future improvement):
- `role_founder`, `role_investor`, `role_recruiter` (vs. storing plain text strings)
