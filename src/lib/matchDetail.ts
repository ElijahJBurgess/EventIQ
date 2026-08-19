// Data-fetch layer for Full Profile View (one match, both full profiles).
// Plain async function rather than a hook or react-query: nothing else in
// this codebase actually uses react-query yet (it's only provisioned in
// App.tsx), and every existing data-fetch (MatchesTab, DashboardV2) is a
// plain async function called from a component's own useEffect. Matching
// that pattern keeps this callable from a component effect, another
// function, or a script -- without imposing hook rules on Piece 6 before
// it exists.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface MatchDetailProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  role_type: string | null;
  secondary_role_types: string[];
  primary_goal: string | null;
  secondary_goals: string[];
  needs: string[];
  offers: string[];
  areas_of_expertise: string[];
  role_details: Json | null;
}

export interface MatchDetailMatch {
  id: string;
  eventId: string | null;
  score: number;
  scoreBreakdown: Json | null;
  matchDetails: Json | null;
  reason: string | null;
  sharedGoals: string[];
  sharedInterests: string[];
  sharedIndustries: string[];
  sharedCommunities: string[];
  generatedAt: string | null;
}

export interface MatchDetailResult {
  match: MatchDetailMatch;
  currentUser: MatchDetailProfile;
  otherPerson: MatchDetailProfile;
}

const PROFILE_DETAIL_FIELDS =
  "id, full_name, avatar_url, title, company, location, role_type, secondary_role_types, primary_goal, secondary_goals, needs, offers, areas_of_expertise, role_details";

function toDetailProfile(row: unknown): MatchDetailProfile | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    full_name: (r.full_name as string | null) ?? null,
    avatar_url: (r.avatar_url as string | null) ?? null,
    title: (r.title as string | null) ?? null,
    company: (r.company as string | null) ?? null,
    location: (r.location as string | null) ?? null,
    role_type: (r.role_type as string | null) ?? null,
    secondary_role_types: (r.secondary_role_types as string[] | null) ?? [],
    primary_goal: (r.primary_goal as string | null) ?? null,
    secondary_goals: (r.secondary_goals as string[] | null) ?? [],
    needs: (r.needs as string[] | null) ?? [],
    offers: (r.offers as string[] | null) ?? [],
    areas_of_expertise: (r.areas_of_expertise as string[] | null) ?? [],
    role_details: (r.role_details as Json | null) ?? null,
  };
}

/**
 * Everything Full Profile View needs for one match, in a single round
 * trip: the full matches row (including match_details) plus both people's
 * full profiles, fetched via named FK embeds (matches has two separate FKs
 * to profiles, so each embed must name its constraint explicitly).
 *
 * Returns null when the match doesn't exist, or when currentUserId isn't
 * actually one of the two people on this match (defensive -- RLS already
 * prevents fetching someone else's match row when using the real
 * authenticated client, but this keeps the function's own contract
 * unambiguous regardless of caller).
 *
 * Throws on a genuine fetch error (network/permission/etc.) so the caller
 * -- Full Profile View's UI, in Piece 6 -- decides how to surface it;
 * "not found" is a valid, expected outcome and is not an error.
 */
export async function fetchMatchDetail(matchId: string, currentUserId: string): Promise<MatchDetailResult | null> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      `id, event_id, match_score, score_breakdown, match_details, match_reason, shared_goals, shared_interests, shared_industries, shared_communities, generated_at, user_a_id, user_b_id,
      user_a:profiles!matches_user_a_id_fkey(${PROFILE_DETAIL_FIELDS}),
      user_b:profiles!matches_user_b_id_fkey(${PROFILE_DETAIL_FIELDS})`,
    )
    .eq("id", matchId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (data.user_a_id !== currentUserId && data.user_b_id !== currentUserId) return null;

  const isCurrentUserA = data.user_a_id === currentUserId;
  const currentUser = toDetailProfile(isCurrentUserA ? data.user_a : data.user_b);
  const otherPerson = toDetailProfile(isCurrentUserA ? data.user_b : data.user_a);
  if (!currentUser || !otherPerson) return null;

  return {
    match: {
      id: data.id,
      eventId: data.event_id,
      score: data.match_score ?? 0,
      scoreBreakdown: data.score_breakdown,
      matchDetails: data.match_details,
      reason: data.match_reason,
      sharedGoals: data.shared_goals ?? [],
      sharedInterests: data.shared_interests ?? [],
      sharedIndustries: data.shared_industries ?? [],
      sharedCommunities: data.shared_communities ?? [],
      generatedAt: data.generated_at,
    },
    currentUser,
    otherPerson,
  };
}
