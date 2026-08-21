import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConciergeContext,
  createSupabaseContextSource,
  summarizeConciergeContext,
  type ConciergeContextSource,
  type ConciergeQueryClient,
  type MatchRow,
  type MeetingRow,
  type MessageFactRow,
  type ProfileRow,
} from "./context.ts";

const USER_ID = "current-user";
const EVENT_ID = "event-a";

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
    event_id: EVENT_ID,
    user_a_id: USER_ID,
    user_b_id: `person-${index}`,
    match_score: score,
    match_reason: `Persisted reason ${index}`,
    ai_explanation: `Persisted explanation ${index}`,
    score_breakdown: { goals: score },
    match_details: { matchedGoals: [{ goalA: "Raise capital", goalB: "Meet founders" }] },
    shared_goals: ["Growth"],
    shared_interests: ["AI"],
    shared_industries: ["Technology"],
    shared_communities: ["Founders"],
    ...overrides,
  };
}

function source(overrides: Partial<ConciergeContextSource> = {}): ConciergeContextSource {
  const matches = Array.from({ length: 12 }, (_, index) => match(index, 100 - index));
  const profiles = Array.from({ length: 12 }, (_, index) => ({
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
    getEvent: async () => ({
      id: EVENT_ID,
      name: "OFFRIP Room A",
      date: "2026-08-20",
      end_date: "2026-08-20",
      start_time: "09:00:00",
      end_time: "17:00:00",
    }),
    getMatches: async () => [
      match(99, 999, { user_a_id: "unrelated-a", user_b_id: "unrelated-b" }),
      match(98, 998, { event_id: "event-b", user_b_id: "cross-event-person" }),
      match(97, 997, { user_b_id: "absent-person" }),
      ...matches,
    ],
    getCheckedInProfileIds: async () => [USER_ID, ...profiles.map((entry) => entry.id), "unrelated-person"],
    getProfiles: async () => [
      ...profiles,
      { ...profile("unrelated-person"), email: "leak@example.com" },
    ],
    getMessageFacts: async () => [],
    getMeetings: async () => [],
    ...overrides,
  };
}

test("keeps only the current event, current user's checked-in matches, ordered top 10", async () => {
  const context = await buildConciergeContext(source(), USER_ID, EVENT_ID);
  assert.equal(context.status, "ready");
  assert.equal(context.checkedInMatches.length, 10);
  assert.deepEqual(
    context.checkedInMatches.map((entry) => entry.trusted.matchId),
    Array.from({ length: 10 }, (_, index) => `match-${index}`),
  );
  assert.deepEqual(
    context.checkedInMatches.map((entry) => entry.trusted.persistedScore),
    [100, 99, 98, 97, 96, 95, 94, 93, 92, 91],
  );
  assert.equal(context.checkedInMatches.some((entry) => entry.trusted.profileId === "absent-person"), false);
  assert.equal(context.checkedInMatches.some((entry) => entry.trusted.profileId === "unrelated-person"), false);
  assert.equal(context.checkedInMatches.some((entry) => entry.trusted.eventId !== EVENT_ID), false);
});

test("includes relationship and meeting facts only for authorized exact participant pairs", async () => {
  const messages: Array<MessageFactRow & { content?: string }> = [
    { id: "message-1", match_id: "match-0", event_id: EVENT_ID, sender_id: USER_ID, recipient_id: "person-0", message_type: "connect_request", created_at: "2026-08-20T09:00:00Z", content: "secret request" },
    { id: "message-2", match_id: "match-0", event_id: EVENT_ID, sender_id: "person-0", recipient_id: USER_ID, message_type: "message", created_at: "2026-08-20T09:05:00Z", content: "secret reply" },
    { id: "message-leak-user", match_id: "match-0", event_id: EVENT_ID, sender_id: "stranger-a", recipient_id: "stranger-b", message_type: "message", created_at: "2026-08-20T10:00:00Z", content: "must not leak" },
    { id: "message-leak-event", match_id: "match-0", event_id: "event-b", sender_id: USER_ID, recipient_id: "person-0", message_type: "message", created_at: "2026-08-20T10:00:00Z", content: "cross event" },
    { id: "message-leak-match", match_id: "unrelated-match", event_id: EVENT_ID, sender_id: USER_ID, recipient_id: "stranger", message_type: "message", created_at: "2026-08-20T10:00:00Z", content: "cross match" },
  ];
  const meetings: MeetingRow[] = [
    { id: "meeting-old", match_id: "match-0", event_id: EVENT_ID, requester_id: USER_ID, recipient_id: "person-0", status: "requested", requested_at: "2026-08-20T10:00:00Z", scheduled_at: null, duration_minutes: 30, location_note: null, completed_at: null },
    { id: "meeting-new", match_id: "match-0", event_id: EVENT_ID, requester_id: "person-0", recipient_id: USER_ID, status: "scheduled", requested_at: "2026-08-20T11:00:00Z", scheduled_at: "2026-08-20T15:00:00Z", duration_minutes: 45, location_note: "Lobby", completed_at: null },
    { id: "meeting-leak-user", match_id: "match-0", event_id: EVENT_ID, requester_id: "stranger-a", recipient_id: "stranger-b", status: "scheduled", requested_at: "2026-08-20T12:00:00Z", scheduled_at: "2026-08-20T16:00:00Z", duration_minutes: 30, location_note: "Private", completed_at: null },
    { id: "meeting-leak-event", match_id: "match-0", event_id: "event-b", requester_id: USER_ID, recipient_id: "person-0", status: "scheduled", requested_at: "2026-08-20T12:00:00Z", scheduled_at: "2026-08-20T16:00:00Z", duration_minutes: 30, location_note: "Elsewhere", completed_at: null },
  ];
  const context = await buildConciergeContext(source({
    getMessageFacts: async () => messages,
    getMeetings: async () => meetings,
  }), USER_ID, EVENT_ID);

  const first = context.checkedInMatches[0];
  assert.equal(first.relationship.hasConversation, true);
  assert.equal(first.relationship.hasReciprocalConversation, true);
  assert.equal(first.relationship.connectionRequestState, "reciprocal");
  assert.equal(first.relationship.currentMeetingStatus, "scheduled");
  assert.equal(first.relationship.displayStatus, "Meeting confirmed");
  assert.deepEqual(context.meetings.map((meeting) => meeting.trusted.meetingId), ["meeting-new", "meeting-old"]);
  assert.equal(context.meetings.every((meeting) => meeting.trusted.otherProfileId === "person-0"), true);

  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes("secret request"), false);
  assert.equal(serialized.includes("secret reply"), false);
  assert.equal(serialized.includes("must not leak"), false);
  assert.equal(serialized.includes("private-0@example.com"), false);
  assert.equal(serialized.includes("linkedin"), false);
  assert.equal(serialized.includes("leak@example.com"), false);
});

test("returns the controlled profile-completion state when no profile exists", async () => {
  const context = await buildConciergeContext(source({ getCurrentProfile: async () => null }), USER_ID, EVENT_ID);
  assert.equal(context.status, "profile_completion_required");
  assert.equal(context.currentUser, null);
  assert.deepEqual(context.checkedInMatches, []);
});

test("returns no_matches when there are no persisted matches", async () => {
  const context = await buildConciergeContext(source({ getMatches: async () => [] }), USER_ID, EVENT_ID);
  assert.equal(context.status, "no_matches");
  assert.deepEqual(context.checkedInMatches, []);
});

test("returns no_people_checked_in when persisted matches have no checked-in counterpart", async () => {
  const context = await buildConciergeContext(source({ getCheckedInProfileIds: async () => [USER_ID] }), USER_ID, EVENT_ID);
  assert.equal(context.status, "no_people_checked_in");
  assert.deepEqual(context.checkedInMatches, []);
});

test("treats no meetings as a valid ready context with an empty array", async () => {
  const context = await buildConciergeContext(source({ getMeetings: async () => [] }), USER_ID, EVENT_ID);
  assert.equal(context.status, "ready");
  assert.deepEqual(context.meetings, []);
  assert.equal(summarizeConciergeContext(context).activeMeetingCount, 0);
});

test("Supabase source selects no message content, email, LinkedIn, URLs, or unrelated private fields", async () => {
  const selections: Array<{ table: string; columns: string }> = [];
  const client: ConciergeQueryClient = {
    from: <T,>(table: string) => {
      const builder = {
        select: (columns: string) => {
          selections.push({ table, columns });
          return builder;
        },
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
  };
  const databaseSource = createSupabaseContextSource(client);
  await databaseSource.getCurrentProfile(USER_ID);
  await databaseSource.getProfiles(["person-0"]);
  await databaseSource.getMessageFacts(USER_ID, EVENT_ID, ["match-0"]);

  const selectedText = selections.map((selection) => `${selection.table}:${selection.columns}`).join("\n").toLowerCase();
  assert.equal(selectedText.includes("content"), false);
  assert.equal(selectedText.includes("email"), false);
  assert.equal(selectedText.includes("linkedin"), false);
  assert.equal(selectedText.includes("avatar_url"), false);
  assert.equal(selectedText.includes("bio"), false);
});
