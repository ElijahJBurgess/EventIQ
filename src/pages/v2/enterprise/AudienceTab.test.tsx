import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AudienceTab from "./AudienceTab";
import type { EventStats } from "@/lib/enterpriseOverview";

function eventStats(overrides: Partial<EventStats> = {}): EventStats {
  return {
    id: "evt",
    name: "Preview Event",
    date: "2026-08-01",
    totalRegistrations: 40,
    totalCheckedIn: 37,
    profilesCreated: 40,
    totalMatches: 700,
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
    roleBreakdown: [
      { label: "Founder / Co-founder", count: 8 },
      { label: "Corporate Professional", count: 6 },
      { label: "Investor", count: 6 },
      { label: "Recruiter", count: 4 },
    ],
    intentBreakdown: [
      { label: "Meet Collaborators", count: 7, pct: 19 },
      { label: "Explore Investment Opportunities", count: 5, pct: 14 },
      { label: "Hire Talent", count: 3, pct: 8 },
    ],
    segments: [
      { key: "c_suite", label: "C-Suite / Executives", count: 3, pct: 8 },
      { key: "founders", label: "Founders", count: 8, pct: 22 },
      { key: "actively_hiring", label: "Actively hiring", count: 7, pct: 19 },
      { key: "raising_capital", label: "Raising capital", count: 4, pct: 11 },
      { key: "seeking_partnerships", label: "Seeking partnerships", count: 6, pct: 16 },
      { key: "open_to_opportunities", label: "Open to opportunities", count: 9, pct: 24 },
    ],
    relationshipPairs: [],
    connectionHeatmap: { groups: [], matrix: [] },
    topExpertise: [],
    topInterestsAndCommunities: [],
    topIndustries: [
      { label: "AI", count: 11 },
      { label: "enterprise software", count: 10 },
    ],
    topLocations: [
      { label: "Atlanta, GA", count: 29 },
      { label: "Austin, TX", count: 1 },
    ],
    ...overrides,
  };
}

afterEach(cleanup);

describe("AudienceTab — header", () => {
  it("names the event by checked-in attendee count and event name", () => {
    render(<AudienceTab event={eventStats()} />);
    expect(screen.getByText("WHO WAS IN THE EVENT?")).toBeInTheDocument();
    expect(screen.getByText(/37 attendees · Preview Event/)).toBeInTheDocument();
  });
});

describe("AudienceTab — by function", () => {
  it("lists every role in the breakdown", () => {
    render(<AudienceTab event={eventStats()} />);
    expect(screen.getByText("BY FUNCTION")).toBeInTheDocument();
    for (const role of ["Founder / Co-founder", "Corporate Professional", "Investor", "Recruiter"]) {
      expect(screen.getByText(role)).toBeInTheDocument();
    }
  });
});

describe("AudienceTab — what did people come for", () => {
  it("lists each intent with its share of the event", () => {
    render(<AudienceTab event={eventStats()} />);
    expect(screen.getByText("WHAT DID PEOPLE COME FOR?")).toBeInTheDocument();
    expect(screen.getByText("Meet Collaborators")).toBeInTheDocument();
    expect(screen.getByText("Explore Investment Opportunities")).toBeInTheDocument();
    expect(screen.getByText("19%")).toBeInTheDocument();
  });
});

describe("AudienceTab — segments", () => {
  it("shows all six segments with a count and a share of attendees", () => {
    render(<AudienceTab event={eventStats()} />);
    for (const label of [
      "C-Suite / Executives",
      "Founders",
      "Actively hiring",
      "Raising capital",
      "Seeking partnerships",
      "Open to opportunities",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("22% of attendees")).toBeInTheDocument();
    expect(screen.getByText("24% of attendees")).toBeInTheDocument();
  });

  it("opens a definition popover for a segment", () => {
    render(<AudienceTab event={eventStats()} />);
    fireEvent.click(screen.getByRole("button", { name: /founders/i }));
    const popup = screen.getByRole("dialog");
    expect(within(popup).getByText(/whose role is Founder \/ Co-founder/i)).toBeInTheDocument();
    expect(within(popup).getByText(/8 of 37/)).toBeInTheDocument();
  });
});

describe("AudienceTab — industries and locations", () => {
  it("carries the industry and location lists onto this tab", () => {
    render(<AudienceTab event={eventStats()} />);
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("enterprise software")).toBeInTheDocument();
    expect(screen.getByText("Atlanta, GA")).toBeInTheDocument();
    expect(screen.getByText("Austin, TX")).toBeInTheDocument();
  });

  it("shows an empty state when a list has no data", () => {
    render(<AudienceTab event={eventStats({ topLocations: [] })} />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });
});

describe("AudienceTab — no composite score", () => {
  it("never renders an OFFRIP score", () => {
    render(<AudienceTab event={eventStats()} />);
    expect(screen.queryByText(/offrip score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/relationship score/i)).not.toBeInTheDocument();
  });
});
