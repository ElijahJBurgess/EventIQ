# V1 Readiness Audit

**Status:** 🚧 in progress — this is a *living document*, committed section-by-section as each area is completed. Do not treat unfinished sections as final.

**Method:** Discovery + documentation only. Nothing is fixed as part of this pass except changes that are trivially safe, and those are listed explicitly in [Appendix B](#appendix-b--trivially-safe-fixes-applied-during-the-audit). Every "broken" or "working" claim is backed by an actual test — the verification method is stated per finding.

**Environment:** Production Supabase project `qdknsjoddmrvwjrrwwiq` ("Event IQ"). All destructive testing uses throwaway accounts created for the audit (naming: `audit-<timestamp>-*@offriptest.dev`); the 83 real `auth.users` and their data are never touched. Test artifacts are cleaned up and tracked in [Appendix A](#appendix-a--test-accounts--artifacts).

**Severity legend:**

| Tag | Meaning |
|---|---|
| 🔴 **blocking** | Must fix before real users / launch |
| 🟠 **should-fix** | Real problem, not launch-blocking on its own |
| 🟡 **nice-to-have** | Polish / hardening / tech debt |
| ⚪ **dead-code** | Unused; safe to remove |
| ✅ **verified-ok** | Checked and working as intended |

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

*Status: pending.*

## Section 2 — Edge functions

*Status: pending.*

## Section 3 — Security

*Status: pending.*

## Section 4 — Database schema health

*Status: pending.*

## Section 5 — Compliance gaps

*Status: pending.*

---

## Appendix A — Test accounts & artifacts

*Populated as accounts are created; every entry is cleaned up or explicitly noted as intentionally retained.*

| Created (UTC) | Identifier | Purpose | Cleaned up? |
|---|---|---|---|
| — | — | — | — |

## Appendix B — Trivially-safe fixes applied during the audit

*Nothing yet. Anything here is listed for your visibility, not pre-approved scope; each entry says exactly what changed and why it is safe.*

| Area | Change | Why it's safe |
|---|---|---|
| — | — | — |
