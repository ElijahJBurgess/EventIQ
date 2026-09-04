import { describe, expect, it, vi } from "vitest";
import type { EventStats } from "./stats.ts";
import {
  fingerprintStats,
  generateCopilotAnswer,
  generateEventInsights,
  InsightsProviderError,
} from "./insights.ts";

function stats(overrides: Partial<EventStats> = {}): EventStats {
  return {
    id: "evt",
    name: "Fixture Event",
    date: "2026-08-01",
    totalRegistrations: 38,
    totalCheckedIn: 37,
    profilesCreated: 38,
    totalMatches: 703,
    totalConnectionRequests: 9,
    totalMeetingRequests: 6,
    meetingsByStatus: { requested: 0, accepted: 0, declined: 1, scheduled: 1, completed: 4 },
    meetingsConfirmed: 5,
    connectionsByStatus: { accepted: 6, declined: 0, pending: 3 },
    connectionsWithConversation: 5,
    conversationsStarted: 5,
    outcomesReported: 2,
    avgOverallRating: 5,
    avgMatchingRating: null,
    avgNetworkingQuality: null,
    selfReportsTotal: 2,
    selfReportsValuable: 2,
    feedbackParticipation: { participants: 3, checkedIn: 37 },
    connectionsByDay: [],
    funnel: [],
    roleBreakdown: [],
    intentBreakdown: [],
    segments: [],
    relationshipPairs: [],
    connectionHeatmap: { groups: [], matrix: [] },
    topExpertise: [],
    topInterestsAndCommunities: [],
    topIndustries: [],
    topLocations: [],
    ...overrides,
  };
}

function clientReturning(payload: unknown) {
  return { create: vi.fn().mockResolvedValue({ body: { output_text: JSON.stringify(payload) }, requestId: "req_1" }) };
}

describe("generateEventInsights", () => {
  it("sends only the EventStats JSON with anti-speculation instructions", async () => {
    const client = clientReturning({ insights: ["A", "B", "C"] });
    await generateEventInsights(client, stats());
    const call = client.create.mock.calls[0][0] as Record<string, unknown>;
    expect(String(call.instructions)).toMatch(/use only the numbers/i);
    expect(String(call.instructions)).toMatch(/never invent/i);
    const userContent = String((call.input as Array<{ content: string }>)[0].content);
    expect(userContent).toContain('"totalMatches":703');
    expect(userContent).not.toMatch(/user_a_id|profile_id|email/); // no raw-row shapes
    expect((call.text as { format: { type: string } }).format.type).toBe("json_schema");
  });

  it("returns the parsed insight strings, trimmed and capped at five", async () => {
    const client = clientReturning({ insights: ["  one  ", "two", "three", "four", "five", "six"] });
    const result = await generateEventInsights(client, stats());
    expect(result).toEqual(["one", "two", "three", "four", "five"]);
  });

  it("throws a provider error on a malformed response", async () => {
    const client = { create: vi.fn().mockResolvedValue({ body: { output_text: "not json" } }) };
    await expect(generateEventInsights(client, stats())).rejects.toBeInstanceOf(InsightsProviderError);
  });

  it("throws when the model returns no usable insights", async () => {
    const client = clientReturning({ insights: ["", "   "] });
    await expect(generateEventInsights(client, stats())).rejects.toBeInstanceOf(InsightsProviderError);
  });
});

describe("generateCopilotAnswer", () => {
  it("includes the question and the stats, and returns the answer", async () => {
    const client = clientReturning({ answer: "37 of 38 registrants checked in." });
    const answer = await generateCopilotAnswer(client, stats(), "How was check-in?");
    expect(answer).toBe("37 of 38 registrants checked in.");
    const userContent = String((client.create.mock.calls[0][0] as { input: Array<{ content: string }> }).input[0].content);
    expect(userContent).toContain("How was check-in?");
    expect(userContent).toContain('"totalCheckedIn":37');
  });

  it("caps an over-long question", async () => {
    const client = clientReturning({ answer: "ok" });
    await generateCopilotAnswer(client, stats(), "x".repeat(900));
    const userContent = String((client.create.mock.calls[0][0] as { input: Array<{ content: string }> }).input[0].content);
    expect(userContent).toContain("x".repeat(500));
    expect(userContent).not.toContain("x".repeat(501));
  });

  it("throws a provider error on a malformed response", async () => {
    const client = clientReturning({ notAnswer: true });
    await expect(generateCopilotAnswer(client, stats(), "q")).rejects.toBeInstanceOf(InsightsProviderError);
  });
});

describe("fingerprintStats", () => {
  it("is a stable hex digest that changes with the data", async () => {
    const a = await fingerprintStats(stats());
    const b = await fingerprintStats(stats());
    const c = await fingerprintStats(stats({ totalMatches: 704 }));
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
