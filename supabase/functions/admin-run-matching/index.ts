// TEMPORARY, single-use admin utility for the v2.1 bulk match regeneration.
// Reuses match-engine's exact scoring logic (scorer.ts, copied verbatim) but
// takes an explicit profileId instead of inferring it from the caller's JWT,
// so an operator can drive per-user regeneration for users other than
// themselves. Gated to a hardcoded allowlist of admin account ids -- this is
// NOT meant to be a permanent endpoint. Delete this function once the bulk
// regeneration is complete.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildMatchDetails, calculateMatchScore, type MatchDetails, type MatchResult, type Profile } from "./scorer.ts";

// The two QA accounts used for this session's verification work. Only these
// may invoke this endpoint.
const ADMIN_ALLOWLIST = new Set([
  "5a0fbe84-8ecd-4e4c-870d-f5e87daeb4f1",
  "4bf862c7-f41d-41bd-9f6d-4724d734bb32",
]);

const PROFILE_SELECT =
  "id, full_name, role_type, secondary_role_types, role_details, who_to_meet, desired_outcomes, areas_of_expertise, expertise_sought, matching_goal, primary_goal, secondary_goals, primary_function, additional_functions, seniority, career_level_preference, industry_focus, industries, industry_preference, needs, offers, connection_preference, interests, communities, hobbies, music_interests, favorite_conferences, location, location_city, location_state_code, location_preference, profile_completed, profile_completion_score, updated_at, linkedin_url";

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

const pairKey = (idA: string, idB: string) => [idA, idB].sort().join("|");

async function runMatchingForProfile(profileId: string, eventId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is unavailable");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: requestingProfileRow, error: profileError } = await supabase
    .from("profiles").select(PROFILE_SELECT).eq("id", profileId).maybeSingle();
  if (profileError) throw new Error(`Profile lookup failed: ${profileError.message}`);
  if (!requestingProfileRow) throw new Error("Profile is unavailable");

  const { data: ownRegistration, error: ownRegError } = await supabase
    .from("event_registrations").select("id").eq("event_id", eventId).eq("profile_id", profileId).maybeSingle();
  if (ownRegError) throw new Error(`Registration lookup failed: ${ownRegError.message}`);
  if (!ownRegistration) throw new Error("Registration is unavailable for this profile/event");

  const { data: otherRegistrations, error: attendeesError } = await supabase
    .from("event_registrations")
    .select(`profile_id, profiles!inner(${PROFILE_SELECT})`)
    .eq("event_id", eventId).neq("profile_id", profileId).not("profile_id", "is", null);
  if (attendeesError) throw new Error(`Attendee lookup failed: ${attendeesError.message}`);

  const requestingProfile = toScoringProfile(requestingProfileRow as Record<string, unknown>);
  const otherProfilesById = new Map<string, Profile>();
  for (const row of otherRegistrations ?? []) {
    const profileRow = (row as unknown as { profiles: Record<string, unknown> | null }).profiles;
    if (profileRow && !otherProfilesById.has(profileRow.id as string)) {
      otherProfilesById.set(profileRow.id as string, toScoringProfile(profileRow));
    }
  }
  const otherProfiles = Array.from(otherProfilesById.values());

  const scoredMatches: { other: Profile; result: MatchResult; details: MatchDetails }[] = [];
  for (const other of otherProfiles) {
    const result = calculateMatchScore(requestingProfile, other);
    scoredMatches.push({ other, result, details: buildMatchDetails(requestingProfile, other) });
  }

  const { data: existingMatches, error: existingError } = await supabase
    .from("matches").select("id, user_a_id, user_b_id").eq("event_id", eventId);
  if (existingError) throw new Error(`Existing match lookup failed: ${existingError.message}`);

  const existingByPair = new Map((existingMatches ?? []).map((m) => [pairKey(m.user_a_id as string, m.user_b_id as string), m]));
  let matchesUpdated = 0;
  const rowsToInsert: Record<string, unknown>[] = [];
  const now = new Date().toISOString();

  const storedValues = (result: MatchResult, details: MatchDetails, orientedAsCalculated: boolean): Record<string, unknown> => {
    const aToBScore = orientedAsCalculated ? result.aToBScore : result.bToAScore;
    const bToAScore = orientedAsCalculated ? result.bToAScore : result.aToBScore;
    const aToBConfidence = orientedAsCalculated ? result.aToBConfidence : result.bToAConfidence;
    const bToAConfidence = orientedAsCalculated ? result.bToAConfidence : result.aToBConfidence;
    const scoreBreakdown = orientedAsCalculated ? result.scoreBreakdown : { aToB: result.scoreBreakdown.bToA, bToA: result.scoreBreakdown.aToB };
    const matchEvidence = orientedAsCalculated ? result.matchEvidence : { aToB: result.matchEvidence.bToA, bToA: result.matchEvidence.aToB };
    const reasons = orientedAsCalculated ? result.aToBReasons : result.bToAReasons;
    const reciprocityLabel = orientedAsCalculated
      ? result.reciprocityLabel
      : result.reciprocityLabel === "They Can Help You" ? "You Can Help Them"
        : result.reciprocityLabel === "You Can Help Them" ? "They Can Help You"
          : result.reciprocityLabel;
    return {
      a_to_b_score: aToBScore, b_to_a_score: bToAScore,
      a_to_b_confidence: aToBConfidence, b_to_a_confidence: bToAConfidence,
      reciprocity_label: reciprocityLabel, score_version: result.scoreVersion,
      score_breakdown: scoreBreakdown, match_evidence: matchEvidence,
      match_details: orientedAsCalculated ? details : {
        ...details,
        matchedGoals: details.matchedGoals.map(({ goalA, goalB, ...rest }) => ({ goalA: goalB, goalB: goalA, ...rest })),
        matchedRoles: details.matchedRoles.map(({ roleA, roleB, ...rest }) => ({ roleA: roleB, roleB: roleA, ...rest })),
        needsOffersAToB: details.needsOffersBToA, needsOffersBToA: details.needsOffersAToB,
      },
      match_score: aToBScore, match_reason: reasons.join(" "), generated_at: now,
    };
  };

  for (const match of scoredMatches) {
    const key = pairKey(profileId, match.other.id);
    const existing = existingByPair.get(key);
    if (existing) {
      const orientedAsCalculated = existing.user_a_id === profileId;
      const { error: updateError } = await supabase
        .from("matches").update(storedValues(match.result, match.details, orientedAsCalculated)).eq("id", existing.id);
      if (updateError) throw new Error(`Match update failed for pair with ${match.other.id}: ${updateError.message}`);
      matchesUpdated += 1;
      continue;
    }
    existingByPair.set(key, { id: "pending", user_a_id: profileId, user_b_id: match.other.id });
    rowsToInsert.push({
      user_a_id: profileId, user_b_id: match.other.id, event_id: eventId,
      ...storedValues(match.result, match.details, true),
      shared_goals: sharedGoals(requestingProfile, match.other),
      shared_industries: overlapValues(requestingProfile.industry_focus, match.other.industry_focus),
      shared_interests: sharedInterestsList(requestingProfile, match.other),
      ai_explanation: "", conversation_starters: [], recommended_next_step: "Request to Connect",
    });
  }

  let matchesSaved = 0;
  if (rowsToInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase.from("matches").insert(rowsToInsert).select("id");
    if (insertError) throw new Error(`Match persistence failed: ${insertError.message}`);
    matchesSaved = inserted?.length ?? 0;
  }

  return { matchesGenerated: scoredMatches.length, matchesSaved, matchesUpdated };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed." }), { status: 405 });
  }

  const authorizationHeader = request.headers.get("authorization") ?? "";
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorizationHeader);
  if (!bearerMatch?.[1]) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized." }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ success: false, error: "Supabase environment is unavailable." }), { status: 500 });
  }
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorizationHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(bearerMatch[1]);
  if (userError || !userData.user?.id) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized." }), { status: 401 });
  }
  if (!ADMIN_ALLOWLIST.has(userData.user.id)) {
    return new Response(JSON.stringify({ success: false, error: "Forbidden." }), { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid request." }), { status: 400 });
  }
  const { eventId, profileId } = (body ?? {}) as { eventId?: unknown; profileId?: unknown };
  if (typeof eventId !== "string" || typeof profileId !== "string") {
    return new Response(JSON.stringify({ success: false, error: "eventId and profileId are required." }), { status: 400 });
  }

  try {
    const result = await runMatchingForProfile(profileId, eventId);
    return new Response(JSON.stringify({ success: true, profileId, eventId, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
