import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventStats } from "@/lib/enterpriseOverview";
import OrganizerAdmin from "./OrganizerAdmin";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

// The Overview tab renders a Recharts bar chart; jsdom can't lay it out, and
// this suite only cares about tab wiring, so stub the chart primitives.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="barchart">{children}</div>,
  Bar: () => null,
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
    totalRegistrations: 40,
    totalCheckedIn: 37,
    profilesCreated: 1842,
    totalMatches: 703,
    totalConnectionRequests: 9,
    totalMeetingRequests: 5,
    meetingsByStatus: { requested: 0, accepted: 1, declined: 1, scheduled: 1, completed: 2 },
    meetingsConfirmed: 4,
    connectionsByStatus: { accepted: 6, declined: 1, pending: 3 },
    connectionsWithConversation: 1,
    conversationsStarted: 5,
    outcomesReported: 2,
    avgOverallRating: 4.2,
    avgMatchingRating: 4.0,
    avgNetworkingQuality: 4.1,
    selfReportsTotal: 2,
    selfReportsValuable: 1,
    feedbackParticipation: { participants: 3, checkedIn: 37 },
    connectionsByDay: [{ date: "2026-08-01", connections: 4, meetings: 2 }],
    funnel: [
      { key: "profile_created", label: "Profile created", value: 1842 },
      { key: "matched", label: "Matched", value: 37 },
      { key: "request_sent", label: "Request sent", value: 9 },
      { key: "accepted", label: "Accepted", value: 6 },
      { key: "conversation_started", label: "Conversation started", value: 5 },
      { key: "meeting", label: "Meeting", value: 5 },
      { key: "outcome_reported", label: "Outcome reported", value: 2 },
    ],
    roleBreakdown: [{ label: "Founder / Co-founder", count: 8 }],
    intentBreakdown: [{ label: "Meet Collaborators", count: 7, pct: 19 }],
    segments: [
      { key: "c_suite", label: "C-Suite / Executives", count: 3, pct: 8 },
      { key: "founders", label: "Founders", count: 8, pct: 22 },
      { key: "actively_hiring", label: "Actively hiring", count: 7, pct: 19 },
      { key: "raising_capital", label: "Raising capital", count: 4, pct: 11 },
      { key: "seeking_partnerships", label: "Seeking partnerships", count: 6, pct: 16 },
      { key: "open_to_opportunities", label: "Open to opportunities", count: 9, pct: 24 },
    ],
    relationshipPairs: [
      { key: "founders_investors", label: "Founders ↔ Investors", color: "#69C0BE", matches: 48, accepted: 3, meetings: 3 },
      { key: "recruiters_candidates", label: "Recruiters ↔ Candidates", color: "#DCE86A", matches: 91, accepted: 1, meetings: 0 },
      { key: "brands_creators", label: "Brands ↔ Creators", color: "#FF5338", matches: 9, accepted: 0, meetings: 0 },
      { key: "enterprises_startups", label: "Enterprises ↔ Startups", color: "#4387F5", matches: 48, accepted: 0, meetings: 0 },
      { key: "executives_founders", label: "Executives ↔ Founders", color: "#000000", matches: 24, accepted: 1, meetings: 1 },
    ],
    connectionHeatmap: { groups: ["Founder / Co-founder", "Investor"], matrix: [[100, 60], [60, 20]] },
    topExpertise: [],
    topInterestsAndCommunities: [],
    topIndustries: [{ label: "AI", count: 11 }],
    topLocations: [{ label: "Atlanta, GA", count: 29 }],
    ...overrides,
  };
}

function renderAdmin() {
  return render(
    <MemoryRouter>
      <OrganizerAdmin />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation((_fn: string, opts: { body: { action: string } }) => {
    if (opts.body.action === "insights") {
      return Promise.resolve({ data: { valid: true, insights: ["Check-in was 37 of 38."], cached: true }, error: null });
    }
    if (opts.body.action === "list-reports") {
      return Promise.resolve({ data: { valid: true, reports: [] }, error: null });
    }
    return Promise.resolve({ data: { valid: true, events: [eventStats()] }, error: null });
  });
  localStorage.setItem(
    "ooo-organizer-admin-session",
    JSON.stringify({ passwordHash: "a".repeat(64), grantedAt: Date.now() }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("OrganizerAdmin — enterprise tabs", () => {
  it("lands on the Overview tab with the new headline metrics", async () => {
    renderAdmin();
    expect(await screen.findByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /audience/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /relationships/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /outcomes/i })).toBeInTheDocument();

    expect(await screen.findByText("PROFILES CREATED")).toBeInTheDocument();
    expect(screen.getByText("CONVERSATIONS STARTED")).toBeInTheDocument();
  });

  it("renders the Relationships tab patterns", async () => {
    renderAdmin();
    await screen.findByText("PROFILES CREATED");
    expect(screen.queryByText("HOW THE ROOM CONNECTED")).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /relationships/i }));

    expect(await screen.findByText("HOW THE ROOM CONNECTED")).toBeInTheDocument();
    expect(screen.getByText("Founders ↔ Investors")).toBeInTheDocument();
    expect(screen.getByText("CONNECTION HEATMAP")).toBeInTheDocument();
    expect(screen.getByText("CONNECTION & MEETING STATUS")).toBeInTheDocument();
  });

  it("renders the Audience tab breakdowns", async () => {
    renderAdmin();
    await screen.findByText("PROFILES CREATED");
    expect(screen.queryByText("WHO WAS IN THE ROOM?")).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /audience/i }));

    expect(await screen.findByText("WHO WAS IN THE ROOM?")).toBeInTheDocument();
    expect(screen.getByText("BY FUNCTION")).toBeInTheDocument();
    expect(screen.getByText("Open to opportunities")).toBeInTheDocument();
  });

  it("renders the Insights tab and loads AI insights", async () => {
    renderAdmin();
    await screen.findByText("PROFILES CREATED");
    fireEvent.mouseDown(screen.getByRole("tab", { name: /insights/i }));

    expect(await screen.findByText("WHAT OFFRIP NOTICED")).toBeInTheDocument();
    expect(await screen.findByText("Check-in was 37 of 38.")).toBeInTheDocument();
    expect(screen.getByText("ORGANIZER COPILOT")).toBeInTheDocument();
    await waitFor(() =>
      expect(invoke.mock.calls.some((c) => c[1].body.action === "insights" && c[1].body.passwordHash === "a".repeat(64))).toBe(true),
    );
  });

  it("renders the Reports tab and loads the report list", async () => {
    renderAdmin();
    await screen.findByText("PROFILES CREATED");
    fireEvent.mouseDown(screen.getByRole("tab", { name: /reports/i }));

    expect(await screen.findByText("REPORTS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /build a report/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(invoke.mock.calls.some((c) => c[1].body.action === "list-reports" && c[1].body.eventId === "evt")).toBe(true),
    );
  });

  it("routes a Overview 'view all' control to its target tab", async () => {
    renderAdmin();
    const viewAll = await screen.findByRole("button", { name: /view all — relationship funnel/i });
    fireEvent.click(viewAll);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /audience/i })).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("still gates on the organizer password when there is no session", async () => {
    localStorage.clear();
    renderAdmin();
    expect(await screen.findByText(/organizer access/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /overview/i })).not.toBeInTheDocument();
  });
});
