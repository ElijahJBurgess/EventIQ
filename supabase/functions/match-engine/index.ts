// Supabase Edge Function: match-engine
//
// POST { profileId, eventId } -> scores the requesting profile against every
// other attendee registered for the same event (using the scorer from
// ./scorer.ts), saves every pair that scores 25+ into the `matches` table,
// and returns a summary of what happened.
//
// Server-side only. Uses the service role key (auto-provided by the Supabase
// Edge Runtime) to bypass RLS for the write, since this is a trusted backend
// job, not a user-facing table write.

import { createClient } from "npm:@supabase/supabase-js@2";
import { calculateMatchScore, type Profile } from "./scorer.ts";

const PROFILE_SELECT =
  "id, full_name, role_type, role_details, who_to_meet, desired_outcomes, areas_of_expertise, matching_goal, industry_focus, interests, communities, hobbies, music_interests, favorite_conferences, location";

const MATCH_THRESHOLD = 25;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** DB row (fetched with PROFILE_SELECT) -> the shape scorer.ts expects. */
function toScoringProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    full_name: (row.full_name as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    role_type: (row.role_type as string | null) ?? null,
    // company/title aren't in this function's fetch list (per spec) and
    // aren't used by any scoring calculation in scorer.ts -- present only
    // to satisfy the Profile type.
    company: null,
    title: null,
    who_to_meet: (row.who_to_meet as string[] | null) ?? null,
    desired_outcomes: (row.desired_outcomes as string[] | null) ?? null,
    areas_of_expertise: (row.areas_of_expertise as string[] | null) ?? null,
    matching_goal: (row.matching_goal as string | null) ?? null,
    role_details: (row.role_details as Record<string, unknown> | null) ?? null,
    industry_focus: (row.industry_focus as string[] | null) ?? null,
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
  if (a.matching_goal && b.matching_goal && a.matching_goal.toLowerCase() === b.matching_goal.toLowerCase()) {
    return [a.matching_goal];
  }
  return [];
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { profileId?: string; eventId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }

    const { profileId, eventId } = body;
    if (!profileId || !eventId) {
      return jsonResponse({ error: "Both profileId and eventId are required." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server misconfiguration: missing Supabase credentials." }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch the requesting profile.
    const { data: requestingProfileRow, error: profileError } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", profileId)
      .maybeSingle();

    if (profileError) {
      return jsonResponse({ error: "Failed to fetch profile.", detail: profileError.message }, 500);
    }
    if (!requestingProfileRow) {
      return jsonResponse({ error: `No profile found with id ${profileId}.` }, 404);
    }

    // 2. Confirm the profile is registered for this event.
    const { data: ownRegistration, error: ownRegError } = await supabase
      .from("event_registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (ownRegError) {
      return jsonResponse({ error: "Failed to check event registration.", detail: ownRegError.message }, 500);
    }
    if (!ownRegistration) {
      return jsonResponse({ error: "Profile not registered for this event" }, 400);
    }

    // 3. Fetch all OTHER attendees registered for the same event.
    const { data: otherRegistrations, error: attendeesError } = await supabase
      .from("event_registrations")
      .select(`profile_id, profiles!inner(${PROFILE_SELECT})`)
      .eq("event_id", eventId)
      .neq("profile_id", profileId)
      .not("profile_id", "is", null);

    if (attendeesError) {
      return jsonResponse({ error: "Failed to fetch event attendees.", detail: attendeesError.message }, 500);
    }

    const requestingProfile = toScoringProfile(requestingProfileRow as Record<string, unknown>);

    // De-dupe in case a profile has more than one registration row for the event.
    const otherProfilesById = new Map<string, Profile>();
    for (const row of otherRegistrations ?? []) {
      const profileRow = (row as { profiles: Record<string, unknown> | null }).profiles;
      if (profileRow && !otherProfilesById.has(profileRow.id as string)) {
        otherProfilesById.set(profileRow.id as string, toScoringProfile(profileRow));
      }
    }
    const otherProfiles = Array.from(otherProfilesById.values());

    // 4 & 5. Score every pair, split by threshold.
    const qualifyingMatches: {
      other: Profile;
      score: number;
      breakdown: ReturnType<typeof calculateMatchScore>["scoreBreakdown"];
      reasons: string[];
    }[] = [];
    let skippedBelowThreshold = 0;

    for (const other of otherProfiles) {
      const result = calculateMatchScore(requestingProfile, other);
      if (result.score >= MATCH_THRESHOLD) {
        qualifyingMatches.push({
          other,
          score: result.score,
          breakdown: result.scoreBreakdown,
          reasons: result.matchReasons,
        });
      } else {
        skippedBelowThreshold += 1;
      }
    }

    // 6/7. Check for existing matches (either direction) before inserting.
    const { data: existingMatches, error: existingError } = await supabase
      .from("matches")
      .select("user_a_id, user_b_id")
      .eq("event_id", eventId);

    if (existingError) {
      return jsonResponse({ error: "Failed to check existing matches.", detail: existingError.message }, 500);
    }

    const existingPairKeys = new Set(
      (existingMatches ?? []).map((m) => pairKey(m.user_a_id as string, m.user_b_id as string)),
    );

    let skippedDuplicates = 0;
    const rowsToInsert: Record<string, unknown>[] = [];
    const now = new Date().toISOString();

    for (const match of qualifyingMatches) {
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
        return jsonResponse({ error: "Failed to save matches.", detail: insertError.message }, 500);
      }
      matchesSaved = inserted?.length ?? 0;
    }

    return jsonResponse(
      {
        profileId,
        matchesGenerated: qualifyingMatches.length,
        matchesSaved,
        skippedDuplicates,
        skippedBelowThreshold,
      },
      200,
    );
  } catch (err) {
    return jsonResponse(
      { error: "Unexpected server error.", detail: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
