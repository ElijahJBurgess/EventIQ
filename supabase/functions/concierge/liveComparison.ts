// Live, ephemeral "how would we score" comparison for people the attendee has
// NOT matched with yet. Reuses the real calculateMatchScore from the copied
// scorer -- no AI explanation, no DB write, no persisted match row.
//
// Import-clean (no Deno globals) so it runs under node:test -- see
// liveComparison.test.ts.

import { calculateMatchScore, type Profile } from "./scorer.ts";

// The columns calculateMatchScore actually consumes -- mirrors
// match-engine/index.ts's PROFILE_SELECT.
export const SCORER_PROFILE_COLUMNS =
  "id, full_name, role_type, secondary_role_types, role_details, who_to_meet, desired_outcomes, areas_of_expertise, expertise_sought, matching_goal, primary_goal, secondary_goals, primary_function, additional_functions, seniority, career_level_preference, industry_focus, industries, industry_preference, needs, offers, connection_preference, interests, communities, hobbies, music_interests, favorite_conferences, location, location_city, location_state_code, location_preference, profile_completed, profile_completion_score, updated_at, linkedin_url";

export const LIVE_COMPARISON_DISCLAIMER =
  "Live, on-the-spot estimate: you two have not officially matched at this event yet and nothing has been saved. Frame it as \"here's how you'd likely score\", never as an existing match.";

/** DB row -> scorer Profile. Mirrors match-engine/index.ts's toScoringProfile. */
export function toScorerProfile(row: Record<string, unknown>): Profile {
  const str = (key: string) => (row[key] as string | null) ?? null;
  const arr = (key: string) => (row[key] as string[] | null) ?? null;
  return {
    id: row.id as string,
    full_name: str("full_name"),
    location: str("location"),
    location_city: str("location_city"),
    location_state_code: str("location_state_code"),
    location_preference: str("location_preference"),
    role_type: str("role_type"),
    secondary_role_types: arr("secondary_role_types") ?? [],
    company: null,
    title: null,
    who_to_meet: arr("who_to_meet"),
    desired_outcomes: arr("desired_outcomes"),
    areas_of_expertise: arr("areas_of_expertise"),
    expertise_sought: arr("expertise_sought"),
    primary_function: str("primary_function"),
    additional_functions: arr("additional_functions"),
    seniority: str("seniority"),
    career_level_preference: arr("career_level_preference"),
    matching_goal: str("matching_goal"),
    primary_goal: str("primary_goal"),
    secondary_goals: arr("secondary_goals"),
    role_details: (row.role_details as Record<string, unknown> | null) ?? null,
    industry_focus: arr("industry_focus"),
    industries: arr("industries"),
    industry_preference: str("industry_preference"),
    needs: arr("needs"),
    offers: arr("offers"),
    connection_preference: arr("connection_preference"),
    interests: arr("interests"),
    communities: arr("communities"),
    hobbies: arr("hobbies"),
    music_interests: arr("music_interests"),
    favorite_conferences: arr("favorite_conferences"),
    profile_completed: (row.profile_completed as boolean | null) ?? null,
    profile_completion_score: (row.profile_completion_score as number | null) ?? null,
    updated_at: str("updated_at"),
    linkedin_url: str("linkedin_url"),
  };
}

export interface CheckedInName {
  id: string;
  fullName: string | null;
}

function wordBoundary(token: string, haystack: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(haystack);
}

/**
 * Deterministically resolve at most one checked-in attendee the question names,
 * restricted to `unmatchedIds` (people the user has no match row with).
 * Returns null on zero or ambiguous matches. Two passes:
 *   strong   -- the candidate's whole name is in the question, OR both the first
 *               and last name appear as whole words.
 *   fallback -- a first/last name token that appears in the question AND is
 *               unique across the ENTIRE checked-in roster (matched + unmatched),
 *               owned by exactly one unmatched candidate.
 */
export function resolveNamedCandidateId(
  question: string,
  checkedIn: CheckedInName[],
  unmatchedIds: ReadonlySet<string>,
): string | null {
  const q = question.toLowerCase();
  const qWords = new Set(q.split(/[^a-z0-9']+/i).filter((word) => word.length >= 2));

  const named = checkedIn
    .filter((person): person is CheckedInName & { fullName: string } =>
      Boolean(person.fullName && person.fullName.trim()))
    .map((person) => {
      const parts = person.fullName.trim().toLowerCase().split(/\s+/).filter(Boolean);
      return { id: person.id, full: person.fullName.trim().toLowerCase(), parts };
    });

  const strong = named.filter((person) =>
    unmatchedIds.has(person.id)
    && (
      q.includes(person.full)
      || (person.parts.length >= 2
        && wordBoundary(person.parts[0], q)
        && wordBoundary(person.parts[person.parts.length - 1], q))
    ));
  if (strong.length === 1) return strong[0].id;
  if (strong.length > 1) return null;

  const tokenOwners = new Map<string, Set<string>>();
  for (const person of named) {
    const tokens = new Set([person.parts[0], person.parts[person.parts.length - 1]].filter(Boolean));
    for (const token of tokens) {
      if (!tokenOwners.has(token)) tokenOwners.set(token, new Set());
      tokenOwners.get(token)!.add(person.id);
    }
  }
  const hits = new Set<string>();
  for (const [token, owners] of tokenOwners) {
    if (qWords.has(token) && owners.size === 1) {
      const [only] = owners;
      if (unmatchedIds.has(only)) hits.add(only);
    }
  }
  return hits.size === 1 ? [...hits][0] : null;
}

export interface LiveMatchResult {
  computedScore: number;
  computedConfidence: number;
  reasons: string[];
  reciprocityLabel: string;
  reverseScore: number;
  reverseConfidence: number;
  scoreVersion: string;
}

/**
 * Run the real calculateMatchScore for (currentUser -> candidate), read-only.
 * `currentUser` is "a", so the viewer-directional values are the aToB ones.
 */
export function computeLiveMatch(currentUser: Profile, candidate: Profile): LiveMatchResult {
  const result = calculateMatchScore(currentUser, candidate);
  return {
    computedScore: result.aToBScore,
    computedConfidence: result.aToBConfidence,
    reasons: result.aToBReasons,
    reciprocityLabel: result.reciprocityLabel,
    reverseScore: result.bToAScore,
    reverseConfidence: result.bToAConfidence,
    scoreVersion: result.scoreVersion,
  };
}
