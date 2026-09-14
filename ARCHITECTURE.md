# Architecture

---

## Overview

OOO Intelligence is a React SPA connected to a Supabase backend. The frontend is deployed on Vercel; the backend runs entirely on Supabase (Postgres, Auth, Storage, Edge Functions).

There is no separate API server. All data access goes directly through the Supabase client (with RLS enforcing access control) or through Deno Edge Functions for privileged operations.

---

## V1 vs V2

The codebase contains two generations of the product.

**V1** (`src/pages/OffripPreview.tsx`, the original Lovable export) was a hardcoded demo — every number, match, and metric was static. It exists in the repo as a design reference and is not wired to any real data. It should not be modified or shipped.

**V2** (`src/pages/v2/`) is the real application. It was built entirely from scratch on top of the existing Supabase schema. All active development is in V2.

---

## Frontend Structure

```
src/
├── App.tsx                    # Route definitions
├── pages/
│   ├── NotFound.tsx
│   ├── OffripPreview.tsx      # V1 design reference — do not modify
│   └── v2/
│       ├── Auth.tsx           # Sign in / sign up
│       ├── Dashboard.tsx      # Main app shell with tab navigation
│       ├── Landing.tsx        # Public landing page
│       ├── OrganizerAdmin.tsx # Enterprise dashboard (password-gated)
│       ├── OrganizerRooms.tsx # Self-serve room creation
│       ├── ProfileSetup.tsx   # 5-step onboarding wizard container
│       ├── ResetPassword.tsx
│       └── enterprise/        # Tab content for OrganizerAdmin
│           ├── OverviewTab.tsx
│           ├── AudienceTab.tsx
│           ├── RelationshipsTab.tsx
│           ├── OutcomesTab.tsx
│           ├── InsightsTab.tsx
│           └── ReportsTab.tsx
├── components/
│   ├── concierge/
│   │   ├── ConciergeTab.tsx       # AI Q&A interface
│   │   └── useConciergeSession.ts # Session state hook
│   ├── connections/
│   │   └── ConnectionSelfReportPrompt.tsx
│   ├── matches/
│   │   ├── MatchesTab.tsx         # Match feed
│   │   ├── FullProfileView.tsx    # Expanded profile modal
│   │   └── ConnectComposer.tsx    # Shared connect request composer
│   ├── messages/
│   │   ├── MessagesTab.tsx        # Conversation list
│   │   └── MessageThread.tsx      # Individual thread view
│   ├── notifications/
│   │   └── NotificationBell.tsx
│   ├── offrip/                    # OFFRIP design primitive components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Chip.tsx
│   │   └── Input.tsx
│   ├── profile/
│   │   └── EditProfileScreen.tsx
│   ├── profile-setup/             # Onboarding wizard pages
│   │   ├── Page1BasicInfo.tsx
│   │   ├── Page2Goals.tsx
│   │   ├── Page3WhoAndFilters.tsx
│   │   ├── Page3RoleQuestions.tsx
│   │   ├── Page4Terms.tsx
│   │   ├── Page5EventSelection.tsx
│   │   ├── PillSelect.tsx
│   │   ├── ProgressIndicator.tsx
│   │   ├── SuccessScreen.tsx
│   │   ├── profileUpdate.ts
│   │   ├── requiredProfileFields.ts
│   │   ├── roleDetailsUtils.ts
│   │   └── types.ts
│   └── ui/                        # shadcn/ui base components (40+ components)
├── hooks/                         # Shared React hooks
├── integrations/supabase/         # Supabase client + generated types
├── lib/                           # Shared utilities
└── test/                          # Test setup/helpers
```

---

## Routing

Routes are defined in `src/App.tsx`. The app uses React Router with a `ProtectedRoute` wrapper that:
1. Checks for an authenticated Supabase session
2. Checks `profile_completed` on the user's profile
3. Routes incomplete profiles to `/v2/setup`, complete profiles to `/v2`

The organizer dashboard (`/v2/admin`) has **no route guard** — it is protected entirely by the `admin-auth` edge function's password check.

---

## Dashboard Tab Structure

The main dashboard (`/v2`) renders a tab navigation with:
- **Home** — Personalized stats, top match, event context, company banner
- **People** (formerly Matches) — Match feed with connect actions
- **Events** — Joined events, browse/join new events
- **Messages** — Conversation list and threads
- **Concierge** — AI Q&A

---

## Profile Onboarding (5 Steps)

`ProfileSetup.tsx` manages the entire wizard — state, navigation, and progress indicator. Each page is a separate component in `components/profile-setup/`. All form data lives at the top level in a single state object, so back navigation preserves entries.

```
Step 1 — Basic Info (name, photo, title, company, location, LinkedIn, role type)
Step 2 — Goals (primary goal, secondary goals, needs, offers)
Step 3 — Who & Filters (who to meet, connection preference, location preference)
Step 3b — Role Questions (dynamic per role type: Founder, Investor, Recruiter, etc.)
Step 4 — Terms & AI Consent
Step 5 — Event Selection (join at least one event)
```

Completing the wizard sets `profile_completed = true` and triggers the matching engine for the selected event.

---

## Data Access Patterns

**Direct table reads (RLS-gated):**
Most reads go straight from the Supabase client to Postgres. RLS policies on every table ensure users can only see their own data or data they have a match relationship with.

**SECURITY DEFINER functions (privileged reads):**
Some reads need to cross RLS boundaries (e.g., Home's "Your company is in the room" banner needs to see other attendees). These go through `SECURITY DEFINER` Postgres functions that validate identity and return only the safe subset.

**Edge functions (trusted writes):**
Writes that need to enforce complex business logic go through Deno edge functions:
- Match generation (`match-engine`)
- Meeting lifecycle (via `request_meeting`, `respond_to_meeting`, `schedule_meeting` RPCs)
- Messages (INSERT policy validates match relationship and connection status)

---

## Design System

The app uses two component layers:
1. **shadcn/ui** — base components (`src/components/ui/`)
2. **OFFRIP primitives** — the brand's design tokens and custom components (`src/components/offrip/`, `src/index.css`)

The OFFRIP design system defines custom CSS variables for typography (`font-display`, `font-offrip-body`), color tokens, and component variants. The enterprise dashboard and main app use the same design tokens.

---

## Testing

Tests live alongside the files they cover (`.test.tsx` / `.test.ts`). Coverage includes:
- Profile setup wizard pages and required field validation
- Dashboard tab routing and empty states
- Match card rendering and state
- Concierge session hook
- Notification bell
- Message tabs
- Enterprise dashboard tabs (Overview, Organizer Rooms)
- Auth recovery flow
- Edge function pure logic modules (stats, insights, reports, deletion)

Run with `npm test`. No CI is configured.

---

## State Management

No global state library. State is managed with:
- React `useState` / `useReducer` for local component state
- Custom hooks for shared data fetching (`useConciergeSession`, etc.)
- Supabase client for all server state (no React Query or SWR)

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | Production — always deployable |
| `codex/concierge-v1-filter-and-terms-cleanup` | Concierge filter work (unmerged) |
| `codex/profile-integrity-and-crash-recovery` | Profile integrity fixes (unmerged) |
