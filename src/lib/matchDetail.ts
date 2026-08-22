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
import { getViewerReciprocityLabel } from "@/lib/matchPresentation";

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
}

export interface MatchDetailMatch {
  id: string;
  eventId: string | null;
  score: number | null;
  confidence: number | null;
  reciprocityLabel: string | null;
  directionalEvidence: DirectionalEvidenceItem[];
  reverseEvidence: DirectionalEvidenceItem[];
  scoreBreakdown: Json | null;
  matchDetails: Json | null;
  reason: string | null;
  sharedGoals: string[];
  sharedInterests: string[];
  sharedIndustries: string[];
  sharedCommunities: string[];
  generatedAt: string | null;
}

export interface DirectionalEvidenceItem {
  component: string;
  score: number;
  viewerField: string;
  viewerValue: string;
  candidateField: string;
  candidateValue: string;
  mapping: string;
}

export interface MatchDetailResult {
  match: MatchDetailMatch;
  currentUser: MatchDetailProfile;
  otherPerson: MatchDetailProfile;
}

const PROFILE_DETAIL_FIELDS =
  "id, full_name, avatar_url, title, company, location, role_type, secondary_role_types, primary_goal, secondary_goals, needs, offers, areas_of_expertise";

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
  };
}

function parseEvidence(value: Json | null, key: "aToB" | "bToA"): DirectionalEvidenceItem[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const side = (value as Record<string, Json | undefined>)[key];
  if (!Array.isArray(side)) return [];
  const parsed: DirectionalEvidenceItem[] = [];
  for (const item of side) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (
      typeof record.component === "string" &&
      typeof record.score === "number" &&
      record.score > 0 &&
      typeof record.viewerField === "string" &&
      typeof record.viewerValue === "string" &&
      typeof record.candidateField === "string" &&
      typeof record.candidateValue === "string" &&
      typeof record.mapping === "string"
    ) {
      parsed.push({
        component: record.component,
        score: record.score,
        viewerField: record.viewerField,
        viewerValue: record.viewerValue,
        candidateField: record.candidateField,
        candidateValue: record.candidateValue,
        mapping: record.mapping,
      });
    }
  }
  return parsed;
}

function directionalBreakdown(value: Json | null, key: "aToB" | "bToA"): Json | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return ((value as Record<string, Json | undefined>)[key] ?? null) as Json | null;
}

interface StoredDirectionalMatch {
  user_a_id: string | null;
  user_b_id: string | null;
  a_to_b_score: number | null;
  b_to_a_score: number | null;
  a_to_b_confidence: number | null;
  b_to_a_confidence: number | null;
  reciprocity_label: string | null;
  score_breakdown: Json | null;
  match_evidence: Json;
}

export function orientStoredMatch(
  data: StoredDirectionalMatch,
  currentUserId: string,
): Pick<MatchDetailMatch, "score" | "confidence" | "reciprocityLabel" | "directionalEvidence" | "reverseEvidence" | "scoreBreakdown"> | null {
  if (data.user_a_id !== currentUserId && data.user_b_id !== currentUserId) return null;
  const isCurrentUserA = data.user_a_id === currentUserId;
  const viewerKey = isCurrentUserA ? "aToB" : "bToA";
  const reverseKey = isCurrentUserA ? "bToA" : "aToB";
  return {
    score: isCurrentUserA ? data.a_to_b_score : data.b_to_a_score,
    confidence: isCurrentUserA ? data.a_to_b_confidence : data.b_to_a_confidence,
    reciprocityLabel: getViewerReciprocityLabel(data.reciprocity_label, isCurrentUserA),
    directionalEvidence: parseEvidence(data.match_evidence, viewerKey),
    reverseEvidence: parseEvidence(data.match_evidence, reverseKey),
    scoreBreakdown: directionalBreakdown(data.score_breakdown, viewerKey),
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
      "id, event_id, a_to_b_score, b_to_a_score, a_to_b_confidence, b_to_a_confidence, reciprocity_label, score_breakdown, match_evidence, match_details, match_reason, shared_goals, shared_interests, shared_industries, shared_communities, generated_at, user_a_id, user_b_id",
    )
    .eq("id", matchId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const directional = orientStoredMatch(data, currentUserId);
  if (!directional) return null;

  const profileIds = [data.user_a_id, data.user_b_id].filter((id): id is string => Boolean(id));
  const { data: profileRows, error: profileError } = await supabase
    .from("attendee_profiles")
    .select(PROFILE_DETAIL_FIELDS)
    .in("id", profileIds);
  if (profileError) throw profileError;

  const profileById = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));
  const isCurrentUserA = data.user_a_id === currentUserId;
  const currentUser = toDetailProfile(profileById.get(isCurrentUserA ? data.user_a_id : data.user_b_id));
  const otherPerson = toDetailProfile(profileById.get(isCurrentUserA ? data.user_b_id : data.user_a_id));
  if (!currentUser || !otherPerson) return null;

  return {
    match: {
      id: data.id,
      eventId: data.event_id,
      ...directional,
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
