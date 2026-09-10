import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MatchesTab from "./MatchesTab";

const mocks = vi.hoisted(() => ({
  registrations: [] as Array<{ event_id: string }>,
  events: [] as Array<{ id: string; name: string; date: string | null }>,
}));

vi.mock("@/lib/savedMatches", () => ({
  fetchSavedMatchIds: vi.fn(async () => new Set<string>()),
  saveMatch: vi.fn(async () => true),
  unsaveMatch: vi.fn(async () => true),
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "or", "order", "not"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      let data: unknown[] = [];
      if (table === "event_registrations") data = mocks.registrations;
      if (table === "events") data = mocks.events;
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return builder;
  };
  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.registrations = [];
  mocks.events = [];
});
afterEach(cleanup);

const REMOVED_MESSAGE = "This event was removed by the organizer. Please join another event.";

describe("MatchesTab — a selected event removed by its organizer", () => {
  it("shows the removed-by-organizer message when the selected event has no registration left", async () => {
    // The deleted event's event_registrations rows cascade away, so the user
    // now has zero joined events while still carrying the old selection.
    mocks.registrations = [];
    mocks.events = [];

    render(
      <MatchesTab
        userId="current-user"
        selectedEventId="ev-deleted"
        onSelectedEventChange={vi.fn()}
        onViewFullProfile={vi.fn()}
      />,
    );

    expect(await screen.findByText(REMOVED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/haven't joined any events/i)).not.toBeInTheDocument();
  });

  it("shows the message (not a silent switch) when the selected event is gone but other joined events remain", async () => {
    mocks.registrations = [{ event_id: "ev-live" }];
    mocks.events = [{ id: "ev-live", name: "Still Running Summit", date: "2026-10-01" }];

    const onSelectedEventChange = vi.fn();
    render(
      <MatchesTab
        userId="current-user"
        selectedEventId="ev-deleted"
        onSelectedEventChange={onSelectedEventChange}
        onViewFullProfile={vi.fn()}
      />,
    );

    expect(await screen.findByText(REMOVED_MESSAGE)).toBeInTheDocument();
    // It did not silently adopt the surviving event as the selection.
    expect(onSelectedEventChange).not.toHaveBeenCalledWith("ev-live");
    // A recovery picker is offered even though there is only one other event.
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Still Running Summit" })).toBeInTheDocument();
  });

  it("does not show the message for a fresh user who simply has not joined anything", async () => {
    mocks.registrations = [];
    mocks.events = [];

    render(
      <MatchesTab
        userId="current-user"
        selectedEventId={undefined}
        onSelectedEventChange={vi.fn()}
        onViewFullProfile={vi.fn()}
      />,
    );

    expect(await screen.findByText(/haven't joined any events/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(REMOVED_MESSAGE)).not.toBeInTheDocument());
  });
});
