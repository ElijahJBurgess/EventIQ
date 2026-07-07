-- =========================================================
-- OOO Intelligence v2 relational schema (Lovable Cloud)
-- =========================================================

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  location TEXT,
  company TEXT,
  title TEXT,
  role_type TEXT CHECK (role_type IN ('Founder','Investor','Recruiter','Corporate Leader','Creator','Community Builder','Student','Professional','Sponsor','Other')),
  avatar_url TEXT,
  bio TEXT,
  company_stage TEXT,
  funding_raised TEXT,
  hiring_status BOOLEAN DEFAULT FALSE,
  looking_for_investors BOOLEAN DEFAULT FALSE,
  check_size TEXT,
  industry_focus TEXT[],
  investment_stage TEXT,
  open_roles TEXT[],
  hiring_priorities TEXT,
  candidate_level TEXT,
  hobbies TEXT[],
  interests TEXT[],
  sports TEXT[],
  travel_interests TEXT[],
  favorite_conferences TEXT[],
  communities TEXT[],
  favorite_cities TEXT[],
  music_interests TEXT[],
  festivals TEXT[],
  activities TEXT[],
  linkedin_url TEXT,
  twitter_url TEXT,
  website_url TEXT,
  profile_completed BOOLEAN DEFAULT FALSE,
  profile_completion_score INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- EVENTS
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('Conference','Networking Event','Corporate Event','Community Event','Festival','Sports/Industry Event','Concert','Other')),
  date DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  venue TEXT,
  description TEXT,
  event_goals TEXT[],
  organizer_id UUID REFERENCES public.profiles(id),
  organizer_company TEXT,
  max_capacity INTEGER,
  cover_image_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published events" ON public.events FOR SELECT USING (is_published = true OR organizer_id = auth.uid());
CREATE POLICY "Organizers can manage events" ON public.events FOR ALL USING (organizer_id = auth.uid());
CREATE POLICY "Authenticated can insert events" ON public.events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- EVENT REGISTRATIONS (extend existing legacy table to be relational, keeping v1 columns)
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'attendee';
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'registered';
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ DEFAULT NOW();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;
CREATE POLICY "v2 users can register themselves" ON public.event_registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "v2 users can view registrations" ON public.event_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2 users can update own registration" ON public.event_registrations FOR UPDATE TO authenticated USING (auth.uid() = profile_id);

-- CHECK-INS
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_arrived' CHECK (status IN ('not_arrived','checked_in','active')),
  checked_in_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view check-ins" ON public.check_ins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own check-in" ON public.check_ins FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- MATCHES
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_a_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_score INTEGER DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',
  shared_interests TEXT[],
  shared_goals TEXT[],
  shared_communities TEXT[],
  shared_industries TEXT[],
  match_reason TEXT,
  conversation_starters TEXT[],
  recommended_next_step TEXT,
  ai_explanation TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_a_id, user_b_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their matches" ON public.matches FOR SELECT TO authenticated USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
CREATE POLICY "Authenticated can insert matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (true);

-- MATCH ACTIONS
CREATE TABLE IF NOT EXISTS public.match_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT CHECK (action_type IN ('match_generated','match_viewed','match_accepted','message_sent','meeting_requested','meeting_scheduled','meeting_completed','follow_up_requested','match_saved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_actions TO authenticated;
GRANT ALL ON public.match_actions TO service_role;
ALTER TABLE public.match_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own match actions" ON public.match_actions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert match actions" ON public.match_actions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text','meetup_coord','meeting_link','note')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- MEETINGS
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_time TIMESTAMPTZ,
  confirmed_time TIMESTAMPTZ,
  location_note TEXT,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'requested' CHECK (status IN ('requested','accepted','declined','completed','cancelled')),
  calendar_export_token TEXT DEFAULT gen_random_uuid()::TEXT,
  meeting_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own meetings" ON public.meetings FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can create meetings" ON public.meetings FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update own meetings" ON public.meetings FOR UPDATE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- SPONSORS
CREATE TABLE IF NOT EXISTS public.sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  tier TEXT CHECK (tier IN ('Title','Platinum','Gold','Silver','Bronze','Community')),
  logo_url TEXT,
  description TEXT,
  booth_location TEXT,
  contact_name TEXT,
  contact_email TEXT,
  goals TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT ON public.sponsors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsors TO authenticated;
GRANT ALL ON public.sponsors TO service_role;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sponsors" ON public.sponsors FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage sponsors" ON public.sponsors FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- SPONSOR ENGAGEMENTS
CREATE TABLE IF NOT EXISTS public.sponsor_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  engagement_type TEXT CHECK (engagement_type IN ('booth_visit','qr_scan','product_sample','content_created','social_share','survey_completed','lead_captured')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsor_engagements TO authenticated;
GRANT ALL ON public.sponsor_engagements TO service_role;
ALTER TABLE public.sponsor_engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sponsor engagements" ON public.sponsor_engagements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can log engagements" ON public.sponsor_engagements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- FEEDBACK
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  matching_rating INTEGER CHECK (matching_rating BETWEEN 1 AND 5),
  networking_quality INTEGER CHECK (networking_quality BETWEEN 1 AND 5),
  would_return BOOLEAN,
  highlights TEXT,
  improvements TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view feedback" ON public.feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can submit feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- POINTS
CREATE TABLE IF NOT EXISTS public.points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id),
  action TEXT NOT NULL,
  points_earned INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.points TO authenticated;
GRANT ALL ON public.points TO service_role;
ALTER TABLE public.points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own points" ON public.points FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert points" ON public.points FOR INSERT TO authenticated WITH CHECK (true);

-- REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES public.profiles(id),
  executive_summary TEXT,
  insights TEXT[],
  recommendations TEXT[],
  outcome_score JSONB,
  raw_metrics JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT ON public.reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reports" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Organizers can create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = generated_by);

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS meetings_updated_at ON public.meetings;
CREATE TRIGGER meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();