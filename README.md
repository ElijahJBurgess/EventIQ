# OOO Intelligence — EventIQ

**AI-powered Relationship & Outcome Intelligence Platform**

OOO Intelligence helps event attendees discover the right people to meet while helping organizations understand the outcomes created from those connections. It combines AI-powered matchmaking, relationship intelligence, and enterprise reporting into a single platform.

---

## What It Does

- **Attendee Matching** — Weighted scoring engine pairs attendees by role compatibility, shared goals, needs/offers alignment, expertise, and interests
- **AI Concierge** — Platform-wide natural language Q&A powered by OpenAI; answers questions across all the user's events and matches
- **Messaging** — Gated connection flow: request → accept → message → schedule meeting
- **Meeting Scheduler** — Full lifecycle: request, accept/decline, schedule, calendar export, complete
- **Organizer Dashboard** — Password-protected enterprise analytics: attendance, match performance, relationship funnel, AI-generated insights, PDF reports
- **Self-Serve Room Creation** — Organizer-flagged accounts can create and manage their own events

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Edge Functions | Deno (TypeScript) |
| AI | OpenAI via Edge Functions |
| Deployment | Vercel (frontend) + Supabase cloud (backend) |
| Testing | Vitest + React Testing Library |

---

## Routes

| Path | Component | Auth |
|---|---|---|
| `/` | Landing page | Public |
| `/v2/auth` | Sign in / Sign up | Public |
| `/v2/reset-password` | Password reset | Public (token in URL) |
| `/v2/setup` | Profile onboarding (5 steps) | Auth required |
| `/v2` | Main dashboard | Auth + completed profile |
| `/v2/organizer` | Self-serve room creation | Auth + `is_organizer = true` |
| `/v2/admin` | Enterprise organizer dashboard | Password-gated internally |

---

## Project Structure

```
src/
├── pages/
│   └── v2/                    # All V2 app pages
│       ├── Auth.tsx
│       ├── Dashboard.tsx
│       ├── Landing.tsx
│       ├── OrganizerAdmin.tsx
│       ├── OrganizerRooms.tsx
│       ├── ProfileSetup.tsx
│       └── enterprise/        # Enterprise dashboard tabs
├── components/
│   ├── concierge/             # AI Concierge tab
│   ├── connections/           # Connection self-report
│   ├── matches/               # Match cards, full profile view, connect composer
│   ├── messages/              # Conversation list, message thread
│   ├── notifications/         # Notification bell
│   ├── offrip/                # Design primitive components
│   ├── profile/               # Edit profile screen
│   ├── profile-setup/         # 5-step onboarding wizard
│   └── ui/                    # shadcn/ui base components
├── hooks/                     # Shared React hooks
├── integrations/              # Supabase client config
└── lib/                       # Shared utilities
supabase/
├── functions/                 # Deno edge functions
│   ├── match-engine/
│   ├── concierge/
│   ├── admin-auth/
│   └── delete-account/
└── migrations/                # 47 ordered SQL migrations
```

---

## Local Setup

See [`SETUP.md`](./SETUP.md) for the full step-by-step guide.

**Quick start:**

```bash
git clone https://github.com/ElijahJBurgess/EventIQ.git
cd EventIQ
npm install
cp .env.example .env
# Fill in your Supabase credentials in .env
npm run dev
```

**Required environment variables:**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

---

## Edge Functions

Deployed on Supabase. See [`docs/EDGE_FUNCTIONS.md`](./docs/EDGE_FUNCTIONS.md) for full details.

| Function | Purpose |
|---|---|
| `match-engine` | Generate matches for an event |
| `concierge` | Platform-wide AI Q&A |
| `admin-auth` | Enterprise dashboard data + AI insights |
| `delete-account` | Self-serve account deletion |

> **Note:** The Supabase CLI account currently lacks deploy privileges. All function deploys go through the Supabase MCP tool. See [`docs/EDGE_FUNCTIONS.md`](./docs/EDGE_FUNCTIONS.md).

---

## Database

Postgres on Supabase with RLS enabled on every table. 47 migrations covering the full schema history. See [`DATABASE.md`](./DATABASE.md) for the complete table reference.

> **Migration drift warning:** Local migration files and the remote applied history have drifted. Do not run `supabase db push` without first running `supabase migration list` and reconciling. See [`docs/SCHEMA_HISTORY.md`](./docs/SCHEMA_HISTORY.md).

---

## Testing

```bash
npm test          # Run all tests
npm run build     # Verify production build
npx tsc -b        # Type check
npm run lint      # Lint
```

Vitest covers React components and pure edge function modules. No CI is configured yet — all checks pass on `main` but are not enforced on PRs.

---

## Deployment

- **Frontend:** Vercel project `event-iq-six`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel project env. Build command: `npm run build`, output: `dist/`.
- **Backend:** Supabase project `qdknsjoddmrvwjrrwwiq`. Schema changes via SQL editor or migrations. Function deploys via Supabase MCP.

---

## Documentation Index

| File | What it covers |
|---|---|
| [`SETUP.md`](./SETUP.md) | Full local setup and deployment guide |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Codebase structure and design decisions |
| [`DATABASE.md`](./DATABASE.md) | All tables, columns, relationships, RLS |
| [`ROADMAP.md`](./ROADMAP.md) | Product phases and feature goals |
| [`CHANGELOG.md`](./CHANGELOG.md) | Full commit history organized by phase |
| [`docs/BUILD_JOURNAL.md`](./docs/BUILD_JOURNAL.md) | Week-by-week narrative of what was built and why |
| [`docs/DECISIONS.md`](./docs/DECISIONS.md) | Key architectural and product decisions with reasoning |
| [`docs/SCHEMA_HISTORY.md`](./docs/SCHEMA_HISTORY.md) | Migration-by-migration database evolution |
| [`docs/EDGE_FUNCTIONS.md`](./docs/EDGE_FUNCTIONS.md) | Edge function reference and deploy guide |
| [`docs/MATCHING_ENGINE.md`](./docs/MATCHING_ENGINE.md) | How the scoring algorithm works |
| [`docs/FEATURES.md`](./docs/FEATURES.md) | Complete feature inventory: live, partial, planned |
| [`docs/KNOWN_ISSUES.md`](./docs/KNOWN_ISSUES.md) | Open gaps, security items, and cleanup list |
