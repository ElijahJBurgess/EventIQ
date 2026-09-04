import { describe, expect, it } from "vitest";
import { buildEventStats, type BuildEventStatsInput } from "./stats.ts";

// A small synthetic event whose every number is hand-verifiable. The seeded
// "OFFRIP Design Preview Event" is exercised separately by SQL verification;
// this fixture pins the mapping from raw rows -> the event-stats payload.
function baseInput(): BuildEventStatsInput {
  return {
    event: { id: "E1", name: "Fixture Event", date: "2026-08-01" },
    registrations: [
      { profile_id: "p1", is_checked_in: true },
      { profile_id: "p2", is_checked_in: true },
      { profile_id: "p3", is_checked_in: true },
      { profile_id: "p4", is_checked_in: true },
      { profile_id: "p5", is_checked_in: false },
      { profile_id: "p6", is_checked_in: false },
    ],
    profiles: [
      { id: "p1", profile_completed: true, primary_goal: "Raise Capital", seniority: "Founder / Owner", areas_of_expertise: ["Product"], interests: ["Climate"], communities: ["YC"], role_type: "Founder / Co-founder", industries: ["Fintech"], location: "NYC" },
      { id: "p2", profile_completed: true, primary_goal: "Raise Capital", seniority: "Manager", areas_of_expertise: [], interests: [], communities: [], role_type: "Founder / Co-founder", industries: ["Fintech"], location: "NYC" },
      { id: "p3", profile_completed: true, primary_goal: "Meet Investors", seniority: "Partner", areas_of_expertise: [], interests: [], communities: [], role_type: "Investor", industries: [], location: "SF" },
      { id: "p4", profile_completed: true, primary_goal: "Meet Collaborators", seniority: "Vice President", areas_of_expertise: [], interests: [], communities: [], role_type: "Recruiter", industries: [], location: null },
      // p5 & p6 never checked in -> excluded from every Audience-tab breakdown.
      { id: "p5", profile_completed: true, primary_goal: "Raise Capital", seniority: "Vice President", areas_of_expertise: ["Design"], interests: ["Music"], communities: [], role_type: "Founder / Co-founder", industries: ["AI"], location: "LA" },
      { id: "p6", profile_completed: false, primary_goal: null, seniority: null, areas_of_expertise: [], interests: [], communities: [], role_type: null, industries: [], location: null },
    ],
    matchCount: 8,
    connectionRequestMessageCount: 4,
    matches: [
      { id: "m1", user_a_id: "p1", user_b_id: "p2", connection_status: "accepted", connection_requested_by: "p1", connection_status_updated_at: "2026-08-01T10:00:00Z" },
      { id: "m2", user_a_id: "p1", user_b_id: "p3", connection_status: "accepted", connection_requested_by: "p3", connection_status_updated_at: "2026-08-01T14:00:00Z" },
      { id: "m3", user_a_id: "p2", user_b_id: "p3", connection_status: "pending", connection_requested_by: null, connection_status_updated_at: "2026-08-02T09:00:00Z" },
      { id: "m4", user_a_id: "p3", user_b_id: "p4", connection_status: "declined", connection_requested_by: "p4", connection_status_updated_at: "2026-08-02T09:00:00Z" },
      { id: "m5", user_a_id: "p2", user_b_id: "p4", connection_status: "accepted", connection_requested_by: "p2", connection_status_updated_at: "2026-08-02T20:00:00Z" },
      { id: "m6", user_a_id: "p1", user_b_id: "p4", connection_status: "none", connection_requested_by: null, connection_status_updated_at: null },
      { id: "m7", user_a_id: "p4", user_b_id: "p5", connection_status: "none", connection_requested_by: null, connection_status_updated_at: null },
      { id: "m8", user_a_id: "p1", user_b_id: "p5", connection_status: "pending", connection_requested_by: null, connection_status_updated_at: "2026-08-03T09:00:00Z" },
    ],
    messages: [
      { match_id: "m1", sender_id: "p1", message_type: "text" },
      { match_id: "m1", sender_id: "p2", message_type: "text" },
      { match_id: "m2", sender_id: "p1", message_type: "text" },
      { match_id: "m5", sender_id: "p2", message_type: "text" },
      { match_id: "m3", sender_id: "p2", message_type: "text" },
      { match_id: "m1", sender_id: "p1", message_type: "connect_request" },
    ],
    meetings: [
      { match_id: "m1", status: "completed", created_at: "2026-08-01T11:00:00Z" },
      { match_id: "m2", status: "scheduled", created_at: "2026-08-01T15:00:00Z" },
      { match_id: "m5", status: "accepted", created_at: "2026-08-02T21:00:00Z" },
      { match_id: "m3", status: "declined", created_at: "2026-08-02T10:00:00Z" },
      { match_id: "m1", status: "requested", created_at: "2026-08-03T08:00:00Z" },
    ],
    feedback: [
      { user_id: "p1", overall_rating: 5, matching_rating: 4, networking_quality: 5 },
      { user_id: "p2", overall_rating: 3, matching_rating: null, networking_quality: 4 },
      { user_id: "p5", overall_rating: 4, matching_rating: 4, networking_quality: null },
    ],
    selfReports: [
      { match_id: "m1", user_id: "p1", response: "met", was_valuable: true },
      { match_id: "m2", user_id: "p3", response: "met", was_valuable: false },
      { match_id: "m5", user_id: "p4", response: "not_met", was_valuable: null },
    ],
  };
}

describe("buildEventStats — headline counts", () => {
  it("passes through event identity", () => {
    const s = buildEventStats(baseInput());
    expect(s.id).toBe("E1");
    expect(s.name).toBe("Fixture Event");
    expect(s.date).toBe("2026-08-01");
  });

  it("counts registrations and check-ins", () => {
    const s = buildEventStats(baseInput());
    expect(s.totalRegistrations).toBe(6);
    expect(s.totalCheckedIn).toBe(4);
  });

  it("uses the exact-count queries for matches and connection requests", () => {
    const s = buildEventStats(baseInput());
    expect(s.totalMatches).toBe(8);
    expect(s.totalConnectionRequests).toBe(4);
  });

  it("counts profiles created as every registrant with a completed profile", () => {
    // p1..p5 completed (regardless of check-in), p6 incomplete
    const s = buildEventStats(baseInput());
    expect(s.profilesCreated).toBe(5);
  });
});

describe("buildEventStats — connections", () => {
  it("breaks connections down by status", () => {
    const s = buildEventStats(baseInput());
    expect(s.connectionsByStatus).toEqual({ accepted: 3, declined: 1, pending: 2 });
  });

  it("counts conversations started as accepted connections with >=1 non-request message (no reply required)", () => {
    // accepted: m1, m2, m5 — all three have a 'text' message. m3 has a text
    // message but is only pending, so it does not count.
    const s = buildEventStats(baseInput());
    expect(s.conversationsStarted).toBe(3);
  });

  it("still counts reciprocal conversations separately", () => {
    // Only m1 has messages from both sides.
    const s = buildEventStats(baseInput());
    expect(s.connectionsWithConversation).toBe(1);
  });
});

describe("buildEventStats — meetings", () => {
  it("breaks meetings down by status and totals meeting requests", () => {
    const s = buildEventStats(baseInput());
    expect(s.totalMeetingRequests).toBe(5);
    expect(s.meetingsByStatus).toEqual({
      requested: 1,
      accepted: 1,
      declined: 1,
      scheduled: 1,
      completed: 1,
    });
  });

  it("counts meetings confirmed as accepted, scheduled or completed", () => {
    const s = buildEventStats(baseInput());
    expect(s.meetingsConfirmed).toBe(3);
  });
});

describe("buildEventStats — outcomes and feedback", () => {
  it("counts every self-report row as an outcome reported", () => {
    const s = buildEventStats(baseInput());
    expect(s.outcomesReported).toBe(3);
  });

  it("keeps the 'met'-scoped self-report figures for the valuable rate", () => {
    const s = buildEventStats(baseInput());
    expect(s.selfReportsTotal).toBe(2);
    expect(s.selfReportsValuable).toBe(1);
  });

  it("averages feedback ratings, ignoring nulls", () => {
    const s = buildEventStats(baseInput());
    expect(s.avgOverallRating).toBe(4);
    expect(s.avgMatchingRating).toBe(4);
    expect(s.avgNetworkingQuality).toBe(4.5);
  });

  it("counts feedback participation as checked-in attendees with any feedback or self-report", () => {
    // feedback: p1,p2,p5 ; self-reports: p1,p3,p4 ; union ∩ checked-in{p1..p4} = p1,p2,p3,p4
    const s = buildEventStats(baseInput());
    expect(s.feedbackParticipation).toEqual({ participants: 4, checkedIn: 4 });
  });
});

describe("buildEventStats — connections over time", () => {
  it("buckets accepted connections and meetings by day, filling gaps", () => {
    const s = buildEventStats(baseInput());
    expect(s.connectionsByDay).toEqual([
      { date: "2026-08-01", connections: 2, meetings: 2 },
      { date: "2026-08-02", connections: 1, meetings: 2 },
      { date: "2026-08-03", connections: 0, meetings: 1 },
    ]);
  });
});

describe("buildEventStats — relationship funnel", () => {
  it("returns the seven ordered stages with mixed people/connection units", () => {
    const s = buildEventStats(baseInput());
    expect(s.funnel).toEqual([
      { key: "profile_created", label: "Profile created", value: 5 },
      { key: "matched", label: "Matched", value: 5 },
      { key: "request_sent", label: "Request sent", value: 4 },
      { key: "accepted", label: "Accepted", value: 3 },
      { key: "conversation_started", label: "Conversation started", value: 3 },
      { key: "meeting", label: "Meeting", value: 3 },
      { key: "outcome_reported", label: "Outcome reported", value: 3 },
    ]);
  });
});

describe("buildEventStats — audience breakdowns (checked-in only)", () => {
  it("gives the full role_type breakdown, sorted by size", () => {
    const s = buildEventStats(baseInput());
    // p5 is a Founder but never checked in, so Founders is 2, not 3.
    expect(s.roleBreakdown).toEqual([
      { label: "Founder / Co-founder", count: 2 },
      { label: "Investor", count: 1 },
      { label: "Recruiter", count: 1 },
    ]);
  });

  it("gives the full primary_goal breakdown with a % of attendees", () => {
    const s = buildEventStats(baseInput());
    expect(s.intentBreakdown).toEqual([
      { label: "Raise Capital", count: 2, pct: 50 },
      { label: "Meet Collaborators", count: 1, pct: 25 },
      { label: "Meet Investors", count: 1, pct: 25 },
    ]);
  });

  it("computes the six audience segments over checked-in attendees", () => {
    const s = buildEventStats(baseInput());
    expect(s.segments).toEqual([
      { key: "c_suite", label: "C-Suite / Executives", count: 2, pct: 50 },
      { key: "founders", label: "Founders", count: 2, pct: 50 },
      { key: "actively_hiring", label: "Actively hiring", count: 1, pct: 25 },
      { key: "raising_capital", label: "Raising capital", count: 3, pct: 75 },
      { key: "seeking_partnerships", label: "Seeking partnerships", count: 0, pct: 0 },
      { key: "open_to_opportunities", label: "Open to opportunities", count: 1, pct: 25 },
    ]);
  });

  it("scopes industries and locations to checked-in attendees", () => {
    const s = buildEventStats(baseInput());
    expect(s.topIndustries).toEqual([{ label: "Fintech", count: 2 }]); // p5's "AI" excluded
    expect(s.topLocations).toEqual([
      { label: "NYC", count: 2 },
      { label: "SF", count: 1 },
    ]);
  });

  it("scopes expertise and interests to checked-in attendees", () => {
    const s = buildEventStats(baseInput());
    expect(s.topExpertise).toEqual([{ label: "Product", count: 1 }]);
    expect(s.topInterestsAndCommunities).toEqual([
      { label: "Climate", count: 1 },
      { label: "YC", count: 1 },
    ]);
  });
});

describe("buildEventStats — relationship patterns (checked-in only)", () => {
  it("maps the five prototype pairs, spanning checked-in matches only", () => {
    // Checked-in matches are m1-m6 (m7/m8 involve p5, who never checked in).
    // p1/p2 = Founder, p3 = Investor (Partner), p4 = Recruiter (VP).
    const s = buildEventStats(baseInput());
    expect(s.relationshipPairs).toEqual([
      { key: "founders_investors", label: "Founders ↔ Investors", color: "#69C0BE", matches: 2, accepted: 1, meetings: 1 },
      { key: "recruiters_candidates", label: "Recruiters ↔ Candidates", color: "#DCE86A", matches: 0, accepted: 0, meetings: 0 },
      { key: "brands_creators", label: "Brands ↔ Creators", color: "#FF5338", matches: 0, accepted: 0, meetings: 0 },
      { key: "enterprises_startups", label: "Enterprises ↔ Startups", color: "#4387F5", matches: 0, accepted: 0, meetings: 0 },
      { key: "executives_founders", label: "Executives ↔ Founders", color: "#000000", matches: 4, accepted: 2, meetings: 2 },
    ]);
  });

  it("only heatmaps role groups with at least two checked-in attendees", () => {
    // Checked-in role counts: Founder 2, Investor 1, Recruiter 1 -> one group.
    const s = buildEventStats(baseInput());
    expect(s.connectionHeatmap).toEqual({ groups: ["Founder / Co-founder"], matrix: [[100]] });
  });

  it("normalizes heatmap cells against the busiest group pair", () => {
    const heatInput: BuildEventStatsInput = {
      event: { id: "H1", name: "Heat", date: null },
      registrations: [
        { profile_id: "q1", is_checked_in: true },
        { profile_id: "q2", is_checked_in: true },
        { profile_id: "q3", is_checked_in: true },
        { profile_id: "q4", is_checked_in: true },
      ],
      profiles: [
        { id: "q1", profile_completed: true, primary_goal: null, seniority: null, areas_of_expertise: [], interests: [], communities: [], role_type: "Founder / Co-founder", industries: [], location: null },
        { id: "q2", profile_completed: true, primary_goal: null, seniority: null, areas_of_expertise: [], interests: [], communities: [], role_type: "Founder / Co-founder", industries: [], location: null },
        { id: "q3", profile_completed: true, primary_goal: null, seniority: null, areas_of_expertise: [], interests: [], communities: [], role_type: "Investor", industries: [], location: null },
        { id: "q4", profile_completed: true, primary_goal: null, seniority: null, areas_of_expertise: [], interests: [], communities: [], role_type: "Investor", industries: [], location: null },
      ],
      matchCount: 5,
      connectionRequestMessageCount: 0,
      matches: [
        { id: "qm1", user_a_id: "q1", user_b_id: "q2", connection_status: "none", connection_requested_by: null, connection_status_updated_at: null },
        { id: "qm2", user_a_id: "q1", user_b_id: "q3", connection_status: "none", connection_requested_by: null, connection_status_updated_at: null },
        { id: "qm3", user_a_id: "q2", user_b_id: "q3", connection_status: "none", connection_requested_by: null, connection_status_updated_at: null },
        { id: "qm4", user_a_id: "q1", user_b_id: "q4", connection_status: "none", connection_requested_by: null, connection_status_updated_at: null },
        { id: "qm5", user_a_id: "q3", user_b_id: "q4", connection_status: "none", connection_requested_by: null, connection_status_updated_at: null },
      ],
      messages: [],
      meetings: [],
      feedback: [],
      selfReports: [],
    };
    // Founder-Founder: 1, Founder-Investor: 3, Investor-Investor: 1. Max = 3.
    const s = buildEventStats(heatInput);
    expect(s.connectionHeatmap).toEqual({
      groups: ["Founder / Co-founder", "Investor"],
      matrix: [
        [33, 100],
        [100, 33],
      ],
    });
  });
});

describe("buildEventStats — empty event", () => {
  it("returns zeroed figures and empty collections", () => {
    const s = buildEventStats({
      event: { id: "E0", name: "Empty", date: null },
      registrations: [],
      profiles: [],
      matchCount: 0,
      connectionRequestMessageCount: 0,
      matches: [],
      messages: [],
      meetings: [],
      feedback: [],
      selfReports: [],
    });
    expect(s.profilesCreated).toBe(0);
    expect(s.conversationsStarted).toBe(0);
    expect(s.outcomesReported).toBe(0);
    expect(s.meetingsConfirmed).toBe(0);
    expect(s.avgOverallRating).toBeNull();
    expect(s.feedbackParticipation).toEqual({ participants: 0, checkedIn: 0 });
    expect(s.connectionsByDay).toEqual([]);
    expect(s.funnel.map((stage) => stage.value)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(s.roleBreakdown).toEqual([]);
    expect(s.intentBreakdown).toEqual([]);
    expect(s.topIndustries).toEqual([]);
    expect(s.topLocations).toEqual([]);
    expect(s.segments.map((segment) => segment.count)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(s.relationshipPairs.map((pair) => [pair.matches, pair.accepted, pair.meetings])).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(s.connectionHeatmap).toEqual({ groups: [], matrix: [] });
  });
});
