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
import { buildMatchDetails, calculateMatchScore, type MatchDetails, type Profile } from "./scorer.ts";

const PROFILE_SELECT =
  "id, full_name, role_type, secondary_role_types, role_details, who_to_meet, desired_outcomes, areas_of_expertise, matching_goal, primary_goal, secondary_goals, industry_focus, needs, offers, connection_preference, interests, communities, hobbies, music_interests, favorite_conferences, location";

/** DB row (fetched with PROFILE_SELECT) -> the shape scorer.ts expects. */
function toScoringProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    full_name: (row.full_name as string | null) ?? null,
    location: (row.location as string | null) ?? null,
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
    matching_goal: (row.matching_goal as string | null) ?? null,
    primary_goal: (row.primary_goal as string | null) ?? null,
    secondary_goals: (row.secondary_goals as string[] | null) ?? null,
    role_details: (row.role_details as Record<string, unknown> | null) ?? null,
    industry_focus: (row.industry_focus as string[] | null) ?? null,
    needs: (row.needs as string[] | null) ?? null,
    offers: (row.offers as string[] | null) ?? null,
    connection_preference: (row.connection_preference as string[] | null) ?? null,
    interests: (row.interests as string[] | null) ?? null,
    communities: (row.communities as string[] | null) ?? null,
    hobbies: (row.hobbies as string[] | null) ?? null,
    music_interests: (row.music_interests as string[] | null) ?? null,
    favorite_conferences: (row.favorite_conferences as string[] | null) ?? null,
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

    // 4 & 5. Score every pair. There is intentionally no minimum threshold.
    const scoredMatches: {
      other: Profile;
      score: number;
      breakdown: ReturnType<typeof calculateMatchScore>["scoreBreakdown"];
      reasons: string[];
      details: MatchDetails;
    }[] = [];
    for (const other of otherProfiles) {
      const result = calculateMatchScore(requestingProfile, other);
      scoredMatches.push({
        other,
        score: result.score,
        breakdown: result.scoreBreakdown,
        reasons: result.matchReasons,
        details: buildMatchDetails(requestingProfile, other),
      });
    }

    // 6/7. Check for existing matches (either direction) before inserting.
    const { data: existingMatches, error: existingError } = await supabase
      .from("matches")
      .select("user_a_id, user_b_id")
      .eq("event_id", eventId);

    if (existingError) {
      throw new Error("Existing match lookup failed");
    }

    const existingPairKeys = new Set(
      (existingMatches ?? []).map((m) => pairKey(m.user_a_id as string, m.user_b_id as string)),
    );

    let skippedDuplicates = 0;
    const rowsToInsert: Record<string, unknown>[] = [];
    const now = new Date().toISOString();

    for (const match of scoredMatches) {
      const key = pairKey(profileId, match.other.id);
      if (existingPairKeys.has(key)) {
        skippedDuplicates += 1;
        continue;
      }
      existingPairKeys.add(key); // guard against duplicate pairs within this same run

      rowsToInsert.push({
        user_a_id: profileId,
        user_b_id: match.other.id,
        event_id: eventId,
        match_score: match.score,
        score_breakdown: match.breakdown,
        match_details: match.details,
        match_reason: match.reasons.join(" "),
        shared_goals: sharedGoals(requestingProfile, match.other),
        shared_industries: overlapValues(requestingProfile.industry_focus, match.other.industry_focus),
        shared_interests: sharedInterestsList(requestingProfile, match.other),
        ai_explanation: "",
        conversation_starters: [],
        recommended_next_step: "Request to Connect",
        generated_at: now,
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
      skippedDuplicates,
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
