# Known Issues

Honest accounting of open gaps, security items, technical debt, and cleanup tasks. Source of truth: `docs/v1-readiness-audit.md` (full audit, September 3, 2026).

Issues are grouped by severity.

---

## 🔴 Blocks Public Launch

### No Privacy Policy
The app collects personal data (name, photo, LinkedIn, location, role, goals, interests) and processes it through an AI system. There is no Privacy Policy page. This is required for any public-facing launch, App Store submission, and likely any enterprise customer.

**Fix:** Write and publish a Privacy Policy. Add a link in the footer and the Terms step of onboarding.

---

### Terms of Service is a Placeholder
Step 4 of onboarding shows a checkbox: "I agree to the Terms of Service and AI Consent." There is no actual Terms of Service document linked. Users are consenting to nothing.

**Fix:** Write real Terms of Service. Host it at `/terms`. Link it from the checkbox.

---

### User Consent is Never Persisted
Even when a user checks the consent box, that fact is not recorded in the database. There is no `terms_accepted_at` timestamp or consent version tracking on `profiles`.

**Fix:** Add `terms_accepted_at TIMESTAMPTZ` and `terms_version TEXT` to `profiles`. Write these values on Step 4 completion.

---

### Email Verification is Off
`enable_confirmations = false` in Supabase Auth. Users can sign up with any email address without verifying it. This is fine for development but must be turned on with a real SMTP provider before production.

**Fix:** Configure a production SMTP provider in Supabase. Re-enable email confirmation. Update the auth flow to handle the confirmation step.

---

## 🟡 Security — Known Gaps

### Admin Dashboard Uses One Static Shared Password
`/v2/admin` is gated by a single `OOO_ADMIN_PASSWORD` shared across all users of the dashboard. There is no per-user identity, no audit trail of who did what, and no way to revoke access for one person without changing the password for everyone.

**Risk:** Anyone with the password has full access to all event data, AI insights, and event management.

**Fix (proper):** Replace with Supabase Auth + row-level organizer permissions. Create a proper admin role.
**Fix (interim):** Rotate the password regularly. Limit who knows it.

---

### Two SECURITY DEFINER Views Trip the Supabase Advisor
`attendee_profiles` and `matched_event_attendance` both use `security_invoker = false` (the Supabase default). The security advisor flags this. A `security_invoker = true` flip would break matched-profile viewing app-wide because the views need to cross RLS boundaries.

**Planned fix:** Convert both to `SECURITY DEFINER` functions instead of views. This removes the advisor warning without breaking access patterns. (Audit §3.3 — deferred.)

---

### Google OAuth Bypasses Profile Setup
The Google sign-in button exists in the UI but OAuth is not fully configured. If it were enabled, a Google sign-in would not trigger the profile setup redirect.

**Fix:** After completing Google OAuth configuration, update the post-auth routing to check `profile_completed` and redirect to `/v2/setup` if false (same logic as email signup).

---

### `admin-gen-link` Slug Still Exists in Supabase Dashboard
The function has been neutralized to return `410 Gone`, but the slug still exists in the Supabase Edge Functions dashboard.

**Fix:** Delete the slug from the Supabase dashboard → Edge Functions.

---

## 🟠 Data Quality / Ops

### Migration Drift
Local `supabase/migrations/` files and the remote applied migration history are out of sync. Migrations were historically applied via the SQL editor, not the CLI.

**Impact:** `supabase db push` will not work correctly on a new environment.
**Fix:** Run `supabase migration list` against the project and `supabase migration repair` to reconcile before using the CLI migration workflow.

---

### `types.ts` is Stale
`src/integrations/supabase/types.ts` is missing the `event_ai_insights` table (added in `20260903`). TypeScript will not catch type mismatches against that table.

**Fix:** Restore CLI deploy privileges (see SETUP.md), then run `npm run generate-types`.

---

### Supabase CLI Lacks Deploy Privileges
The CLI account returns 403 on `supabase functions deploy` and `npm run generate-types`. All function deploys currently go through the Supabase MCP tool.

**Fix:** A project owner/admin needs to grant deploy access in the Supabase dashboard, or run deploys themselves.

---

### `matching_goal` is Half-Retired
The `matching_goal` column on `profiles` is being phased out in favor of `primary_goal`. Both are currently dual-written by the onboarding flow. The scorer may read from one but not the other in some paths.

**Fix:** Audit the scorer and onboarding for all reads/writes of both columns. Pick one, migrate data to it, remove the other with a migration.

---

### `admin-run-matching` Never Deployed
The `admin-run-matching` edge function was written as a one-off operator tool but never deployed. It lives in `supabase/functions/` unnecessarily.

**Fix:** Deploy when needed for a backfill operation, then delete the slug from the dashboard. Or delete it from the repo if no longer needed.

---

## 🔵 Cleanup / Technical Debt

### ~8 Dead Tables
Tables from the original Lovable V1 schema that are no longer used by the V2 application. Identified in the schema health audit (Audit §4):
- `connection_actions` (V1 audit log — superseded)
- `event_analytics` (V1 analytics — superseded by enterprise dashboard)
- `admin_actions` (V1 admin audit — superseded)
- Legacy V1 `event_registrations` columns

**Risk:** Low. Dead tables waste storage and add confusion. No functional impact.
**Fix:** Drop unused tables in a cleanup migration. Verify no remaining reads first.

---

### ~16 Dead Columns on Active Tables
Various columns added during early development that are no longer read or written by any active code path.

**Fix:** Audit active code against schema. Add nullability or drop columns in a cleanup migration.

---

### V1 Files Still in the Repo
`src/pages/OffripPreview.tsx` and related V1 design files exist as a visual reference. They are dead code and should not be deployed.

**Fix:** Delete V1 files. Remove the `/offrip-preview` route from `App.tsx`. Verify no V2 code imports from V1.

---

### No CI
`tsc -b`, `npm run lint`, `npm test`, and `npm run build` all pass on `main`, but nothing enforces this on pull requests.

**Fix:** Add a GitHub Actions workflow that runs these four checks on every PR.

---

### Unread Badge Can Never Clear
The Messages tab unread indicator (red dot) can turn on when a new message arrives, but the dot persists even after the user reads all messages if they navigate away and back. Root cause: the `mark_message_thread_read()` RPC exists and works, but is not called consistently in all navigation paths.

**Fix:** Ensure `mark_message_thread_read()` is called whenever a thread is opened, including when navigating from a notification.

---

### `codex/` Branches Unmerged
Two feature branches have never been merged to `main`:
- `codex/concierge-v1-filter-and-terms-cleanup`
- `codex/profile-integrity-and-crash-recovery`

**Fix:** Review each branch. Merge, close, or cherry-pick the relevant changes.
