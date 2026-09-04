import { describe, expect, it } from "vitest";
import type { EventStats } from "./stats.ts";
import { buildExecutiveSummary } from "./report.ts";

function stats(overrides: Partial<EventStats> = {}): EventStats {
  return {
    id: "evt",
    name: "OFFRIP Design Preview Event",
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

describe("buildExecutiveSummary", () => {
  it("states every headline number from the stats", () => {
    const summary = buildExecutiveSummary(stats());
    expect(summary).toContain("OFFRIP Design Preview Event");
    expect(summary).toContain("38 registered");
    expect(summary).toContain("37 of whom checked in (97%)");
    expect(summary).toContain("703 matches");
    expect(summary).toContain("9 connection requests");
    expect(summary).toContain("6 became mutual connections");
    expect(summary).toContain("5 of those started a conversation");
    expect(summary).toContain("5 meetings were confirmed (4 completed)");
    expect(summary).toContain("2 attendees reported an outcome");
    expect(summary).toContain("3 of 37 checked-in attendees left feedback (average overall rating 5.0 out of 5)");
  });

  it("uses the singular for a single reported outcome", () => {
    expect(buildExecutiveSummary(stats({ outcomesReported: 1 }))).toContain("1 attendee reported an outcome");
  });

  it("omits the rating clause when there is no feedback", () => {
    const summary = buildExecutiveSummary(stats({ avgOverallRating: null, feedbackParticipation: { participants: 0, checkedIn: 37 } }));
    expect(summary).toContain("0 of 37 checked-in attendees left feedback.");
    expect(summary).not.toContain("average overall rating");
  });

  it("does not divide by zero for an empty event", () => {
    const summary = buildExecutiveSummary(stats({
      name: "Empty",
      totalRegistrations: 0,
      totalCheckedIn: 0,
      totalMatches: 0,
      totalConnectionRequests: 0,
      connectionsByStatus: { accepted: 0, declined: 0, pending: 0 },
      conversationsStarted: 0,
      meetingsConfirmed: 0,
      meetingsByStatus: { requested: 0, accepted: 0, declined: 0, scheduled: 0, completed: 0 },
      outcomesReported: 0,
      avgOverallRating: null,
      feedbackParticipation: { participants: 0, checkedIn: 0 },
    }));
    expect(summary).not.toMatch(/NaN|Infinity|undefined/);
    expect(summary).toContain("0 registered");
  });
});
