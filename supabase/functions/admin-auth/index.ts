import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEventStats, type EventStats } from "./stats.ts";
import {
  createOpenAIResponsesClient,
  fingerprintStats,
  generateCopilotAnswer,
  generateEventInsights,
  INSIGHTS_MODEL_DEFAULT,
} from "./insights.ts";
import {
  BUILDABLE_REPORT_TYPE,
  buildExecutiveSummary,
  KNOWN_REPORT_SECTIONS,
  type ReportSection,
} from "./report.ts";
import { buildEventInsertRow, buildEventUpdateRow } from "./createEvent.ts";

// Columns the Events management tab needs to list and pre-fill an edit form.
const EVENT_ADMIN_COLUMNS = "id, name, venue, location, date, end_date, event_type, is_published, is_demo";

// admin-auth is gated by one shared password (OOO_ADMIN_PASSWORD), not a
// per-admin login -- there is no authenticated user id to attribute a
// dashboard-created event to. Fall back to the platform owner's profile so
// "create-event" no longer leaves organizer_id NULL (which made every
// dashboard-created event permanently unmanageable from /v2/organizer,
// since its RLS policy requires organizer_id = auth.uid()). Overridable via
// env for environments where the owner's account differs.
const DEFAULT_EVENT_OWNER_EMAIL = Deno.env.get("ADMIN_DEFAULT_EVENT_OWNER_EMAIL") ?? "chanise@oooevents.org";

// Browser callers are restricted to an explicit origin allow-list. Non-browser
// callers (no Origin header) are unaffected — CORS is a browser-only control.
const LOCAL_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];
const DEFAULT_REMOTE_ORIGINS = ["https://event-iq-six.vercel.app"];
const allowedOrigins = new Set([
  ...LOCAL_ORIGINS,
  ...DEFAULT_REMOTE_ORIGINS,
  ...(Deno.env.get("ADMIN_AUTH_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

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

type SupabaseClient = ReturnType<typeof createClient>;

async function gatherEventStats(supabase: SupabaseClient): Promise<EventStats[]> {
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, name, date")
    .eq("is_published", true)
    .order("date", { ascending: true });
  if (eventsError) throw eventsError;

  const eventIds = (events ?? []).map((event: { id: string }) => event.id);
  const { data: registrations, error: registrationsError } = eventIds.length === 0
    ? { data: [], error: null }
    : await supabase
      .from("event_registrations")
      .select("event_id, profile_id, is_checked_in")
      .in("event_id", eventIds);
  if (registrationsError) throw registrationsError;

  const profileIds = [
    ...new Set((registrations ?? []).map((registration: { profile_id: string | null }) => registration.profile_id).filter(Boolean)),
  ];
  const { data: profiles, error: profilesError } = profileIds.length === 0
    ? { data: [], error: null }
    : await supabase
      .from("profiles")
      .select(
        "id, profile_completed, primary_goal, seniority, areas_of_expertise, interests, communities, role_type, industries, location",
      )
      .in("id", profileIds);
  if (profilesError) throw profilesError;

  return await Promise.all((events ?? []).map(async (event: { id: string; name: string; date: string | null }) => {
    const eventRegistrations = (registrations ?? []).filter((registration: { event_id: string }) => registration.event_id === event.id);
    const registeredProfileIds = new Set(
      eventRegistrations.map((registration: { profile_id: string | null }) => registration.profile_id).filter(Boolean),
    );
    const eventProfiles = (profiles ?? []).filter((profile: { id: string }) => registeredProfileIds.has(profile.id));
    const [matchesResult, connectionRequestsResult, meetingsResult, matchRowsResult, eventMessagesResult, feedbackResult] = await Promise.all([
      supabase.from("matches").select("*", { count: "exact", head: true }).eq("event_id", event.id),
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("message_type", "connect_request"),
      supabase.from("meetings").select("match_id, status, created_at").eq("event_id", event.id),
      // Every match for this event (not just requested/accepted/declined): this
      // doubles as the match-id list used to scope connection_self_reports,
      // which has no event_id column of its own.
      supabase
        .from("matches")
        .select("id, user_a_id, user_b_id, connection_status, connection_requested_by, connection_status_updated_at")
        .eq("event_id", event.id),
      supabase.from("messages").select("match_id, sender_id, message_type").eq("event_id", event.id),
      supabase.from("feedback").select("user_id, overall_rating, matching_rating, networking_quality").eq("event_id", event.id),
    ]);
    if (matchesResult.error) throw matchesResult.error;
    if (connectionRequestsResult.error) throw connectionRequestsResult.error;
    if (meetingsResult.error) throw meetingsResult.error;
    if (matchRowsResult.error) throw matchRowsResult.error;
    if (eventMessagesResult.error) throw eventMessagesResult.error;
    if (feedbackResult.error) throw feedbackResult.error;

    // connection_self_reports has no event_id, and an .in() over every match id
    // for a busy event blows past the request-URL length limit. The table is
    // tiny globally, so fetch it all and scope in memory.
    const eventMatchIdSet = new Set((matchRowsResult.data ?? []).map((match: { id: string }) => match.id));
    const selfReportsResult = await supabase
      .from("connection_self_reports")
      .select("match_id, user_id, response, was_valuable");
    if (selfReportsResult.error) throw selfReportsResult.error;
    const eventSelfReports = (selfReportsResult.data ?? []).filter(
      (report: { match_id: string | null }) => report.match_id !== null && eventMatchIdSet.has(report.match_id),
    );

    return buildEventStats({
      event,
      registrations: eventRegistrations,
      profiles: eventProfiles,
      matchCount: matchesResult.count ?? 0,
      connectionRequestMessageCount: connectionRequestsResult.count ?? 0,
      matches: matchRowsResult.data ?? [],
      messages: eventMessagesResult.data ?? [],
      meetings: meetingsResult.data ?? [],
      feedback: feedbackResult.data ?? [],
      selfReports: eventSelfReports,
    });
  }));
}

function pickEvent(events: EventStats[], eventId: unknown): EventStats | null {
  if (typeof eventId === "string") return events.find((event) => event.id === eventId) ?? null;
  return events[0] ?? null;
}

function insightsModel() {
  return Deno.env.get("INSIGHTS_OPENAI_MODEL") ?? Deno.env.get("CONCIERGE_OPENAI_MODEL") ?? INSIGHTS_MODEL_DEFAULT;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const json = (body: Record<string, unknown>, status = 200) =>
    Response.json(body, { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });

  if (origin && !allowedOrigins.has(origin)) return json({ valid: false }, 403);
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (request.method !== "POST") return json({ valid: false }, 405);

  try {
    const configuredPassword = Deno.env.get("OOO_ADMIN_PASSWORD");
    if (!configuredPassword) {
      console.error("OOO_ADMIN_PASSWORD is not configured");
      return json({ valid: false }, 503);
    }

    const payload = await request.json();
    const { passwordHash, action } = payload as { passwordHash?: unknown; action?: unknown };
    if (typeof passwordHash !== "string" || !/^[a-f0-9]{64}$/.test(passwordHash)) {
      return json({ valid: false }, 400);
    }

    const valid = secureEqual(passwordHash, await sha256(configuredPassword));
    if (!valid) return json({ valid: false });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    if (action === "event-stats") {
      return json({ valid: true, events: await gatherEventStats(supabase) });
    }

    if (action === "insights") {
      const events = await gatherEventStats(supabase);
      const event = pickEvent(events, (payload as { eventId?: unknown }).eventId);
      if (!event) return json({ valid: true, insights: [], generatedAt: null, cached: false });

      const fingerprint = await fingerprintStats(event);
      const { data: cached } = await supabase
        .from("event_ai_insights")
        .select("insights, stats_fingerprint, generated_at")
        .eq("event_id", event.id)
        .maybeSingle();

      const refresh = (payload as { refresh?: unknown }).refresh === true;
      if (cached && cached.stats_fingerprint === fingerprint && !refresh) {
        return json({ valid: true, insights: cached.insights ?? [], generatedAt: cached.generated_at, cached: true });
      }

      const apiKey = Deno.env.get("OOO_Intellegence_Open_API_Key");
      if (!apiKey) {
        return json({
          valid: true,
          insights: cached?.insights ?? [],
          generatedAt: cached?.generated_at ?? null,
          cached: Boolean(cached),
          error: "insights_unavailable",
        });
      }

      const model = insightsModel();
      let insights: string[];
      try {
        insights = await generateEventInsights(createOpenAIResponsesClient(apiKey), event, model);
      } catch {
        return json({
          valid: true,
          insights: cached?.insights ?? [],
          generatedAt: cached?.generated_at ?? null,
          cached: Boolean(cached),
          error: "generation_failed",
        });
      }

      const generatedAt = new Date().toISOString();
      await supabase.from("event_ai_insights").upsert({
        event_id: event.id,
        insights,
        stats_fingerprint: fingerprint,
        model,
        generated_at: generatedAt,
      });
      return json({ valid: true, insights, generatedAt, cached: false });
    }

    if (action === "copilot") {
      const question = typeof (payload as { question?: unknown }).question === "string"
        ? ((payload as { question: string }).question)
        : "";
      if (!question.trim()) return json({ valid: true, answer: "", error: "empty_question" });

      const events = await gatherEventStats(supabase);
      const event = pickEvent(events, (payload as { eventId?: unknown }).eventId);
      if (!event) return json({ valid: true, answer: "There is no published event to analyze yet." });

      const apiKey = Deno.env.get("OOO_Intellegence_Open_API_Key");
      if (!apiKey) return json({ valid: true, answer: "", error: "copilot_unavailable" });

      let answer: string;
      try {
        answer = await generateCopilotAnswer(createOpenAIResponsesClient(apiKey), event, question, insightsModel());
      } catch {
        return json({ valid: true, answer: "", error: "generation_failed" });
      }
      return json({ valid: true, answer });
    }

    if (action === "list-reports") {
      const eventId = (payload as { eventId?: unknown }).eventId;
      let query = supabase
        .from("reports")
        .select("id, event_id, executive_summary, insights, raw_metrics, generated_at")
        .order("generated_at", { ascending: false });
      if (typeof eventId === "string") query = query.eq("event_id", eventId);
      const { data, error } = await query;
      if (error) throw error;
      return json({ valid: true, reports: data ?? [] });
    }

    if (action === "create-report") {
      const body = payload as { eventId?: unknown; reportType?: unknown; title?: unknown; sections?: unknown };
      // Only "Executive Impact" is buildable; the wizard shows the rest disabled.
      if (body.reportType !== BUILDABLE_REPORT_TYPE) {
        return json({ valid: true, error: "report_type_unavailable" });
      }

      const events = await gatherEventStats(supabase);
      const event = pickEvent(events, body.eventId);
      if (!event) return json({ valid: true, error: "no_event" });

      const known = KNOWN_REPORT_SECTIONS as readonly string[];
      const picked = Array.isArray(body.sections)
        ? (body.sections.filter((section): section is ReportSection =>
          typeof section === "string" && known.includes(section)))
        : [];
      const sections: ReportSection[] = picked.includes("executive_summary")
        ? picked
        : ["executive_summary", ...picked];
      const title = typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 200)
        : `${event.name} — Executive Impact`;

      let insights: string[] = [];
      if (sections.includes("ai_insights")) {
        const { data: cachedInsights } = await supabase
          .from("event_ai_insights")
          .select("insights")
          .eq("event_id", event.id)
          .maybeSingle();
        if (cachedInsights && Array.isArray(cachedInsights.insights)) insights = cachedInsights.insights;
      }

      const { data: inserted, error } = await supabase
        .from("reports")
        .insert({
          event_id: event.id,
          generated_by: null,
          executive_summary: buildExecutiveSummary(event),
          insights,
          recommendations: null,
          outcome_score: null,
          raw_metrics: {
            meta: { reportType: BUILDABLE_REPORT_TYPE, title, sections },
            stats: event,
          },
        })
        .select("id, event_id, executive_summary, insights, raw_metrics, generated_at")
        .single();
      if (error) throw error;
      return json({ valid: true, report: inserted });
    }

    if (action === "create-event") {
      const result = buildEventInsertRow(payload as Record<string, unknown>);
      if (!result.ok) return json({ valid: true, error: result.error });

      // Attribute the event to the default owner so it's manageable from
      // /v2/organizer afterward. Best-effort: if the lookup fails (owner
      // email misconfigured/missing), still create the event rather than
      // blocking the dashboard, just without an organizer_id -- the prior
      // (buggy) behavior.
      let organizerId: string | null = null;
      const { data: owner, error: ownerError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", DEFAULT_EVENT_OWNER_EMAIL)
        .maybeSingle();
      if (ownerError || !owner) {
        console.error(`create-event: could not resolve default owner "${DEFAULT_EVENT_OWNER_EMAIL}"`, ownerError);
      } else {
        organizerId = owner.id;
      }

      const { data: inserted, error } = await supabase
        .from("events")
        .insert({ ...result.row, organizer_id: organizerId })
        .select(EVENT_ADMIN_COLUMNS)
        .single();
      if (error) throw error;
      return json({ valid: true, event: inserted });
    }

    // Every event, published or not — the management list must be able to
    // unhide drafts. Password-gated, no organizer_id filter: the owner
    // manages any event, including ones made via the self-serve page.
    if (action === "list-events") {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_ADMIN_COLUMNS)
        .order("date", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return json({ valid: true, events: data ?? [] });
    }

    if (action === "update-event") {
      const eventId = (payload as { eventId?: unknown }).eventId;
      if (typeof eventId !== "string") return json({ valid: true, error: "no_event" });

      const result = buildEventUpdateRow(payload as Record<string, unknown>);
      if (!result.ok) return json({ valid: true, error: result.error });

      const { data: updated, error } = await supabase
        .from("events")
        .update(result.row)
        .eq("id", eventId)
        .select(EVENT_ADMIN_COLUMNS)
        .single();
      if (error) throw error;
      return json({ valid: true, event: updated });
    }

    if (action === "set-event-published") {
      const eventId = (payload as { eventId?: unknown }).eventId;
      if (typeof eventId !== "string") return json({ valid: true, error: "no_event" });

      const { data: updated, error } = await supabase
        .from("events")
        .update({ is_published: (payload as { isPublished?: unknown }).isPublished === true })
        .eq("id", eventId)
        .select(EVENT_ADMIN_COLUMNS)
        .single();
      if (error) throw error;
      return json({ valid: true, event: updated });
    }

    if (action === "event-deletion-impact") {
      const eventId = (payload as { eventId?: unknown }).eventId;
      if (typeof eventId !== "string") return json({ valid: true, error: "no_event" });

      const [matchesResult, messagesResult, meetingsResult] = await Promise.all([
        supabase.from("matches").select("*", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("meetings").select("*", { count: "exact", head: true }).eq("event_id", eventId),
      ]);
      if (matchesResult.error) throw matchesResult.error;
      if (messagesResult.error) throw messagesResult.error;
      if (meetingsResult.error) throw meetingsResult.error;
      return json({
        valid: true,
        matches: matchesResult.count ?? 0,
        messages: messagesResult.count ?? 0,
        meetings: meetingsResult.count ?? 0,
      });
    }

    if (action === "delete-event") {
      const eventId = (payload as { eventId?: unknown }).eventId;
      const confirmName = (payload as { confirmName?: unknown }).confirmName;
      if (typeof eventId !== "string") return json({ valid: true, error: "no_event" });

      const { data: eventRow, error: lookupError } = await supabase
        .from("events")
        .select("id, name")
        .eq("id", eventId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!eventRow) return json({ valid: true, error: "no_event" });

      // Defence in depth: the client already gates the button on an exact
      // name match, re-check it here so an API-level call can't skip it.
      if (typeof confirmName !== "string" || confirmName !== eventRow.name) {
        return json({ valid: true, error: "name_mismatch" });
      }

      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
      return json({ valid: true, deleted: true });
    }

    return json({ valid: true });
  } catch (error) {
    console.error("admin-auth handler error", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return json({ valid: false }, 400);
  }
});
