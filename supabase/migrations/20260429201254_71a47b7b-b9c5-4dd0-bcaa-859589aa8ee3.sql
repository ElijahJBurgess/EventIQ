DROP POLICY IF EXISTS "Anyone can submit event registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Anyone can record connection actions" ON public.connection_actions;
DROP POLICY IF EXISTS "Anyone can record concierge prompts" ON public.concierge_logs;
DROP POLICY IF EXISTS "Anyone can record admin dashboard actions" ON public.admin_actions;
DROP POLICY IF EXISTS "Anyone can record analytics events" ON public.event_analytics;

CREATE POLICY "Visitors can submit valid event registrations"
ON public.event_registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  source_screen IN ('join', 'profile', 'goals', 'app')
  AND (email IS NULL OR email = '' OR email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
  AND (full_name IS NULL OR length(full_name) <= 160)
  AND (event_code IS NULL OR length(event_code) <= 80)
  AND (selected_event IS NULL OR length(selected_event) <= 160)
);

CREATE POLICY "Visitors can record valid connection actions"
ON public.connection_actions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(match_name) BETWEEN 1 AND 160
  AND action_type IN ('view_profile', 'save_contact', 'request_intro', 'mark_met', 'linkedin_click', 'draft_followup')
);

CREATE POLICY "Visitors can record valid concierge prompts"
ON public.concierge_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(prompt) BETWEEN 1 AND 500
  AND array_length(recommended_matches, 1) <= 10
);

CREATE POLICY "Visitors can record valid dashboard actions"
ON public.admin_actions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(action_type) BETWEEN 1 AND 80
  AND length(label) BETWEEN 1 AND 160
);

CREATE POLICY "Visitors can record valid analytics events"
ON public.event_analytics
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(event_name) BETWEEN 1 AND 120
  AND (screen IS NULL OR length(screen) <= 80)
  AND (label IS NULL OR length(label) <= 160)
);