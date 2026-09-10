import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MatchesTab from "./MatchesTab";

const mocks = vi.hoisted(() => ({
  sendConnectRequest: vi.fn(async () => ({ status: "sent" as const })),
  saveMatch: vi.fn(async () => true),
  unsaveMatch: vi.fn(async () => true),
  fetchSavedMatchIds: vi.fn(async () => new Set<string>()),
  getUser: vi.fn(async () => ({ data: { user: { id: "current-user" } } })),
}));

vi.mock("@/lib/connectRequest", () => ({ sendConnectRequest: mocks.sendConnectRequest }));
vi.mock("@/lib/savedMatches", () => ({
  fetchSavedMatchIds: mocks.fetchSavedMatchIds,
  saveMatch: mocks.saveMatch,
  unsaveMatch: mocks.unsaveMatch,
}));

vi.mock("@/integrations/supabase/client", () => {
  const registrations = [{ event_id: "room-a" }];
  const events = [{ id: "room-a", name: "Room A", date: "2026-08-20" }];
  const matches = [
    {
      id: "match-1",
      event_id: "room-a",
      user_a_id: "current-user",
      user_b_id: "jordan",
      a_to_b_score: 94,
      b_to_a_score: 88,
      a_to_b_confidence: 90,
      b_to_a_confidence: 85,
      reciprocity_label: "Mutual Value",
      match_reason: "You're hiring engineering talent and Jordan is a technical leader.",
      shared_industries: ["Technical Leadership"],
      shared_interests: ["B2B SaaS", "AI Experience", "Extra Interest"],
    },
  ];
  const profiles = [
    {
      id: "jordan",
      full_name: "Jordan Lee",
      avatar_url: null,
      title: "VP Engineering",
      company: "TechCo",
      location: "San Francisco, CA",
    },
  ];

  const makeBuilder = (table: string) => {
    let columns = "";
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn((value: string) => {
      columns = value;
      return builder;
    });
    for (const method of ["eq", "in", "or", "order", "not"]) builder[method] = vi.fn(() => builder);
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      let data: unknown[] = [];
      if (table === "event_registrations" && columns === "event_id") data = registrations;
      if (table === "events") data = events;
      if (table === "matched_event_attendance") data = [{ profile_id: "jordan" }];
      if (table === "matches") data = matches;
      if (table === "attendee_profiles") data = profiles;
      if (table === "messages") data = [];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return builder;
  };

  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      auth: { getUser: mocks.getUser },
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendConnectRequest.mockResolvedValue({ status: "sent" });
  mocks.saveMatch.mockResolvedValue(true);
  mocks.unsaveMatch.mockResolvedValue(true);
  mocks.fetchSavedMatchIds.mockResolvedValue(new Set<string>());
});
afterEach(cleanup);

function renderTab(onViewFullProfile = vi.fn()) {
  render(
    <MatchesTab
      userId="current-user"
      selectedEventId="room-a"
      onSelectedEventChange={vi.fn()}
      onViewFullProfile={onViewFullProfile}
    />,
  );
  return { onViewFullProfile };
}

async function findCard() {
  const name = await screen.findByText("Jordan Lee");
  const card = name.closest("[class*='border']") as HTMLElement;
  return within(card.parentElement as HTMLElement);
}

describe("Matches card", () => {
  it("shows role · company, location, and up to 3 shared tags", async () => {
    renderTab();
    const card = await findCard();

    expect(card.getByText("VP Engineering · TechCo")).toBeInTheDocument();
    expect(card.getByText("San Francisco, CA")).toBeInTheDocument();
    expect(card.getByText("Technical Leadership")).toBeInTheDocument();
    expect(card.getByText("B2B SaaS")).toBeInTheDocument();
    expect(card.getByText("AI Experience")).toBeInTheDocument();
    expect(card.queryByText("Extra Interest")).not.toBeInTheDocument();
    expect(screen.getByText("94%")).toBeInTheDocument();
  });

  it("opens the reason in a modal from See Why, and closing it hides the reason", async () => {
    renderTab();
    await screen.findByText("Jordan Lee");

    expect(screen.queryByText(/hiring engineering talent/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /see why/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/why offrip matched you/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/hiring engineering talent/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText(/hiring engineering talent/)).not.toBeInTheDocument();
  });

  it("wires View Profile to onViewFullProfile", async () => {
    const { onViewFullProfile } = renderTab();
    await screen.findByText("Jordan Lee");

    fireEvent.click(screen.getByRole("button", { name: /view profile/i }));
    expect(onViewFullProfile).toHaveBeenCalledWith("match-1");
  });

  it("opens the full profile when the name is clicked", async () => {
    const { onViewFullProfile } = renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Jordan Lee" }));
    expect(onViewFullProfile).toHaveBeenCalledWith("match-1");
  });

  it("wires Save to the saveMatch toggle and reflects the saved state", async () => {
    renderTab();
    await screen.findByText("Jordan Lee");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveMatch).toHaveBeenCalledWith("match-1", "current-user"));
    expect(screen.getAllByRole("button", { name: "Saved" }).length).toBeGreaterThanOrEqual(2);
  });

  it("opens the connect composer from Message and sends through sendConnectRequest", async () => {
    renderTab();
    await screen.findByText("Jordan Lee");

    fireEvent.click(screen.getByRole("button", { name: /^message$/i }));
    const composer = await screen.findByRole("textbox");
    fireEvent.change(composer, { target: { value: "Hi Jordan" } });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(mocks.sendConnectRequest).toHaveBeenCalledWith(
      expect.objectContaining({ matchId: "match-1", recipientId: "jordan", content: "Hi Jordan" }),
    ));
  });

  it("drops the Request Intro and Pass actions", async () => {
    renderTab();
    await screen.findByText("Jordan Lee");

    expect(screen.queryByText(/request intro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^pass$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^shared:/i)).not.toBeInTheDocument();
  });
});
