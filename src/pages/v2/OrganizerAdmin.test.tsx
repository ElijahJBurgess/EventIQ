import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventStats } from "@/lib/enterpriseOverview";
import OrganizerAdmin from "./OrganizerAdmin";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

// A row shape for the "list-events" / "update-event" / "set-event-published"
// admin-auth actions (distinct from the analytics EventStats shape).
function adminEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt",
    name: "Preview Event",
    venue: "The Foundry",
    location: "Atlanta, GA",
    date: "2026-08-01",
    end_date: null,
    event_type: "Conference",
    is_published: true,
    is_demo: false,
    ...overrides,
  };
}

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

const adminEventState: { rows: Array<Record<string, unknown>> } = { rows: [] };
const deletionImpact = { matches: 42, messages: 15, meetings: 3 };

beforeEach(() => {
  invoke.mockReset();
  adminEventState.rows = [adminEvent()];
  invoke.mockImplementation((_fn: string, opts: { body: Record<string, unknown> }) => {
    const { action } = opts.body;
    if (action === "insights") {
      return Promise.resolve({ data: { valid: true, insights: ["Check-in was 37 of 38."], cached: true }, error: null });
    }
    if (action === "list-reports") {
      return Promise.resolve({ data: { valid: true, reports: [] }, error: null });
    }
    if (action === "list-events") {
      return Promise.resolve({ data: { valid: true, events: adminEventState.rows }, error: null });
    }
    if (action === "update-event") {
      const updated = adminEvent({
        id: opts.body.eventId,
        name: opts.body.name,
        venue: opts.body.venue,
        location: opts.body.location,
        is_published: opts.body.isPublished === true,
      });
      return Promise.resolve({ data: { valid: true, event: updated }, error: null });
    }
    if (action === "set-event-published") {
      return Promise.resolve({
        data: { valid: true, event: adminEvent({ id: opts.body.eventId, is_published: opts.body.isPublished === true }) },
        error: null,
      });
    }
    if (action === "event-deletion-impact") {
      return Promise.resolve({ data: { valid: true, ...deletionImpact }, error: null });
    }
    if (action === "delete-event") {
      return Promise.resolve({ data: { valid: true, deleted: true }, error: null });
    }
    // event-stats (analytics) + fallback
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

  it("puts the Events tab first, and the create-event form no longer sits in the page body", async () => {
    renderAdmin();
    await screen.findByText("PROFILES CREATED");

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Events", "Overview", "Audience", "Relationships", "Outcomes", "Insights", "Reports"]);

    // Overview is the landing tab — the create form is not visible here.
    expect(screen.queryByRole("heading", { name: /create an event/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new event/i })).not.toBeInTheDocument();
  });

  it("moves the create form and an all-events management list into the Events tab", async () => {
    renderAdmin();
    await screen.findByText("PROFILES CREATED");

    fireEvent.mouseDown(screen.getByRole("tab", { name: /^events$/i }));

    expect(await screen.findByRole("heading", { name: /create an event/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new event/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /all events/i })).toBeInTheDocument();
    expect(await screen.findByText("Preview Event")).toBeInTheDocument();
    await waitFor(() =>
      expect(invoke.mock.calls.some((c) => c[1].body.action === "list-events" && c[1].body.passwordHash === "a".repeat(64))).toBe(true),
    );
  });

  it("renders the Relationships tab patterns", async () => {
    renderAdmin();
    await screen.findByText("PROFILES CREATED");
    expect(screen.queryByText("HOW THE EVENT CONNECTED")).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /relationships/i }));

    expect(await screen.findByText("HOW THE EVENT CONNECTED")).toBeInTheDocument();
    expect(screen.getByText("Founders ↔ Investors")).toBeInTheDocument();
    expect(screen.getByText("CONNECTION HEATMAP")).toBeInTheDocument();
    expect(screen.getByText("CONNECTION & MEETING STATUS")).toBeInTheDocument();
  });

  it("renders the Audience tab breakdowns", async () => {
    renderAdmin();
    await screen.findByText("PROFILES CREATED");
    expect(screen.queryByText("WHO WAS IN THE EVENT?")).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /audience/i }));

    expect(await screen.findByText("WHO WAS IN THE EVENT?")).toBeInTheDocument();
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

describe("OrganizerAdmin — Events tab management", () => {
  async function openEventsTab() {
    renderAdmin();
    await screen.findByText("PROFILES CREATED");
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^events$/i }));
    await screen.findByText("Preview Event");
  }

  it("edits an event through the update-event admin-auth action (password hash, not a JWT)", async () => {
    await openEventsTab();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("heading", { name: /edit event/i })).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/event name/i);
    expect(nameInput).toHaveValue("Preview Event");
    fireEvent.change(nameInput, { target: { value: "Preview Event 2026" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(
        invoke.mock.calls.some(
          (c) =>
            c[1].body.action === "update-event" &&
            c[1].body.eventId === "evt" &&
            c[1].body.name === "Preview Event 2026" &&
            c[1].body.passwordHash === "a".repeat(64),
        ),
      ).toBe(true),
    );
    expect(await screen.findByText("Preview Event 2026")).toBeInTheDocument();
  });

  it("blocks a blank-name edit before any admin-auth call (shared validation)", async () => {
    await openEventsTab();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("heading", { name: /edit event/i });
    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/event name is required/i)).toBeInTheDocument();
    expect(invoke.mock.calls.some((c) => c[1].body.action === "update-event")).toBe(false);
  });

  it("hides an event via set-event-published", async () => {
    await openEventsTab();
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));

    await waitFor(() =>
      expect(
        invoke.mock.calls.some(
          (c) => c[1].body.action === "set-event-published" && c[1].body.eventId === "evt" && c[1].body.isPublished === false,
        ),
      ).toBe(true),
    );
    expect(await screen.findByRole("button", { name: "Unhide" })).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
  });

  it("shows cascade counts and gates delete on an exact, case-sensitive name match", async () => {
    await openEventsTab();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(invoke.mock.calls.some((c) => c[1].body.action === "event-deletion-impact" && c[1].body.eventId === "evt")).toBe(true),
    );
    expect(await screen.findByText(/42 matches/)).toBeInTheDocument();
    expect(screen.getByText(/15 messages/)).toBeInTheDocument();
    expect(screen.getByText(/3 meetings/)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /delete permanently/i });
    const confirmInput = screen.getByLabelText(/type the event name/i);
    expect(confirmButton).toBeDisabled();
    fireEvent.change(confirmInput, { target: { value: "preview event" } });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(invoke.mock.calls.some((c) => c[1].body.action === "delete-event")).toBe(false);

    fireEvent.change(confirmInput, { target: { value: "Preview Event" } });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(
        invoke.mock.calls.some(
          (c) => c[1].body.action === "delete-event" && c[1].body.eventId === "evt" && c[1].body.confirmName === "Preview Event",
        ),
      ).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText("Preview Event")).not.toBeInTheDocument());
  });

  it("manages an event this dashboard did not create (no ownership restriction)", async () => {
    // A self-serve event owned by some other organizer — the list-events action
    // returns it because the dashboard is password-gated, not RLS-scoped.
    adminEventState.rows = [adminEvent({ id: "self-serve-evt", name: "Someone Else's Mixer" })];
    renderAdmin();
    await screen.findByText("PROFILES CREATED");
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^events$/i }));

    expect(await screen.findByText("Someone Else's Mixer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() =>
      expect(
        invoke.mock.calls.some(
          (c) => c[1].body.action === "set-event-published" && c[1].body.eventId === "self-serve-evt",
        ),
      ).toBe(true),
    );
  });
});
