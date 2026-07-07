CREATE TABLE public.event_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_code TEXT,
  selected_event TEXT,
  full_name TEXT,
  email TEXT,
  phone_number TEXT,
  job_title TEXT,
  company TEXT,
  city TEXT,
  linkedin_url TEXT,
  role_type TEXT,
  career_stage TEXT,
  goals TEXT[] NOT NULL DEFAULT '{}',
  looking_for TEXT,
  offering TEXT,
  role_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_screen TEXT NOT NULL DEFAULT 'app',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.connection_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_name TEXT NOT NULL,
  match_company TEXT,
  action_type TEXT NOT NULL CHECK (action_type IN ('view_profile', 'save_contact', 'request_intro', 'mark_met', 'linkedin_click', 'draft_followup')),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.concierge_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt TEXT NOT NULL,
  recommended_matches TEXT[] NOT NULL DEFAULT '{}',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  label TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.event_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  screen TEXT,
  label TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit event registrations"
ON public.event_registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can record connection actions"
ON public.connection_actions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can record concierge prompts"
ON public.concierge_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can record admin dashboard actions"
ON public.admin_actions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can record analytics events"
ON public.event_analytics
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE INDEX idx_event_registrations_email ON public.event_registrations (email);
CREATE INDEX idx_event_registrations_role_type ON public.event_registrations (role_type);
CREATE INDEX idx_connection_actions_match_name ON public.connection_actions (match_name);
CREATE INDEX idx_connection_actions_action_type ON public.connection_actions (action_type);
CREATE INDEX idx_concierge_logs_created_at ON public.concierge_logs (created_at DESC);
CREATE INDEX idx_admin_actions_action_type ON public.admin_actions (action_type);
CREATE INDEX idx_event_analytics_event_name ON public.event_analytics (event_name);
CREATE INDEX idx_event_analytics_created_at ON public.event_analytics (created_at DESC);