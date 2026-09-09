import assert from "node:assert/strict";
import test from "node:test";
import {
  createConciergeHandler,
  MAX_HISTORY_MESSAGES,
  MAX_QUESTION_LENGTH,
  type ConciergeSupabaseClient,
} from "./handler.ts";
import type { ConciergeContext } from "./context.ts";

const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const ALLOWED_ORIGIN = "http://localhost:8080";

interface TestClientOptions {
  validToken?: boolean;
  contextStatus?: ConciergeContext["status"];
  providerFails?: boolean;
}

function makeHandler(options: TestClientOptions = {}) {
  const logs: Array<Record<string, unknown>> = [];
  const client: ConciergeSupabaseClient = {
    auth: {
      getUser: async (token) => options.validToken === false || token !== "valid-token"
        ? { data: { user: null }, error: new Error("invalid") }
        : { data: { user: { id: USER_ID } }, error: null },
    },
  };

  return {
    logs,
    handler: createConciergeHandler({
      allowedOrigins: new Set([ALLOWED_ORIGIN]),
      createClient: () => client,
      gatherContext: async (_client, authenticatedUserId): Promise<ConciergeContext> => ({
        status: options.contextStatus ?? "ready",
        trusted: { authenticatedUserId },
        currentUser: null,
        matches: [{
          trusted: { matchId: "match-1", profileId: "person-1", eventId: "event-1", persistedScore: 91, persistedConfidence: 88 },
          event: { id: "event-1", name: "OFFRIP Room A", date: null, endDate: null },
          userAuthoredProfileData: {
            name: "Marcus Lee", title: "Investor", company: "Northstar", roleType: null,
            secondaryRoleTypes: [], goals: { matchingGoal: null, primaryGoal: null, secondaryGoals: [], desiredOutcomes: [] },
            needs: [], offers: [], expertise: [], interests: [], communities: [], location: null,
            matchingPreferences: { whoToMeet: [], connectionPreference: [], industryFocus: [] },
          },
          persistedMatchEvidence: { reason: "Fundraising fit", aiExplanation: null, scoreBreakdown: null, matchEvidence: null, reciprocityLabel: null, matchDetails: null, sharedGoals: [], sharedInterests: [], sharedIndustries: [], sharedCommunities: [] },
          relationship: { displayStatus: null, connectionRequestState: "none", hasConversation: false, hasReciprocalConversation: false, currentMeetingStatus: null, isInMotion: false, hasCompletedMeeting: false },
        }],
        meetings: [],
        liveComparison: null,
      }),
      answerQuestion: async () => {
        if (options.providerFails) throw new Error("provider unavailable");
        return {
          answer: "Meet Marcus because he aligns with your fundraising goal.",
          people: [{ profileId: "person-1", matchId: "match-1", name: "Marcus Lee", title: "Investor", company: "Northstar", matchScore: 91, reason: "Fundraising fit" }],
          meetings: [],
          providerRequestId: "req_openai_1",
        };
      },
      logSearch: async (entry) => { logs.push(entry as unknown as Record<string, unknown>); },
    }),
  };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    question: "Who should I meet right now?",
    requestId: REQUEST_ID,
    history: [],
    timezone: "America/Los_Angeles",
    ...overrides,
  };
}

function request(body: unknown, token = "valid-token") {
  return new Request("https://example.supabase.co/functions/v1/concierge", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Origin: ALLOWED_ORIGIN,
    },
    body: JSON.stringify(body),
  });
}

test("returns 401 when authorization is missing", async () => {
  const { handler } = makeHandler();
  const response = await handler(new Request("https://example.supabase.co/functions/v1/concierge", { method: "POST" }));
  assert.equal(response.status, 401);
});

test("returns 401 for an invalid JWT", async () => {
  const { handler } = makeHandler({ validToken: false });
  assert.equal((await handler(request(validBody(), "bad-token"))).status, 401);
});

test("rejects malformed JSON", async () => {
  const { handler } = makeHandler();
  const response = await handler(new Request("https://example.supabase.co/functions/v1/concierge", {
    method: "POST",
    headers: { Authorization: "Bearer valid-token", Origin: ALLOWED_ORIGIN },
    body: "{",
  }));
  assert.equal(response.status, 400);
});

test("rejects an invalid request UUID", async () => {
  const { handler } = makeHandler();
  assert.equal((await handler(request(validBody({ requestId: "not-a-uuid" })))).status, 400);
});

test("rejects an unexpected eventId key -- the concierge is platform-wide now", async () => {
  const { handler } = makeHandler();
  assert.equal((await handler(request(validBody({ eventId: "11111111-1111-4111-8111-111111111111" })))).status, 400);
});

test("returns a trusted hydrated platform-wide answer", async () => {
  const { handler, logs } = makeHandler();
  const response = await handler(request(validBody()));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    requestId: REQUEST_ID,
    context: {
      status: "ready",
      authenticatedUserId: USER_ID,
      matchCount: 1,
      eventCount: 1,
      conversationCount: 0,
      activeMeetingCount: 0,
      allowedMatchIds: ["match-1"],
      allowedProfileIds: ["person-1"],
      liveComparisonProfileId: null,
    },
    answer: "Meet Marcus because he aligns with your fundraising goal.",
    people: [{ profileId: "person-1", matchId: "match-1", name: "Marcus Lee", title: "Investor", company: "Northstar", matchScore: 91, reason: "Fundraising fit" }],
    meetings: [],
  });
  assert.deepEqual(logs, [{ requestId: REQUEST_ID, userId: USER_ID, status: "success", recommendedMatchIds: ["match-1"], providerRequestId: "req_openai_1" }]);
});

test("preserves deterministic states without calling the provider and logs once", async () => {
  const { handler, logs } = makeHandler({ contextStatus: "no_matches" });
  const response = await handler(request(validBody()));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.context.status, "no_matches");
  assert.equal(body.answer, undefined);
  assert.deepEqual(logs, [{ requestId: REQUEST_ID, userId: USER_ID, status: "controlled_failure" }]);
});

test("sanitizes provider failures and logs the same request once", async () => {
  const { handler, logs } = makeHandler({ providerFails: true });
  const response = await handler(request(validBody()));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { success: false, requestId: REQUEST_ID, error: "Concierge is temporarily unavailable." });
  assert.deepEqual(logs, [{ requestId: REQUEST_ID, userId: USER_ID, status: "provider_failure" }]);
});

test("rejects a frontend-supplied user identity", async () => {
  const { handler } = makeHandler();
  const response = await handler(request(validBody({ userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })));
  assert.equal(response.status, 400);
});

test("rejects oversized questions and histories", async () => {
  const { handler } = makeHandler();
  assert.equal((await handler(request(validBody({ question: "x".repeat(MAX_QUESTION_LENGTH + 1) })))).status, 400);
  const history = Array.from({ length: MAX_HISTORY_MESSAGES + 1 }, () => ({ role: "user", content: "hello" }));
  assert.equal((await handler(request(validBody({ history })))).status, 400);
  assert.equal((await handler(request(validBody({ history: [{ role: "user", content: "x".repeat(1_001) }] })))).status, 400);
});

test("rejects an invalid timezone", async () => {
  const { handler } = makeHandler();
  assert.equal((await handler(request(validBody({ timezone: "Mars/Olympus_Mons" })))).status, 400);
});

test("rejects unapproved browser origins without wildcard CORS", async () => {
  const { handler } = makeHandler();
  const disallowed = new Request("https://example.supabase.co/functions/v1/concierge", {
    method: "POST",
    headers: { Authorization: "Bearer valid-token", Origin: "https://evil.example" },
    body: JSON.stringify(validBody()),
  });
  const response = await handler(disallowed);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});
