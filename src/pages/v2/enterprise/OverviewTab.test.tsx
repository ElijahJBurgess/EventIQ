import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OverviewTab from "./OverviewTab";
import type { EventStats } from "@/lib/enterpriseOverview";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ data, children }: { data: unknown[]; children: React.ReactNode }) => (
    <div data-testid="barchart" data-len={data.length}>
      {JSON.stringify(data)}
      {children}
    </div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => <div data-testid={`bar-${dataKey}`} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

function eventStats(overrides: Partial<EventStats> = {}): EventStats {
  return {
    id: "evt",
    name: "Preview Event",
    date: "2026-08-01",
    totalRegistrations: 2000,
    totalCheckedIn: 100,
    profilesCreated: 1842,
    totalMatches: 12481,
    totalConnectionRequests: 4218,
    totalMeetingRequests: 1681,
    meetingsByStatus: { requested: 0, accepted: 200, declined: 30, scheduled: 343, completed: 1108 },
    meetingsConfirmed: 874,
    connectionsByStatus: { accepted: 2790, declined: 100, pending: 50 },
    connectionsWithConversation: 900,
    conversationsStarted: 1627,
    outcomesReported: 412,
    avgOverallRating: 4.3,
    avgMatchingRating: 4.1,
    avgNetworkingQuality: 4.0,
    selfReportsTotal: 300,
    selfReportsValuable: 240,
    feedbackParticipation: { participants: 74, checkedIn: 100 },
    connectionsByDay: [
      { date: "2026-08-01", connections: 10, meetings: 4 },
      { date: "2026-08-02", connections: 20, meetings: 9 },
    ],
    funnel: [
      { key: "profile_created", label: "Profile created", value: 1842 },
      { key: "matched", label: "Matched", value: 1500 },
      { key: "request_sent", label: "Request sent", value: 900 },
      { key: "accepted", label: "Accepted", value: 600 },
      { key: "conversation_started", label: "Conversation started", value: 450 },
      { key: "meeting", label: "Meeting", value: 300 },
      { key: "outcome_reported", label: "Outcome reported", value: 120 },
    ],
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

afterEach(cleanup);

describe("OverviewTab — headline metrics", () => {
  it("shows the seven headline numbers with thousands separators", () => {
    render(<OverviewTab event={eventStats()} onNavigateTab={vi.fn()} />);
    expect(screen.getAllByText("1,842").length).toBeGreaterThanOrEqual(1); // profiles created
    expect(screen.getByText("12,481")).toBeInTheDocument(); // matches generated
    expect(screen.getByText("4,218")).toBeInTheDocument(); // connection requests
    expect(screen.getByText("2,790")).toBeInTheDocument(); // connections accepted
    expect(screen.getByText("1,627")).toBeInTheDocument(); // conversations started
    expect(screen.getByText("874")).toBeInTheDocument(); // meetings confirmed
    expect(screen.getByText("412")).toBeInTheDocument(); // outcomes reported
    expect(screen.getByText("PROFILES CREATED")).toBeInTheDocument();
    expect(screen.getByText("CONVERSATIONS STARTED")).toBeInTheDocument();
  });

  it("does not render an OFFRIP score anywhere", () => {
    render(<OverviewTab event={eventStats()} onNavigateTab={vi.fn()} />);
    expect(screen.queryByText(/offrip score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/relationship score/i)).not.toBeInTheDocument();
  });
});

describe("OverviewTab — experience signals", () => {
  it("derives meetings scheduled from scheduled + completed and shows feedback participation", () => {
    render(<OverviewTab event={eventStats()} onNavigateTab={vi.fn()} />);
    expect(screen.getByText("1,451")).toBeInTheDocument(); // 343 scheduled + 1108 completed
    expect(screen.getByText("1,108")).toBeInTheDocument(); // meetings completed
    expect(screen.getByText("74%")).toBeInTheDocument(); // 74 / 100 checked in
  });
});

describe("OverviewTab — connections over time", () => {
  it("feeds day-labelled connection/meeting series into the bar chart", () => {
    render(<OverviewTab event={eventStats()} onNavigateTab={vi.fn()} />);
    const chart = screen.getByTestId("barchart");
    expect(chart).toHaveAttribute("data-len", "2");
    expect(chart).toHaveTextContent("Aug 1");
    expect(chart).toHaveTextContent("Aug 2");
    expect(screen.getByTestId("bar-connections")).toBeInTheDocument();
    expect(screen.getByTestId("bar-meetings")).toBeInTheDocument();
  });

  it("shows an empty state instead of a chart when there is no activity", () => {
    render(<OverviewTab event={eventStats({ connectionsByDay: [] })} onNavigateTab={vi.fn()} />);
    expect(screen.queryByTestId("barchart")).not.toBeInTheDocument();
    expect(screen.getByText(/no connection activity yet/i)).toBeInTheDocument();
  });
});

describe("OverviewTab — relationship funnel", () => {
  it("renders all seven ordered stages with a percentage of the first stage", () => {
    render(<OverviewTab event={eventStats()} onNavigateTab={vi.fn()} />);
    for (const label of [
      "Profile created",
      "Matched",
      "Request sent",
      "Accepted",
      "Conversation started",
      "Meeting",
      "Outcome reported",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("100%")).toBeInTheDocument(); // first stage
    expect(screen.getByText("81%")).toBeInTheDocument(); // 1500 / 1842
    expect(screen.getByText("7%")).toBeInTheDocument(); // 120 / 1842
    expect(screen.getByText("1,500")).toBeInTheDocument();
  });
});

describe("OverviewTab — cross-tab navigation", () => {
  it("routes each section's View all control to the right tab", () => {
    const onNavigateTab = vi.fn();
    render(<OverviewTab event={eventStats()} onNavigateTab={onNavigateTab} />);

    fireEvent.click(screen.getByRole("button", { name: /view all — experience signals/i }));
    fireEvent.click(screen.getByRole("button", { name: /view all — connections over time/i }));
    fireEvent.click(screen.getByRole("button", { name: /view all — relationship funnel/i }));

    expect(onNavigateTab.mock.calls).toEqual([["outcomes"], ["relationships"], ["audience"]]);
  });
});

describe("OverviewTab — metric definitions", () => {
  it("exposes a definition popover from a headline stat", () => {
    render(<OverviewTab event={eventStats()} onNavigateTab={vi.fn()} />);
    const card = screen.getByRole("button", { name: /profiles created/i });
    fireEvent.click(card);
    const popup = screen.getByRole("dialog");
    expect(within(popup).getByText(/finished building their profile/i)).toBeInTheDocument();
  });
});
