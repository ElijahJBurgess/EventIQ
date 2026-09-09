# Event IQ / OFFRIP

An event networking app: attendees build a profile, a matching engine pairs them
with other attendees at an event, and they connect, message, and schedule
meetings. Organizers get a password-gated analytics dashboard. An AI "concierge"
answers attendee questions and generates event insight summaries.

- **Live:** https://event-iq-six.vercel.app
- **Backend:** Supabase project `qdknsjoddmrvwjrrwwiq` (Postgres + Auth + Storage + Edge Functions)

---

## Stack

| | |
|---|---|
| Frontend | Vite 5 · React 18 · TypeScript · React Router 6 |
| UI | Tailwind CSS 3 · shadcn/ui (Radix) · `recharts` · `sonner` · `lucide-react` |
| Backend | Supabase — Postgres (RLS), Auth, Storage, Deno Edge Functions |
| AI | OpenAI Responses API (`gpt-5.4-mini`) via the `concierge` and `admin-auth` functions |
| Tests | Vitest · `@testing-library/react` · jsdom |
| Hosting | Vercel (frontend), Supabase (backend) |

Node 22 (developed on v22.15). No `.nvmrc` yet — use an LTS ≥ 20.

---

## Getting started

```bash
npm install
cp .env.example .env      # fill in the three VITE_ values (see .env.example)
npm run dev               # http://localhost:8080
```

Only the `VITE_*` values in `.env` are needed to run the app locally. Everything
server-side (edge-function secrets, service-role key) lives on the Supabase
project, not in this file — see `.env.example` for the full list.

### Scripts

| Script | What |
|---|---|
| `npm run dev` | Vite dev server on `:8080` |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint over the repo |
| `npm test` | Vitest, single run (also runs the pure edge-function modules) |
| `npm run test:watch` | Vitest watch mode |
| `npm run generate-types` | Regenerate `src/integrations/supabase/types.ts` (needs a privileged `supabase login` — see caveat below) |

---

## Project layout

```
src/
  pages/v2/            route components (Landing, Auth, ProfileSetup, Dashboard, OrganizerAdmin, …)
  pages/v2/enterprise/ the 6 admin-dashboard tabs
  components/          feature areas: matches, messages, connections, notifications,
                      concierge, profile, profile-setup, offrip (design primitives), ui (shadcn)
  lib/                pure helpers (matching presentation, enterprise stats types, …)
  integrations/supabase/  generated client + types
  v2/                 AuthProvider, ProtectedRoute
  test/              Vitest setup (jsdom polyfills)
supabase/
  migrations/         SQL migrations (see caveat)
  functions/          Deno edge functions
docs/
  v1-readiness-audit.md   full audit + fix log — read this before a launch
  matching-rubric-spec.md matching engine V2 scoring spec
  change-plan.md
```

### Routes (`src/App.tsx`)

| Path | Component | Guard |
|---|---|---|
| `/` | Landing | public |
| `/v2/auth` | Auth (sign in / sign up) | public |
| `/v2/reset-password` | ResetPassword | public (token in URL) |
| `/v2/setup` | ProfileSetup (5-step onboarding) | auth required |
| `/v2` | Dashboard | auth + completed profile |
| `/v2/admin` | OrganizerAdmin (enterprise dashboard) | **no route guard** — password-gated inside via the `admin-auth` function |
| `/offrip-preview` | design-primitive preview | dev build only |

---

## Database

Postgres on Supabase, **RLS enabled on every table**. Writes to the relationship
tables (`matches`, `messages`, `meetings`, `notifications`, connection tables) go
through guarded `SECURITY DEFINER` RPCs, not direct table writes. Some reads that
need to see past a self-only RLS policy also go through `SECURITY DEFINER`
functions — e.g. `home_company_colleagues(p_event_id)` (Home "Your company is in
the room" banner), which only returns checked-in attendees who share the caller's
own company.

### Migrations caveat

`supabase/migrations/` and the remote migration history have **drifted** — the
local filenames use different version timestamps than what's recorded as applied
on the project (migrations have historically been applied out of band). A plain
`supabase db push` will not line up. Before relying on the CLI migration
workflow, run `supabase migration list` against the project and reconcile
(`supabase migration repair`), or treat the local files as review artifacts and
apply changes through the Supabase SQL editor / MCP.

---

## Edge Functions

Deno functions in `supabase/functions/`. `verify_jwt` is set in
`supabase/config.toml` (which currently only lists 3 of them — the others rely on
the deploy-time default).

| Function | Purpose | `verify_jwt` |
|---|---|---|
| `match-engine` | generate a caller's matches for an event | true |
| `concierge` | AI attendee Q&A for an event | true |
| `delete-account` | self-serve account deletion (deletes only `auth.uid()`) | true |
| `admin-auth` | enterprise dashboard data + AI insights/copilot + report CRUD + `create-event` (owner-only room creation) | **false** — gated by a shared organizer password (`OOO_ADMIN_PASSWORD`), not a JWT |
| `admin-run-matching` | one-off operator match-backfill utility; **not deployed**; delete after use | n/a |
| `admin-gen-link` | **decommissioned** — inert `410` stub; the slug still needs deleting from the dashboard | n/a |

### Deploying functions — read this

The Supabase CLI account currently wired up here **lacks the privilege to deploy
functions or generate types** (`403`). Every function deploy in this project's
history has gone through the **Supabase MCP `deploy_edge_function` tool**, passing
the function's files inline. To restore the normal
`supabase functions deploy <name>` workflow, a project **owner/admin** needs to
grant that access (or run deploys themselves). Same for `npm run generate-types`.

Function secrets are set on the project (Dashboard → Edge Functions → Secrets).
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically; the rest (`OOO_ADMIN_PASSWORD`, `OOO_Intellegence_Open_API_Key`,
optional `*_ALLOWED_ORIGINS` / `*_OPENAI_MODEL`) are set manually — see
`.env.example`.

---

## Testing

```bash
npm test
```

Vitest runs the React component/lib tests **and** the pure edge-function modules
(`supabase/functions/*/{stats,insights,report,deletion}.test.ts` — these are
import-clean, no Deno globals, and listed explicitly in `vitest.config.ts`).
Edge-function glue (`index.ts`) is verified live, not unit-tested.

There is no CI yet — `tsc -b`, `npm run lint`, `npm test`, and `npm run build`
all pass on `main` but nothing enforces it on PRs.

---

## Deployment

- **Frontend:** Vercel project `event-iq-six`. Set the three `VITE_*` vars in the
  Vercel project env. Build command `npm run build`, output `dist/`.
- **Backend:** Supabase project `qdknsjoddmrvwjrrwwiq`. Schema changes via
  migrations/SQL editor; function deploys via MCP until CLI access is restored
  (above).

---

## Status & known gaps

`docs/v1-readiness-audit.md` is the source of truth — a full audit (2026-09-03)
plus an ongoing fix log. Headline open items:

- **Compliance (blocks a public launch):** no Privacy Policy; ToS is a
  placeholder behind a forced checkbox; user consent is never persisted.
- **Security:** the two `SECURITY DEFINER` views (`attendee_profiles`,
  `matched_event_attendance`) still trip the advisor — a `security_invoker` flip
  would break matched-profile viewing app-wide; the planned fix is to convert
  them to functions (audit §3.3). Admin dashboard uses one static shared
  password. Email verification is off (`enable_confirmations = false` — needs
  production SMTP).
- **Cleanup:** ~8 dead tables and ~16 dead columns; `matching_goal` half-retired
  (dual-written with `primary_goal`); `admin-run-matching` never deployed.
- **Ops:** migration drift (above); `types.ts` is stale (missing
  `event_ai_insights`); no CI.
