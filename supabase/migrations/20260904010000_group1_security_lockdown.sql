-- Group 1 security fix pass — audit findings 1, 2, 3 (docs/v1-readiness-audit.md).
-- Finding 5 (admin-auth CORS wildcard) is an edge-function code change, not SQL.
-- Finding 4 (SECURITY DEFINER views) is deferred to its own pass — untouched here.

-- ---------------------------------------------------------------------------
-- 1. public.reports — was world-readable (anonymous included).
--    The SELECT policy was granted to PUBLIC with USING (true), and anon +
--    authenticated both held the SELECT table grant. No client code reads
--    reports directly: every path (admin-auth list-reports / create-report,
--    delete-account) uses the service-role key, which bypasses RLS and grants.
--    Lock direct SELECT to service-role only.
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can view reports" on public.reports;
revoke select on public.reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. public.feedback — readable by any signed-in user.
--    SELECT policy was TO authenticated USING (true), exposing every row
--    (including the free-text highlights/improvements answers) to all logged-in
--    users. The only client read (ConnectionSelfReportPrompt) already filters
--    to the caller's own user_id; organizer dashboard aggregates run through
--    the service role. Scope the policy to the author.
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated can view feedback" on public.feedback;

create policy "Users can view own feedback"
  on public.feedback
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 3. public.profiles UPDATE — policy had USING (auth.uid() = id) but no
--    WITH CHECK, leaving the post-update row unvalidated (an UPDATE could
--    retarget the row's id). Add the matching WITH CHECK and narrow the role
--    to authenticated (anon can never satisfy auth.uid() = id anyway), to
--    match the sibling "Users can view own complete profile" SELECT policy.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
