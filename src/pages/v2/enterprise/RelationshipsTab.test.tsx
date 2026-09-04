import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RelationshipsTab from "./RelationshipsTab";
import type { EventStats } from "@/lib/enterpriseOverview";

function eventStats(overrides: Partial<EventStats> = {}): EventStats {
  return {
    id: "evt",
    name: "Preview Event",
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
    relationshipPairs: [
      { key: "founders_investors", label: "Founders ↔ Investors", color: "#69C0BE", matches: 48, accepted: 3, meetings: 3 },
      { key: "recruiters_candidates", label: "Recruiters ↔ Candidates", color: "#DCE86A", matches: 91, accepted: 1, meetings: 0 },
      { key: "brands_creators", label: "Brands ↔ Creators", color: "#FF5338", matches: 9, accepted: 0, meetings: 0 },
      { key: "enterprises_startups", label: "Enterprises ↔ Startups", color: "#4387F5", matches: 48, accepted: 0, meetings: 0 },
      { key: "executives_founders", label: "Executives ↔ Founders", color: "#000000", matches: 24, accepted: 1, meetings: 1 },
    ],
    connectionHeatmap: {
      groups: ["Founder / Co-founder", "Investor", "Recruiter"],
      matrix: [
        [58, 100, 0],
        [100, 15, 50],
        [0, 50, 13],
      ],
    },
    topExpertise: [],
    topInterestsAndCommunities: [],
    topIndustries: [],
    topLocations: [],
    ...overrides,
  };
}

afterEach(cleanup);

describe("RelationshipsTab — pair cards", () => {
  it("shows all five relationship pairs", () => {
    render(<RelationshipsTab event={eventStats()} />);
    expect(screen.getByText("HOW THE ROOM CONNECTED")).toBeInTheDocument();
    for (const label of [
      "Founders ↔ Investors",
      "Recruiters ↔ Candidates",
      "Brands ↔ Creators",
      "Enterprises ↔ Startups",
      "Executives ↔ Founders",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows matches / accepted / meetings for a pair", () => {
    render(<RelationshipsTab event={eventStats()} />);
    const card = screen.getByRole("button", { name: /founders ↔ investors/i });
    expect(within(card).getByText("48")).toBeInTheDocument();
    expect(within(card).getAllByText("3")).toHaveLength(2); // accepted + meetings
    expect(within(card).getByText("MATCHES")).toBeInTheDocument();
    expect(within(card).getByText("ACCEPTED")).toBeInTheDocument();
    expect(within(card).getByText("MEETINGS")).toBeInTheDocument();
  });

  it("flags the loose mappings in the card popover", () => {
    render(<RelationshipsTab event={eventStats()} />);
    fireEvent.click(screen.getByRole("button", { name: /recruiters ↔ candidates/i }));
    const popup = screen.getByRole("dialog");
    expect(within(popup).getByText(/isn.t a captured role/i)).toBeInTheDocument();
  });

  it("does not flag the clean mappings", () => {
    render(<RelationshipsTab event={eventStats()} />);
    fireEvent.click(screen.getByRole("button", { name: /founders ↔ investors/i }));
    const popup = screen.getByRole("dialog");
    expect(within(popup).queryByText(/isn.t a captured role/i)).not.toBeInTheDocument();
    expect(within(popup).getByText(/48 matches/i)).toBeInTheDocument();
  });
});

describe("RelationshipsTab — heatmap", () => {
  it("renders the group grid with 4-letter labels and dashes for empty cells", () => {
    render(<RelationshipsTab event={eventStats()} />);
    expect(screen.getByText("CONNECTION HEATMAP")).toBeInTheDocument();
    expect(screen.getAllByText("Foun").length).toBeGreaterThanOrEqual(2); // column header + row label
    expect(screen.getByText("58")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBe(2); // the two 0 cells
  });

  it("opens a detail popover for a non-empty cell", () => {
    render(<RelationshipsTab event={eventStats()} />);
    fireEvent.click(screen.getByText("58"));
    const popup = screen.getByRole("dialog");
    expect(within(popup).getByText(/Founder \/ Co-founder/)).toBeInTheDocument();
  });

  it("does not open a popover for an empty cell", () => {
    render(<RelationshipsTab event={eventStats()} />);
    fireEvent.click(screen.getAllByText("—")[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("RelationshipsTab — status strip", () => {
  it("keeps the connection and meeting status breakdown", () => {
    render(<RelationshipsTab event={eventStats()} />);
    expect(screen.getByText("CONNECTION & MEETING STATUS")).toBeInTheDocument();
    expect(screen.getByText(/83%/)).toBeInTheDocument(); // conversation rate: 5 / 6 accepted
    expect(screen.getByText("Pending")).toBeInTheDocument(); // connection status
    expect(screen.getByText("Scheduled")).toBeInTheDocument(); // meeting status
  });
});

describe("RelationshipsTab — no composite score", () => {
  it("never renders an OFFRIP score", () => {
    render(<RelationshipsTab event={eventStats()} />);
    expect(screen.queryByText(/offrip score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/relationship score/i)).not.toBeInTheDocument();
  });
});
