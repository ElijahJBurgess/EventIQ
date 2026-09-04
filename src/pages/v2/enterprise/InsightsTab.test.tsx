import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InsightsTab from "./InsightsTab";
import type { EventStats } from "@/lib/enterpriseOverview";

const invoke = vi.fn();
const toast = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));
vi.mock("sonner", () => ({ toast: (...args: unknown[]) => toast(...args) }));

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

function renderTab() {
  return render(<InsightsTab event={eventStats()} accessHash={"a".repeat(64)} />);
}

beforeEach(() => {
  invoke.mockReset();
  toast.mockReset();
  invoke.mockImplementation((_fn: string, opts: { body: { action: string } }) => {
    if (opts.body.action === "insights") {
      return Promise.resolve({
        data: { valid: true, insights: ["Check-in was 37 of 38.", "703 matches produced 6 accepted connections."], generatedAt: "2026-09-03T00:00:00Z", cached: true },
        error: null,
      });
    }
    if (opts.body.action === "copilot") {
      return Promise.resolve({ data: { valid: true, answer: "37 of 38 registrants checked in." }, error: null });
    }
    return Promise.resolve({ data: { valid: true }, error: null });
  });
});

afterEach(cleanup);

describe("InsightsTab — generated insights", () => {
  it("loads insights on mount and renders them as numbered cards", async () => {
    renderTab();
    expect(await screen.findByText("Check-in was 37 of 38.")).toBeInTheDocument();
    expect(screen.getByText("703 matches produced 6 accepted connections.")).toBeInTheDocument();
    expect(screen.getByText("INSIGHT 01")).toBeInTheDocument();
    expect(screen.getByText("INSIGHT 02")).toBeInTheDocument();
    expect(screen.getByText(/AI-generated intelligence from Preview Event/)).toBeInTheDocument();

    const insightsCall = invoke.mock.calls.find((c) => c[1].body.action === "insights");
    expect(insightsCall?.[1].body).toMatchObject({ action: "insights", passwordHash: "a".repeat(64), eventId: "evt-1" });
  });

  it("regenerates on the Refresh button with refresh: true", async () => {
    renderTab();
    await screen.findByText("Check-in was 37 of 38.");
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() =>
      expect(invoke.mock.calls.some((c) => c[1].body.action === "insights" && c[1].body.refresh === true)).toBe(true),
    );
  });

  it("shows an error but keeps prior insights when generation fails", async () => {
    invoke.mockResolvedValueOnce({
      data: { valid: true, insights: [], generatedAt: null, cached: false, error: "generation_failed" },
      error: null,
    });
    renderTab();
    expect(await screen.findByText(/couldn.t generate insights/i)).toBeInTheDocument();
  });
});

describe("InsightsTab — organizer copilot", () => {
  it("fills the input from a suggested question chip without asking", async () => {
    renderTab();
    await screen.findByText("Check-in was 37 of 38.");
    const chip = screen.getAllByRole("button", { name: /funnel|check-in|role pairings|attendees/i })[0];
    fireEvent.click(chip);
    expect((screen.getByPlaceholderText(/ask about your event data/i) as HTMLInputElement).value).toBe(chip.textContent);
    expect(invoke.mock.calls.some((c) => c[1].body.action === "copilot")).toBe(false);
  });

  it("asks the copilot and renders the answer", async () => {
    renderTab();
    await screen.findByText("Check-in was 37 of 38.");
    fireEvent.change(screen.getByPlaceholderText(/ask about your event data/i), { target: { value: "How was check-in?" } });
    fireEvent.click(screen.getByRole("button", { name: /^ask/i }));

    expect(await screen.findByText("37 of 38 registrants checked in.")).toBeInTheDocument();
    const copilotCall = invoke.mock.calls.find((c) => c[1].body.action === "copilot");
    expect(copilotCall?.[1].body).toMatchObject({ action: "copilot", question: "How was check-in?", eventId: "evt-1" });
  });

  it("does nothing when asked with an empty question", async () => {
    renderTab();
    await screen.findByText("Check-in was 37 of 38.");
    fireEvent.click(screen.getByRole("button", { name: /^ask/i }));
    expect(invoke.mock.calls.some((c) => c[1].body.action === "copilot")).toBe(false);
  });
});

describe("InsightsTab — export row", () => {
  it("shows a coming-soon toast for each export button", async () => {
    renderTab();
    await screen.findByText("Check-in was 37 of 38.");
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/coming soon/i));
  });
});
