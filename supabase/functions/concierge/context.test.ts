import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConciergeContext,
  createSupabaseContextSource,
  createSupabaseLiveCandidateSource,
  MAX_CONCIERGE_MATCHES,
  summarizeConciergeContext,
  type ConciergeContextSource,
  type ConciergeQueryClient,
  type EventRow,
  type MatchRow,
  type MeetingRow,
  type MessageFactRow,
  type ProfileRow,
} from "./context.ts";

const USER_ID = "current-user";
const EVENT_A = "event-a";
const EVENT_B = "event-b";
const EVENT_C = "event-c";

function profile(id: string, name = id): ProfileRow {
  return {
    id,
    full_name: name,
    title: "Founder",
    company: "OFFRIP Test Co",
    role_type: "Founder / Co-founder",
    secondary_role_types: ["Creator / Influencer"],
    matching_goal: "Meet Investors",
    primary_goal: "Raise capital",
    secondary_goals: ["Find advisors"],
    desired_outcomes: ["Warm introductions"],
    needs: ["Investor introductions"],
    offers: ["Product expertise"],
    areas_of_expertise: ["Product"],
    interests: ["AI"],
    communities: ["Founders"],
    who_to_meet: ["Investors"],
    connection_preference: ["In person"],
    industry_focus: ["Technology"],
  };
}

function match(index: number, score: number, overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    id: `match-${index}`,
    event_id: EVENT_A,
    user_a_id: USER_ID,
    user_b_id: `person-${index}`,
    a_to_b_score: score,
    b_to_a_score: score,
    a_to_b_confidence: 85,
    b_to_a_confidence: 85,
    reciprocity_label: "Mutual Value",
    match_reason: `Persisted reason ${index}`,
    ai_explanation: `Persisted explanation ${index}`,
    score_breakdown: { aToB: { goals: score }, bToA: { goals: score } },
    match_evidence: { aToB: [{ side: "a" }], bToA: [{ side: "b" }] },
    match_details: { matchedGoals: [{ goalA: "Raise capital", goalB: "Meet founders" }] },
    shared_goals: ["Growth"],
    shared_interests: ["AI"],
    shared_industries: ["Technology"],
    shared_communities: ["Founders"],
    ...overrides,
  };
}

const EVENTS: EventRow[] = [
  { id: EVENT_A, name: "OFFRIP Room A", date: "2026-08-20", end_date: "2026-08-20" },
  { id: EVENT_B, name: "OFFRIP Room B", date: "2026-09-01", end_date: null },
  { id: EVENT_C, name: "OFFRIP Room C", date: "2026-10-10", end_date: "2026-10-11" },
];

function source(overrides: Partial<ConciergeContextSource> = {}): ConciergeContextSource {
  const matches = Array.from({ length: 6 }, (_, index) => match(index, 100 - index));
  const profiles = Array.from({ length: 6 }, (_, index) => ({
    ...profile(`person-${index}`, `Person ${index}`),
    email: `private-${index}@example.com`,
    linkedin_url: `https://linkedin.example/${index}`,
  }));
  return {
    getCurrentProfile: async () => ({
      ...profile(USER_ID, "Avery Morgan"),
      email: "avery@example.com",
      linkedin_url: "https://linkedin.example/avery",
    }),
    getEvents: async (ids) => EVENTS.filter((event) => ids.includes(event.id)),
    getMatches: async () => [
      match(99, 999, { user_a_id: "unrelated-a", user_b_id: "unrelated-b" }),
      match(97, 997, { user_b_id: "absent-person" }),
      ...matches,
    ],
    getProfiles: async () => [
      ...profiles,
      { ...profile("unrelated-person"), email: "leak@example.com" },
    ],
    getMessageFacts: async () => [],
    getMeetings: async () => [],
    ...overrides,
  };
}

test("platform-wide: pulls matches from every event, no check-in requirement", async () => {
  const context = await buildConciergeContext(source({
    getMatches: async () => [
      match(0, 95, { id: "m-a", event_id: EVENT_A, user_b_id: "person-a" }),
      match(1, 92, { id: "m-b", event_id: EVENT_B, user_b_id: "person-b" }),
      match(2, 88, { id: "m-c", event_id: EVENT_C, user_b_id: "person-c" }),
    ],
    getProfiles: async () => [
      profile("person-a", "Person A"),
      profile("person-b", "Person B"),
      profile("person-c", "Person C"),
    ],
  }), USER_ID);

  assert.equal(context.status, "ready");
  assert.deepEqual(context.matches.map((entry) => entry.trusted.matchId), ["m-a", "m-b", "m-c"]);
  assert.deepEqual(
    context.matches.map((entry) => entry.trusted.eventId).sort(),
    [EVENT_A, EVENT_B, EVENT_C],
  );
  // each match carries its own event, not one shared "current room"
  assert.equal(context.matches.find((e) => e.trusted.matchId === "m-a")?.event?.name, "OFFRIP Room A");
  assert.equal(context.matches.find((e) => e.trusted.matchId === "m-b")?.event?.name, "OFFRIP Room B");
  assert.equal(context.matches.find((e) => e.trusted.matchId === "m-c")?.event?.date, "2026-10-10");
  // there is no single-event framing on the context anymore
  assert.equal("event" in context.trusted, false);
  assert.equal("roomDisplayData" in context, false);
  assert.equal(summarizeConciergeContext(context).eventCount, 3);
});

test("includes a match even though its counterpart is not checked in anywhere", async () => {
  // No getCheckedInProfileIds exists any more -- the only gate is the match row
  // itself plus the score/confidence bar.
  const context = await buildConciergeContext(source({
    getMatches: async () => [match(0, 90, { id: "solo", event_id: EVENT_B, user_b_id: "never-checked-in" })],
    getProfiles: async () => [profile("never-checked-in", "Never Checked In")],
  }), USER_ID);

  assert.equal(context.status, "ready");
  assert.deepEqual(context.matches.map((entry) => entry.trusted.profileId), ["never-checked-in"]);
  assert.equal(context.matches[0].userAuthoredProfileData.name, "Never Checked In");
});

test("keeps the score >= 60 / confidence >= 70 quality filter", async () => {
  const context = await buildConciergeContext(source({
    getMatches: async () => [
      match(0, 99, {
        id: "keep", user_a_id: "person-0", user_b_id: USER_ID,
        b_to_a_score: 74, b_to_a_confidence: 78, reciprocity_label: "They Can Help You",
        score_breakdown: { aToB: { goals: 99 }, bToA: { goals: 74 } },
      }),
      match(1, 95, { id: "low-score", b_to_a_score: 40, a_to_b_score: 59 }),
      match(2, 94, { id: "low-conf", a_to_b_score: 88, a_to_b_confidence: 69 }),
    ],
    getProfiles: async () => [profile("person-0", "Person 0"), profile("person-1"), profile("person-2")],
  }), USER_ID);

  assert.deepEqual(context.matches.map((entry) => entry.trusted.matchId), ["keep"]);
  assert.equal(context.matches[0].trusted.persistedScore, 74);
  assert.equal(context.matches[0].trusted.persistedConfidence, 78);
  assert.deepEqual(context.matches[0].persistedMatchEvidence.scoreBreakdown, { goals: 74 });
  assert.deepEqual(context.matches[0].persistedMatchEvidence.matchEvidence, [{ side: "b" }]);
  assert.equal(context.matches[0].persistedMatchEvidence.reciprocityLabel, "You Can Help Them");
});

test(`caps the surfaced matches at ${MAX_CONCIERGE_MATCHES}, highest score first`, async () => {
  const total = MAX_CONCIERGE_MATCHES + 15;
  const bigMatches = Array.from({ length: total }, (_, index) => match(index, 99 - (index % 30), {
    id: `m-${String(index).padStart(3, "0")}`,
    event_id: [EVENT_A, EVENT_B, EVENT_C][index % 3],
    user_b_id: `p-${index}`,
  }));
  const context = await buildConciergeContext(source({
    getMatches: async () => bigMatches,
    getProfiles: async () => bigMatches.map((entry) => profile(entry.user_b_id!, entry.user_b_id!)),
  }), USER_ID);

  assert.equal(context.matches.length, MAX_CONCIERGE_MATCHES);
  const scores = context.matches.map((entry) => entry.trusted.persistedScore);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  // matches from more than one event survived the cap
  assert.ok(new Set(context.matches.map((entry) => entry.trusted.eventId)).size > 1);
});

test("carries profile location so Concierge can answer city-based questions", async () => {
  const context = await buildConciergeContext(source({
    getCurrentProfile: async () => ({ ...profile(USER_ID, "Avery Morgan"), location: "Los Angeles, CA" }),
    getMatches: async () => [
      match(0, 95, { id: "m0", user_b_id: "person-0" }),
      match(1, 90, { id: "m1", user_b_id: "person-1" }),
    ],
    getProfiles: async () => [
      { ...profile("person-0", "Person 0"), location: "Los Angeles, CA" },
      { ...profile("person-1", "Person 1"), location: "New York, NY" },
    ],
  }), USER_ID);

  assert.equal(context.currentUser?.userAuthoredProfileData.location, "Los Angeles, CA");
  assert.equal(context.matches.find((e) => e.trusted.profileId === "person-0")?.userAuthoredProfileData.location, "Los Angeles, CA");
  assert.equal(context.matches.find((e) => e.trusted.profileId === "person-1")?.userAuthoredProfileData.location, "New York, NY");
});

test("relationship + meeting facts stay pair-scoped, no longer event-scoped", async () => {
  const messages: Array<MessageFactRow & { content?: string }> = [
    { id: "message-1", match_id: "m0", event_id: EVENT_A, sender_id: USER_ID, recipient_id: "person-0", message_type: "connect_request", created_at: "2026-08-20T09:00:00Z", content: "secret request" },
    { id: "message-2", match_id: "m0", event_id: EVENT_B, sender_id: "person-0", recipient_id: USER_ID, message_type: "message", created_at: "2026-08-20T09:05:00Z", content: "secret reply from another event" },
    { id: "message-leak-user", match_id: "m0", event_id: EVENT_A, sender_id: "stranger-a", recipient_id: "stranger-b", message_type: "message", created_at: "2026-08-20T10:00:00Z", content: "must not leak" },
    { id: "message-leak-match", match_id: "unrelated-match", event_id: EVENT_A, sender_id: USER_ID, recipient_id: "stranger", message_type: "message", created_at: "2026-08-20T10:00:00Z", content: "cross match" },
  ];
  const meetings: MeetingRow[] = [
    { id: "meeting-old", match_id: "m0", event_id: EVENT_A, requester_id: USER_ID, recipient_id: "person-0", status: "requested", requested_at: "2026-08-20T10:00:00Z", scheduled_at: null, duration_minutes: 30, location_note: null, completed_at: null },
    { id: "meeting-new", match_id: "m0", event_id: EVENT_B, requester_id: "person-0", recipient_id: USER_ID, status: "scheduled", requested_at: "2026-08-20T11:00:00Z", scheduled_at: "2026-08-20T15:00:00Z", duration_minutes: 45, location_note: "Lobby", completed_at: null },
    { id: "meeting-leak-user", match_id: "m0", event_id: EVENT_A, requester_id: "stranger-a", recipient_id: "stranger-b", status: "scheduled", requested_at: "2026-08-20T12:00:00Z", scheduled_at: "2026-08-20T16:00:00Z", duration_minutes: 30, location_note: "Private", completed_at: null },
  ];
  const context = await buildConciergeContext(source({
    getMatches: async () => [match(0, 95, { id: "m0", event_id: EVENT_A, user_b_id: "person-0" })],
    getProfiles: async () => [profile("person-0", "Person 0")],
    getMessageFacts: async () => messages,
    getMeetings: async () => meetings,
  }), USER_ID);

  const first = context.matches[0];
  assert.equal(first.relationship.hasConversation, true);
  // the reply came in via a different event and still counts (pair-scoped)
  assert.equal(first.relationship.hasReciprocalConversation, true);
  assert.equal(first.relationship.connectionRequestState, "reciprocal");
  assert.equal(first.relationship.currentMeetingStatus, "scheduled");
  assert.equal(first.relationship.displayStatus, "Meeting confirmed");
  assert.deepEqual(context.meetings.map((meeting) => meeting.trusted.meetingId), ["meeting-new", "meeting-old"]);
  assert.equal(context.meetings.every((meeting) => meeting.trusted.otherProfileId === "person-0"), true);
  // each meeting keeps its own event id
  assert.equal(context.meetings.find((m) => m.trusted.meetingId === "meeting-new")?.trusted.eventId, EVENT_B);

  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes("secret request"), false);
  assert.equal(serialized.includes("secret reply"), false);
  assert.equal(serialized.includes("must not leak"), false);
  assert.equal(serialized.includes("private-0@example.com"), false);
  assert.equal(serialized.includes("linkedin"), false);
  assert.equal(serialized.includes("leak@example.com"), false);
});

test("returns the controlled profile-completion state when no profile exists", async () => {
  const context = await buildConciergeContext(source({ getCurrentProfile: async () => null }), USER_ID);
  assert.equal(context.status, "profile_completion_required");
  assert.equal(context.currentUser, null);
  assert.deepEqual(context.matches, []);
});

test("returns no_matches when the user has no match rows anywhere", async () => {
  const context = await buildConciergeContext(source({ getMatches: async () => [] }), USER_ID);
  assert.equal(context.status, "no_matches");
  assert.deepEqual(context.matches, []);
});

test("returns no_matches when every match is below the quality bar", async () => {
  const context = await buildConciergeContext(source({
    getMatches: async () => [match(0, 50, { id: "weak", a_to_b_score: 50, a_to_b_confidence: 50 })],
    getProfiles: async () => [profile("person-0")],
  }), USER_ID);
  assert.equal(context.status, "no_matches");
  assert.deepEqual(context.matches, []);
});

test("treats no meetings as a valid ready context with an empty array", async () => {
  const context = await buildConciergeContext(source({
    getMatches: async () => [match(0, 95, { id: "m0", user_b_id: "person-0" })],
    getProfiles: async () => [profile("person-0")],
    getMeetings: async () => [],
  }), USER_ID);
  assert.equal(context.status, "ready");
  assert.deepEqual(context.meetings, []);
  assert.equal(summarizeConciergeContext(context).activeMeetingCount, 0);
});

test("Supabase source: matches/messages/meetings are NOT event-scoped, and no check-in view is read", async () => {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const client = {
    from: <T,>(table: string) => {
      const builder = {
        select: (columns: string) => { calls.push({ table, method: "select", args: [columns] }); return builder; },
        eq: (column: string, value: unknown) => { calls.push({ table, method: "eq", args: [column, value] }); return builder; },
        or: (filter: string) => { calls.push({ table, method: "or", args: [filter] }); return builder; },
        in: (column: string, values: string[]) => { calls.push({ table, method: "in", args: [column, values] }); return builder; },
        order: () => builder,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve({ data: [] as T[], error: null }).then(resolve, reject),
      };
      return builder;
    },
  } as unknown as ConciergeQueryClient;
  const dbSource = createSupabaseContextSource(client);
  await dbSource.getMatches(USER_ID);
  await dbSource.getMessageFacts(USER_ID, ["match-0"]);
  await dbSource.getMeetings(USER_ID, ["match-0"]);
  await dbSource.getEvents([EVENT_A, EVENT_B]);

  const tables = new Set(calls.map((call) => call.table));
  assert.equal(tables.has("matched_event_attendance"), false);
  assert.equal(tables.has("event_registrations"), false);
  // no query filters matches/messages/meetings by event_id
  const eqOnEvent = calls.filter((call) =>
    ["matches", "messages", "meetings"].includes(call.table)
    && call.method === "eq"
    && call.args[0] === "event_id");
  assert.deepEqual(eqOnEvent, []);
  // events are fetched by id list for per-match enrichment
  assert.ok(calls.some((call) => call.table === "events" && call.method === "in" && call.args[0] === "id"));
});

test("live candidate source still reads event_registrations (unchanged)", async () => {
  const selections: Array<{ table: string }> = [];
  const client = {
    from: <T,>(table: string) => {
      const builder = {
        select: () => { selections.push({ table }); return builder; },
        eq: () => builder,
        or: () => builder,
        in: () => builder,
        order: () => builder,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve({ data: [] as T[], error: null }).then(resolve, reject),
      };
      return builder;
    },
  } as unknown as ConciergeQueryClient;
  const liveSource = createSupabaseLiveCandidateSource(client);
  await liveSource.getCheckedInNames(EVENT_A);
  await liveSource.getScoringProfile("candidate-1");
  assert.equal(selections.some((selection) => selection.table === "matched_event_attendance"), false);
  assert.equal(selections.some((selection) => selection.table === "event_registrations"), true);
  assert.equal(selections.some((selection) => selection.table === "profiles"), true);
});

test("the serialized model context never carries email, linkedin, or bio", async () => {
  const context = await buildConciergeContext(source({
    getMatches: async () => [match(0, 95, { id: "m0", user_b_id: "person-0" })],
    getProfiles: async () => [{ ...profile("person-0"), email: "x@example.com", linkedin_url: "https://linkedin.example/x" }],
  }), USER_ID);
  const serialized = JSON.stringify(context).toLowerCase();
  assert.equal(serialized.includes("linkedin"), false);
  assert.equal(serialized.includes("@example.com"), false);
  assert.equal(serialized.includes("\"bio\""), false);
});
