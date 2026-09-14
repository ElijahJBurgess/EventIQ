# Setup Guide

Complete guide to running OOO Intelligence locally and deploying to production.

---

## Prerequisites

- Node.js 18+
- npm 9+
- A Supabase account and project
- A Vercel account (for deployment)

---

## 1. Clone the Repository

```bash
git clone https://github.com/ElijahJBurgess/EventIQ.git
cd EventIQ
npm install
```

---

## 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Get these from your Supabase project dashboard → Settings → API.

---

## 3. Set Up the Database

The schema lives in `supabase/migrations/` — 47 migration files covering the full history.

**Important — migration drift warning:**
The local migration filenames and the remote applied history have drifted (migrations were historically applied out-of-band via the SQL editor). Do **not** run `supabase db push` without first reconciling:

```bash
supabase migration list   # See what's applied vs local
supabase migration repair # If needed
```

**Recommended approach for a fresh project:** Apply migrations through the Supabase SQL editor in chronological order, or use the Supabase MCP tool.

**Seed data:**
The database does not include a seed file. The Render ATL 2026 event and ~40 seed profiles were added via the matching engine setup process. For a fresh environment you will need to create at least one event and run the matching engine after users sign up.

---

## 4. Configure Supabase Auth

In your Supabase project dashboard:

- **Authentication → Email:** Turn off "Enable email confirmations" for development (turn it back on with a real SMTP provider before production)
- **Authentication → URL Configuration:** Add your local dev URL (`http://localhost:8080`) and your production Vercel URL to the allowed redirect URLs

---

## 5. Configure Storage

The profile photo upload uses a Supabase Storage bucket called `profile-photos`. Create it in your Supabase dashboard:

- Dashboard → Storage → New bucket
- Name: `profile-photos`
- Make it public

---

## 6. Deploy Edge Functions

The Supabase CLI account currently lacks deploy privileges (403 on function deploy and type generation). All function deploys go through the **Supabase MCP `deploy_edge_function` tool**.

Functions that need to be deployed:
- `match-engine`
- `concierge`
- `admin-auth`
- `delete-account`

**Function secrets** — set these in Supabase Dashboard → Edge Functions → Secrets:

| Secret | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | Auto-injected | Set automatically |
| `SUPABASE_ANON_KEY` | Auto-injected | Set automatically |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | Set automatically |
| `OOO_ADMIN_PASSWORD` | Yes | Password for the organizer enterprise dashboard |
| `OOO_Intellegence_Open_API_Key` | Yes | OpenAI API key for concierge + admin insights |

Optional:
- `CONCIERGE_ALLOWED_ORIGINS`
- `CONCIERGE_OPENAI_MODEL`
- `ADMIN_AUTH_ALLOWED_ORIGINS`
- `ADMIN_AUTH_OPENAI_MODEL`

---

## 7. Run Locally

```bash
npm run dev
```

The app starts at `http://localhost:8080`.

---

## 8. Type Generation

When the database schema changes, regenerate TypeScript types:

```bash
npm run generate-types
```

> **Note:** This also requires Supabase CLI deploy privileges. If it fails with 403, use the Supabase MCP tool or manually update `src/integrations/supabase/types.ts`. The current `types.ts` is missing the `event_ai_insights` table (added in the `20260903` migration).

---

## 9. Verify Everything Works

```bash
npm test          # All tests pass
npx tsc -b        # No type errors
npm run lint      # No lint errors
npm run build     # Production build succeeds
```

---

## Production Deployment (Vercel)

1. Connect the GitHub repo to a Vercel project
2. Set environment variables in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Build command: `npm run build`
4. Output directory: `dist`
5. The `vercel.json` SPA rewrite config is already in the repo — direct URL navigation works correctly

---

## Granting Organizer Access

There is no signup flow for organizer status. It must be granted manually:

```sql
-- By profile UUID
UPDATE public.profiles SET is_organizer = true WHERE id = '<profile-uuid>';

-- By email
UPDATE public.profiles SET is_organizer = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'name@example.com');
```

Or in Supabase Studio → Table editor → `profiles` → flip the `is_organizer` cell.

A trigger (`block_self_service_organizer_grant`) prevents users from self-granting this flag.

---

## Granting Owner/Admin Access

The enterprise dashboard at `/v2/admin` is password-gated, not auth-gated. Set the `OOO_ADMIN_PASSWORD` secret on the edge function. Share that password with whoever needs dashboard access. Sessions last 72 hours.

To promote a specific user as organizer for all existing events:

```sql
UPDATE public.events
SET organizer_id = '<profile-uuid>'
WHERE organizer_id IS NULL OR organizer_id != '<profile-uuid>';
```
