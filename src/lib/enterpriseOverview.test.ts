import { describe, expect, it } from "vitest";
import {
  feedbackParticipationPct,
  formatDayLabel,
  funnelRows,
  intentRows,
  roleRows,
} from "./enterpriseOverview";

describe("feedbackParticipationPct", () => {
  it("is the rounded share of checked-in attendees who left any signal", () => {
    expect(feedbackParticipationPct({ participants: 3, checkedIn: 37 })).toBe(8);
    expect(feedbackParticipationPct({ participants: 37, checkedIn: 37 })).toBe(100);
  });

  it("is zero when nobody checked in", () => {
    expect(feedbackParticipationPct({ participants: 0, checkedIn: 0 })).toBe(0);
  });
});

describe("formatDayLabel", () => {
  it("renders an ISO day as a short month-and-day label in UTC", () => {
    expect(formatDayLabel("2026-08-01")).toBe("Aug 1");
    expect(formatDayLabel("2026-12-25")).toBe("Dec 25");
  });
});

describe("funnelRows", () => {
  const funnel = [
    { key: "profile_created", label: "Profile created", value: 38 },
    { key: "matched", label: "Matched", value: 37 },
    { key: "request_sent", label: "Request sent", value: 9 },
    { key: "accepted", label: "Accepted", value: 6 },
    { key: "conversation_started", label: "Conversation started", value: 5 },
    { key: "meeting", label: "Meeting", value: 5 },
    { key: "outcome_reported", label: "Outcome reported", value: 2 },
  ];

  it("expresses each stage as a percentage of the first stage", () => {
    const rows = funnelRows(funnel);
    expect(rows[0].pct).toBe(100);
    expect(rows[1].pct).toBe(97);
    expect(rows[2].pct).toBe(24);
    expect(rows[6].pct).toBe(5);
  });

  it("scales bar width against the largest stage, with a visible floor", () => {
    const rows = funnelRows(funnel);
    expect(rows[0].widthPct).toBe(100); // largest stage fills the track
    expect(rows[3].widthPct).toBeCloseTo((6 / 38) * 100); // above the floor: scaled
    expect(rows[6].widthPct).toBe(15); // 2/38 ≈ 5% -> clamped up to the 15% floor
  });

  it("colours the stages aqua, lime, blue, orange down the funnel", () => {
    const rows = funnelRows(funnel);
    expect(rows.map((row) => row.color)).toEqual([
      "#69C0BE",
      "#DCE86A",
      "#DCE86A",
      "#4387F5",
      "#4387F5",
      "#FF5338",
      "#FF5338",
    ]);
  });

  it("passes key/label/value straight through", () => {
    const rows = funnelRows(funnel);
    expect(rows[2]).toMatchObject({ key: "request_sent", label: "Request sent", value: 9 });
  });

  it("handles an all-zero funnel without dividing by zero", () => {
    const zero = funnel.map((stage) => ({ ...stage, value: 0 }));
    const rows = funnelRows(zero);
    expect(rows.every((row) => row.pct === 0)).toBe(true);
    expect(rows.every((row) => row.widthPct === 0)).toBe(true);
  });
});

describe("roleRows", () => {
  it("scales each function bar against the largest function", () => {
    const rows = roleRows([
      { label: "Founder / Co-founder", count: 8 },
      { label: "Investor", count: 6 },
      { label: "Recruiter", count: 4 },
    ]);
    expect(rows.map((r) => r.widthPct)).toEqual([100, 75, 50]);
    expect(rows[0]).toMatchObject({ label: "Founder / Co-founder", count: 8 });
  });

  it("is empty for an empty breakdown", () => {
    expect(roleRows([])).toEqual([]);
  });
});

describe("intentRows", () => {
  it("widens each intent bar to 3x its percentage, capped at full width", () => {
    const rows = intentRows([
      { label: "Meet Collaborators", count: 7, pct: 19 },
      { label: "Explore Investment Opportunities", count: 5, pct: 14 },
      { label: "Find Customers", count: 15, pct: 40 },
    ]);
    expect(rows.map((r) => r.widthPct)).toEqual([57, 42, 100]);
  });
});
