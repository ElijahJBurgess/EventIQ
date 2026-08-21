import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardV2 from "./Dashboard";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  user: { id: "current-user", email: "avery@example.com" },
  functionInvoke: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("@/v2/AuthProvider", () => ({
  useAuth: () => ({
    user: mocks.user,
    signOut: mocks.signOut,
  }),
}));

vi.mock("@/components/notifications/NotificationBell", () => ({
  default: () => <button aria-label="Notifications">Bell</button>,
}));

vi.mock("@/components/matches/FullProfileView", () => ({
  default: ({ matchId, onBack, backLabel }: { matchId: string; onBack: () => void; backLabel?: string }) => (
    <section aria-label="Full profile test view">
      <p>Profile match: {matchId}</p>
      <button type="button" onClick={onBack}>← {backLabel ?? "Back to Matches"}</button>
    </section>
  ),
}));

vi.mock("@/components/matches/MatchesTab", () => ({
  default: ({
    selectedEventId,
    onSelectedEventChange,
  }: {
    selectedEventId?: string;
    onSelectedEventChange: (eventId: string) => void;
  }) => (
    <section aria-label="People test view">
      <p>People event: {selectedEventId ?? "none"}</p>
      <button type="button" onClick={() => onSelectedEventChange("room-b")}>Switch to Room B</button>
    </section>
  ),
}));

vi.mock("@/integrations/supabase/client", () => {
  const resultFor = (table: string) => ({
    data: table === "profiles"
      ? [{ id: "current-user", full_name: "Avery Morgan", email: "avery@example.com" }]
      : table === "events"
        ? [
            { id: "room-a", name: "Room A", venue: "Hall A", location: "Los Angeles", date: "2099-08-20", end_date: null, is_demo: false },
            { id: "room-b", name: "Room B", venue: "Hall B", location: "Los Angeles", date: "2099-08-21", end_date: null, is_demo: false },
          ]
        : table === "event_registrations"
          ? [
              { event_id: "room-a", is_checked_in: true, checked_in_at: "2099-08-20T09:00:00Z" },
              { event_id: "room-b", is_checked_in: true, checked_in_at: "2099-08-21T09:00:00Z" },
            ]
          : [],
    error: null,
    count: 0,
  });

  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "in", "or", "order", "limit", "gte", "not"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn(async () => ({
      data: table === "profiles"
        ? { id: "current-user", full_name: "Avery Morgan", email: "avery@example.com" }
        : null,
      error: null,
    }));
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(resultFor(table)).then(resolve, reject);
    return builder;
  };

  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      rpc: vi.fn(async () => ({ data: null, error: null })),
      functions: { invoke: mocks.functionInvoke },
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.functionInvoke.mockResolvedValue({
    data: {
      success: true,
      requestId: "server-request",
      eventId: "room-b",
      answer: "Marcus is your strongest checked-in match.",
      people: [{ profileId: "marcus-id", matchId: "match-marcus", name: "Marcus Lee", title: "Investor", company: "Northstar", matchScore: 94, reason: "Fundraising fit" }],
      meetings: [{ meetingId: "meeting-marcus", matchId: "match-marcus", otherProfileId: "marcus-id", otherName: "Marcus Lee", scheduledAt: "2099-08-21T18:00:00Z", duration: 30, location: "Lobby", status: "scheduled" }],
      context: {
        status: "ready",
        authenticatedUserId: "current-user",
        event: { id: "room-b", name: "Room B" },
        checkedInMatchCount: 0,
        conversationCount: 0,
        activeMeetingCount: 0,
        allowedMatchIds: [],
        allowedProfileIds: [],
      },
    },
    error: null,
  });
});
afterEach(cleanup);

describe("Dashboard Concierge navigation", () => {
  it("exposes desktop and mobile navigation and preserves the session draft across tab changes", async () => {
    render(
      <MemoryRouter>
        <DashboardV2 />
      </MemoryRouter>,
    );

    const desktopNav = await screen.findByRole("navigation", { name: "Attendee navigation" });
    const mobileNav = screen.getByRole("navigation", { name: "Mobile attendee navigation" });
    expect(within(desktopNav).getByRole("button", { name: "Concierge" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("button", { name: "Concierge" })).toBeInTheDocument();

    fireEvent.click(within(desktopNav).getByRole("button", { name: "Concierge" }));
    expect(screen.getByRole("heading", { name: "OFFRIP Concierge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Who am I meeting today?" }));
    expect(screen.getByRole("textbox", { name: "Ask OFFRIP Concierge" })).toHaveValue(
      "Who am I meeting today?",
    );

    fireEvent.click(within(desktopNav).getByRole("button", { name: "Home" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "OFFRIP Concierge" })).not.toBeInTheDocument());

    fireEvent.click(within(mobileNav).getByRole("button", { name: "Concierge" }));
    expect(screen.getByRole("textbox", { name: "Ask OFFRIP Concierge" })).toHaveValue(
      "Who am I meeting today?",
    );
  });

  it("uses one canonical Room for Rooms, People, and Concierge across tab changes", async () => {
    render(
      <MemoryRouter>
        <DashboardV2 />
      </MemoryRouter>,
    );

    const desktopNav = await screen.findByRole("navigation", { name: "Attendee navigation" });
    fireEvent.click(within(desktopNav).getByRole("button", { name: "Rooms" }));
    const seeRoomButtons = await screen.findAllByRole("button", { name: "See the room →" });

    fireEvent.click(seeRoomButtons[0]);
    expect(screen.getByText("People event: room-a")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to Room B" }));
    expect(screen.getByText("People event: room-b")).toBeInTheDocument();

    const mobileNav = screen.getByRole("navigation", { name: "Mobile attendee navigation" });
    fireEvent.click(within(mobileNav).getByRole("button", { name: "Concierge" }));
    expect(screen.getByRole("region", { name: "OFFRIP Concierge" })).toHaveAttribute(
      "data-selected-event-id",
      "room-b",
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Ask OFFRIP Concierge" }), {
      target: { value: "Who is in Room B?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Marcus is your strongest checked-in match.")).toBeInTheDocument();
    expect(mocks.functionInvoke).toHaveBeenCalledWith("concierge", expect.objectContaining({
      body: expect.objectContaining({ question: "Who is in Room B?", eventId: "room-b" }),
    }));

    fireEvent.click(screen.getByRole("button", { name: "View Marcus Lee's profile" }));
    expect(screen.getByText("Profile match: match-marcus")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← Back to Concierge" }));
    expect(screen.getByText("Marcus is your strongest checked-in match.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View My Day →" }));
    expect(await screen.findByText("Your day")).toBeInTheDocument();
    fireEvent.click(within(mobileNav).getByRole("button", { name: "Concierge" }));
    expect(screen.getByText("Marcus is your strongest checked-in match.")).toBeInTheDocument();

    fireEvent.click(within(desktopNav).getByRole("button", { name: "Home" }));
    fireEvent.click(within(desktopNav).getByRole("button", { name: "People" }));
    expect(screen.getByText("People event: room-b")).toBeInTheDocument();
    fireEvent.click(within(mobileNav).getByRole("button", { name: "Concierge" }));
    expect(screen.getByText("Who is in Room B?")).toBeInTheDocument();
    expect(screen.getByText("Marcus is your strongest checked-in match.")).toBeInTheDocument();
  });
});
