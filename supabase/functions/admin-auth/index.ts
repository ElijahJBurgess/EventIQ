import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function topSelections(selectionsByAttendee: string[][], limit = 5) {
  const totals = new Map<string, { label: string; count: number }>();
  for (const selections of selectionsByAttendee) {
    const uniqueSelections = new Map<string, string>();
    for (const selection of selections) {
      const label = selection?.trim();
      if (label) uniqueSelections.set(label.toLocaleLowerCase(), label);
    }
    for (const [key, label] of uniqueSelections) {
      const existing = totals.get(key);
      totals.set(key, { label: existing?.label ?? label, count: (existing?.count ?? 0) + 1 });
    }
  }
  return [...totals.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return Response.json({ valid: false }, { status: 405, headers: corsHeaders });
  }

  try {
    const configuredPassword = Deno.env.get("OOO_ADMIN_PASSWORD");
    if (!configuredPassword) {
      console.error("OOO_ADMIN_PASSWORD is not configured");
      return Response.json({ valid: false }, { status: 503, headers: corsHeaders });
    }

    const { passwordHash, action } = await request.json();
    if (typeof passwordHash !== "string" || !/^[a-f0-9]{64}$/.test(passwordHash)) {
      return Response.json({ valid: false }, { status: 400, headers: corsHeaders });
    }

    const configuredHash = await sha256(configuredPassword);
    const valid = secureEqual(passwordHash, configuredHash);
    if (!valid || action !== "event-stats") {
      return Response.json(
        { valid },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, name, date")
      .eq("is_published", true)
      .order("date", { ascending: true });
    if (eventsError) throw eventsError;

    const eventIds = (events ?? []).map((event) => event.id);
    const { data: registrations, error: registrationsError } = eventIds.length === 0
      ? { data: [], error: null }
      : await supabase
        .from("event_registrations")
        .select("event_id, profile_id, is_checked_in")
        .in("event_id", eventIds);
    if (registrationsError) throw registrationsError;

    const profileIds = [...new Set((registrations ?? []).map((registration) => registration.profile_id).filter(Boolean))];
    const { data: profiles, error: profilesError } = profileIds.length === 0
      ? { data: [], error: null }
      : await supabase
        .from("profiles")
        .select("id, matching_goal, areas_of_expertise, interests, communities")
        .in("id", profileIds);
    if (profilesError) throw profilesError;

    const eventStats = await Promise.all((events ?? []).map(async (event) => {
      const eventRegistrations = (registrations ?? []).filter((registration) => registration.event_id === event.id);
      const registeredProfileIds = new Set(eventRegistrations.map((registration) => registration.profile_id).filter(Boolean));
      const eventProfiles = (profiles ?? []).filter((profile) => registeredProfileIds.has(profile.id));
      const [matchesResult, connectionRequestsResult, meetingRequestsResult] = await Promise.all([
        supabase.from("matches").select("*", { count: "exact", head: true }).eq("event_id", event.id),
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("event_id", event.id)
          .eq("message_type", "connect_request"),
        supabase.from("meetings").select("status").eq("event_id", event.id),
      ]);
      if (matchesResult.error) throw matchesResult.error;
      if (connectionRequestsResult.error) throw connectionRequestsResult.error;
      if (meetingRequestsResult.error) throw meetingRequestsResult.error;

      return {
        id: event.id,
        name: event.name,
        date: event.date,
        totalRegistrations: eventRegistrations.length,
        totalCheckedIn: eventRegistrations.filter((registration) => registration.is_checked_in).length,
        totalMatches: matchesResult.count ?? 0,
        totalConnectionRequests: connectionRequestsResult.count ?? 0,
        totalMeetingRequests: meetingRequestsResult.data?.length ?? 0,
        meetingsByStatus: {
          requested: meetingRequestsResult.data?.filter((meeting) => meeting.status === "requested").length ?? 0,
          accepted: meetingRequestsResult.data?.filter((meeting) => meeting.status === "accepted").length ?? 0,
          declined: meetingRequestsResult.data?.filter((meeting) => meeting.status === "declined").length ?? 0,
          scheduled: meetingRequestsResult.data?.filter((meeting) => meeting.status === "scheduled").length ?? 0,
          completed: meetingRequestsResult.data?.filter((meeting) => meeting.status === "completed").length ?? 0,
        },
        topMatchingGoals: topSelections(eventProfiles.map((profile) => profile.matching_goal ? [profile.matching_goal] : [])),
        topExpertise: topSelections(eventProfiles.map((profile) => profile.areas_of_expertise ?? [])),
        topInterestsAndCommunities: topSelections(
          eventProfiles.map((profile) => [...(profile.interests ?? []), ...(profile.communities ?? [])]),
        ),
      };
    }));

    return Response.json(
      { valid: true, events: eventStats },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    return Response.json({ valid: false }, { status: 400, headers: corsHeaders });
  }
});
