// Supabase Edge Function: match-engine
//
// POST { eventId } -> verifies the caller and scores their profile against every
// other attendee registered for the same event (using the scorer from
// ./scorer.ts), saves every pair into the `matches` table, and returns a
// summary of what happened.
//
// Server-side only. Uses the service role key (auto-provided by the Supabase
// Edge Runtime) to bypass RLS for the write, since this is a trusted backend
// job, not a user-facing table write.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createMatchEngineHandler,
  type MatchEngineAuthClient,
  type MatchEngineResult,
} from "./handler.ts";
import { buildMatchDetails, calculateMatchScore, type MatchDetails, type MatchResult, type Profile } from "./scorer.ts";

const PROFILE_SELECT =
  "id, full_name, role_type, secondary_role_types, role_details, who_to_meet, desired_outcomes, areas_of_expertise, expertise_sought, matching_goal, primary_goal, secondary_goals, primary_function, additional_functions, seniority, career_level_preference, industry_focus, industries, industry_preference, needs, offers, connection_preference, interests, communities, hobbies, music_interests, favorite_conferences, location, location_city, location_state_code, location_preference, profile_completed, profile_completion_score, updated_at, linkedin_url";

/** DB row (fetched with PROFILE_SELECT) -> the shape scorer.ts expects. */
function toScoringProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    full_name: (row.full_name as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    location_city: (row.location_city as string | null) ?? null,
    location_state_code: (row.location_state_code as string | null) ?? null,
    location_preference: (row.location_preference as string | null) ?? null,
    role_type: (row.role_type as string | null) ?? null,
    secondary_role_types: (row.secondary_role_types as string[] | null) ?? [],
    // company/title aren't in this function's fetch list (per spec) and
    // aren't used by any scoring calculation in scorer.ts -- present only
    // to satisfy the Profile type.
    company: null,
    title: null,
    who_to_meet: (row.who_to_meet as string[] | null) ?? null,
    desired_outcomes: (row.desired_outcomes as string[] | null) ?? null,
    areas_of_expertise: (row.areas_of_expertise as string[] | null) ?? null,
    expertise_sought: (row.expertise_sought as string[] | null) ?? null,
    primary_function: (row.primary_function as string | null) ?? null,
    additional_functions: (row.additional_functions as string[] | null) ?? null,
    seniority: (row.seniority as string | null) ?? null,
    career_level_preference: (row.career_level_preference as string[] | null) ?? null,
    matching_goal: (row.matching_goal as string | null) ?? null,
    primary_goal: (row.primary_goal as string | null) ?? null,
    secondary_goals: (row.secondary_goals as string[] | null) ?? null,
    role_details: (row.role_details as Record<string, unknown> | null) ?? null,
    industry_focus: (row.industry_focus as string[] | null) ?? null,
    industries: (row.industries as string[] | null) ?? null,
    industry_preference: (row.industry_preference as string | null) ?? null,
    needs: (row.needs as string[] | null) ?? null,
    offers: (row.offers as string[] | null) ?? null,
    connection_preference: (row.connection_preference as string[] | null) ?? null,
    interests: (row.interests as string[] | null) ?? null,
    communities: (row.communities as string[] | null) ?? null,
    hobbies: (row.hobbies as string[] | null) ?? null,
    music_interests: (row.music_interests as string[] | null) ?? null,
    favorite_conferences: (row.favorite_conferences as string[] | null) ?? null,
    profile_completed: (row.profile_completed as boolean | null) ?? null,
    profile_completion_score: (row.profile_completion_score as number | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
    linkedin_url: (row.linkedin_url as string | null) ?? null,
  };
}

function overlapValues(a: string[] | null, b: string[] | null): string[] {
  if (!a?.length || !b?.length) return [];
  const bSet = new Set(b.map((v) => v.trim().toLowerCase()));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of a) {
    const key = item.trim().toLowerCase();
    if (bSet.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function sharedGoals(a: Profile, b: Profile): string[] {
  const goalsA = [a.primary_goal, ...(a.secondary_goals ?? [])].filter((goal): goal is string => Boolean(goal));
  const goalsB = [b.primary_goal, ...(b.secondary_goals ?? [])].filter((goal): goal is string => Boolean(goal));
  return overlapValues(
    goalsA.length > 0 ? goalsA : a.matching_goal ? [a.matching_goal] : [],
    goalsB.length > 0 ? goalsB : b.matching_goal ? [b.matching_goal] : [],
  );
}

function sharedInterestsList(a: Profile, b: Profile): string[] {
  return [
    ...overlapValues(a.interests, b.interests),
    ...overlapValues(a.communities, b.communities),
    ...overlapValues(a.hobbies, b.hobbies),
    ...overlapValues(a.music_interests, b.music_interests),
    ...overlapValues(a.favorite_conferences, b.favorite_conferences),
  ];
}

/** Order-independent key so we can detect a match in either direction. */
const pairKey = (idA: string, idB: string) => [idA, idB].sort().join("|");

async function runMatching(profileId: string, eventId: string): Promise<MatchEngineResult> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment is unavailable");
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Fetch the requesting profile.
    const { data: requestingProfileRow, error: profileError } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", profileId)
      .maybeSingle();

    if (profileError) {
      throw new Error("Profile lookup failed");
    }
    if (!requestingProfileRow) {
      throw new Error("Profile is unavailable");
    }

    // 2. Confirm the profile is registered for this event.
    const { data: ownRegistration, error: ownRegError } = await supabase
      .from("event_registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (ownRegError) {
      throw new Error("Registration lookup failed");
    }
    if (!ownRegistration) {
      throw new Error("Registration is unavailable");
    }

    // 3. Fetch all OTHER attendees registered for the same event.
    const { data: otherRegistrations, error: attendeesError } = await supabase
      .from("event_registrations")
      .select(`profile_id, profiles!inner(${PROFILE_SELECT})`)
      .eq("event_id", eventId)
      .neq("profile_id", profileId)
      .not("profile_id", "is", null);

    if (attendeesError) {
      throw new Error("Attendee lookup failed");
    }

    const requestingProfile = toScoringProfile(requestingProfileRow as Record<string, unknown>);

    // De-dupe in case a profile has more than one registration row for the event.
    const otherProfilesById = new Map<string, Profile>();
    for (const row of otherRegistrations ?? []) {
      const profileRow = (row as unknown as { profiles: Record<string, unknown> | null }).profiles;
      if (profileRow && !otherProfilesById.has(profileRow.id as string)) {
        otherProfilesById.set(profileRow.id as string, toScoringProfile(profileRow));
      }
    }
    const otherProfiles = Array.from(otherProfilesById.values());

    // 4 & 5. Score every pair in both directions. Eligibility is deliberately
    // not applied here: persisted rows remain available for audit/rescoring;
    // the later UI change will filter on directional score and confidence.
    const scoredMatches: {
      other: Profile;
      result: MatchResult;
      details: MatchDetails;
    }[] = [];
    for (const other of otherProfiles) {
      const result = calculateMatchScore(requestingProfile, other);
      scoredMatches.push({
        other,
        result,
        details: buildMatchDetails(requestingProfile, other),
      });
    }

    // 6/7. Check for existing matches (either direction) before inserting.
    const { data: existingMatches, error: existingError } = await supabase
      .from("matches")
      .select("id, user_a_id, user_b_id")
      .eq("event_id", eventId);

    if (existingError) {
      throw new Error("Existing match lookup failed");
    }

    const existingByPair = new Map(
      (existingMatches ?? []).map((m) => [pairKey(m.user_a_id as string, m.user_b_id as string), m]),
    );

    let matchesUpdated = 0;
    const rowsToInsert: Record<string, unknown>[] = [];
    const now = new Date().toISOString();

    const storedValues = (
      result: MatchResult,
      details: MatchDetails,
      orientedAsCalculated: boolean,
    ): Record<string, unknown> => {
      const aToBScore = orientedAsCalculated ? result.aToBScore : result.bToAScore;
      const bToAScore = orientedAsCalculated ? result.bToAScore : result.aToBScore;
      const aToBConfidence = orientedAsCalculated ? result.aToBConfidence : result.bToAConfidence;
      const bToAConfidence = orientedAsCalculated ? result.bToAConfidence : result.aToBConfidence;
      const scoreBreakdown = orientedAsCalculated
        ? result.scoreBreakdown
        : { aToB: result.scoreBreakdown.bToA, bToA: result.scoreBreakdown.aToB };
      const matchEvidence = orientedAsCalculated
        ? result.matchEvidence
        : { aToB: result.matchEvidence.bToA, bToA: result.matchEvidence.aToB };
      const reasons = orientedAsCalculated ? result.aToBReasons : result.bToAReasons;
      const reciprocityLabel = orientedAsCalculated
        ? result.reciprocityLabel
        : result.reciprocityLabel === "They Can Help You"
          ? "You Can Help Them"
          : result.reciprocityLabel === "You Can Help Them"
            ? "They Can Help You"
            : result.reciprocityLabel;
      return {
        a_to_b_score: aToBScore,
        b_to_a_score: bToAScore,
        a_to_b_confidence: aToBConfidence,
        b_to_a_confidence: bToAConfidence,
        reciprocity_label: reciprocityLabel,
        score_version: result.scoreVersion,
        score_breakdown: scoreBreakdown,
        match_evidence: matchEvidence,
        match_details: orientedAsCalculated
          ? details
          : {
              ...details,
              matchedGoals: details.matchedGoals.map(({ goalA, goalB, ...rest }) => ({ goalA: goalB, goalB: goalA, ...rest })),
              matchedRoles: details.matchedRoles.map(({ roleA, roleB, ...rest }) => ({ roleA: roleB, roleB: roleA, ...rest })),
              needsOffersAToB: details.needsOffersBToA,
              needsOffersBToA: details.needsOffersAToB,
            },
        // Transitional shared values remain populated for the unchanged UI.
        match_score: aToBScore,
        match_reason: reasons.join(" "),
        generated_at: now,
      };
    };

    for (const match of scoredMatches) {
      const key = pairKey(profileId, match.other.id);
      const existing = existingByPair.get(key);
      if (existing) {
        const orientedAsCalculated = existing.user_a_id === profileId;
        const { error: updateError } = await supabase
          .from("matches")
          .update(storedValues(match.result, match.details, orientedAsCalculated))
          .eq("id", existing.id);
        if (updateError) throw new Error("Match update failed");
        matchesUpdated += 1;
        continue;
      }
      existingByPair.set(key, { id: "pending", user_a_id: profileId, user_b_id: match.other.id });

      rowsToInsert.push({
        user_a_id: profileId,
        user_b_id: match.other.id,
        event_id: eventId,
        ...storedValues(match.result, match.details, true),
        shared_goals: sharedGoals(requestingProfile, match.other),
        shared_industries: overlapValues(requestingProfile.industry_focus, match.other.industry_focus),
        shared_interests: sharedInterestsList(requestingProfile, match.other),
        ai_explanation: "",
        conversation_starters: [],
        recommended_next_step: "Request to Connect",
      });
    }

    // 8. Save.
    let matchesSaved = 0;
    if (rowsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("matches")
        .insert(rowsToInsert)
        .select("id");

      if (insertError) {
        throw new Error("Match persistence failed");
      }
      matchesSaved = inserted?.length ?? 0;
    }

    return {
      matchesGenerated: scoredMatches.length,
      matchesSaved,
      matchesUpdated,
      skippedDuplicates: 0,
    };
  } catch {
    throw new Error("Match engine failed");
  }
}

const LOCAL_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];
const configuredOrigins = (
  Deno.env.get("MATCH_ENGINE_ALLOWED_ORIGINS") ??
  Deno.env.get("CONCIERGE_ALLOWED_ORIGINS") ??
  ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...LOCAL_ORIGINS, ...configuredOrigins]);

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

const handler = createMatchEngineHandler({
  allowedOrigins,
  createAuthClient: (authorizationHeader) => {
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase environment is unavailable");
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorizationHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as MatchEngineAuthClient;
  },
  runMatching,
});

Deno.serve(handler);
