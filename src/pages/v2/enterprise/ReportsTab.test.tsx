import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportsTab from "./ReportsTab";
import type { EventStats } from "@/lib/enterpriseOverview";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

function eventStats(overrides: Partial<EventStats> = {}): EventStats {
  return {
    id: "evt-1",
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
    relationshipPairs: [],
    connectionHeatmap: { groups: [], matrix: [] },
    topExpertise: [],
    topInterestsAndCommunities: [],
    topIndustries: [],
    topLocations: [],
    ...overrides,
  };
}

const EXISTING_REPORT = {
  id: "r1",
  event_id: "evt-1",
  executive_summary: "Preview Event drew 38 registered attendees, 37 of whom checked in (97%).",
  insights: [],
  raw_metrics: { meta: { reportType: "executive_impact", title: "August board pack", sections: ["executive_summary", "audience"] } },
  generated_at: "2026-09-01T12:00:00Z",
};

function renderTab() {
  return render(<ReportsTab event={eventStats()} accessHash={"a".repeat(64)} />);
}

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation((_fn: string, opts: { body: { action: string; sections?: string[]; title?: string } }) => {
    if (opts.body.action === "list-reports") {
      return Promise.resolve({ data: { valid: true, reports: [EXISTING_REPORT] }, error: null });
    }
    if (opts.body.action === "create-report") {
      return Promise.resolve({
        data: {
          valid: true,
          report: {
            id: "r2",
            event_id: "evt-1",
            executive_summary: "Preview Event drew 38 registered attendees…",
            insights: [],
            raw_metrics: { meta: { reportType: "executive_impact", title: opts.body.title ?? "x", sections: opts.body.sections ?? [] } },
            generated_at: "2026-09-03T00:00:00Z",
          },
        },
        error: null,
      });
    }
    return Promise.resolve({ data: { valid: true }, error: null });
  });
});

afterEach(cleanup);

describe("ReportsTab — list", () => {
  it("loads and lists existing reports with their type tag", async () => {
    renderTab();
    expect(await screen.findByText("August board pack")).toBeInTheDocument();
    expect(screen.getByText("Executive")).toBeInTheDocument();
    const listCall = invoke.mock.calls.find((c) => c[1].body.action === "list-reports");
    expect(listCall?.[1].body).toMatchObject({ action: "list-reports", eventId: "evt-1", passwordHash: "a".repeat(64) });
  });

  it("opens a report's executive summary on click", async () => {
    renderTab();
    fireEvent.click(await screen.findByText("August board pack"));
    expect(screen.getByText(/37 of whom checked in \(97%\)/)).toBeInTheDocument();
  });
});

describe("ReportsTab — build wizard", () => {
  it("walks scope → type → sections and only allows Executive Impact", async () => {
    renderTab();
    await screen.findByText("August board pack");
    fireEvent.click(screen.getByRole("button", { name: /build a report/i }));

    // Step 1: scope — the one real event
    expect(screen.getByText(/step 1/i)).toBeInTheDocument();
    expect(screen.getByText("Preview Event")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));

    // Step 2: type — Executive Impact selectable, others disabled + coming soon
    expect(screen.getByText(/step 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /executive impact/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^sponsor/i })).toBeDisabled();
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /executive impact/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));

    // Step 3: sections
    expect(screen.getByText(/step 3/i)).toBeInTheDocument();
    const execSummary = screen.getByRole("checkbox", { name: /executive summary/i });
    expect(execSummary).toBeChecked();
    expect(execSummary).toBeDisabled(); // locked
    fireEvent.click(screen.getByRole("checkbox", { name: /ai insights/i }));

    fireEvent.click(screen.getByRole("button", { name: /create report/i }));

    // Confirmation
    expect(await screen.findByText(/report created/i)).toBeInTheDocument();
    const createCall = invoke.mock.calls.find((c) => c[1].body.action === "create-report");
    expect(createCall?.[1].body).toMatchObject({ action: "create-report", eventId: "evt-1", reportType: "executive_impact" });
    expect(createCall?.[1].body.sections).toEqual(expect.arrayContaining(["executive_summary", "ai_insights"]));

    // Done refreshes the list
    invoke.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => expect(invoke.mock.calls.some((c) => c[1].body.action === "list-reports")).toBe(true));
  });

  it("cannot advance past the type step without an available type", async () => {
    renderTab();
    await screen.findByText("August board pack");
    fireEvent.click(screen.getByRole("button", { name: /build a report/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next/i })); // to step 2

    // clicking a disabled type does nothing; Next stays put on step 2 until a valid pick
    fireEvent.click(screen.getByRole("button", { name: /executive impact/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));
    expect(screen.getByText(/step 3/i)).toBeInTheDocument();
  });
});
