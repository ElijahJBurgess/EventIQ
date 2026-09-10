import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardV2 from "./Dashboard";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  user: { id: "current-user", email: "avery@example.com" },
  // Checked-in registration exists...
  registrations: [{ event_id: "ev-gone", checked_in_at: "2026-09-01T10:00:00Z" }] as unknown[],
  // ...but the events lookup for it resolves to nothing (deleted / unpublished).
  events: [] as unknown[],
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("@/v2/AuthProvider", () => ({
  useAuth: () => ({ user: mocks.user, signOut: mocks.signOut }),
}));

vi.mock("@/components/notifications/NotificationBell", () => ({
  default: () => <button aria-label="Notifications">Bell</button>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const resultFor = (table: string) => ({
    data:
      table === "profiles"
        ? [{ id: "current-user", full_name: "Avery Morgan", email: "avery@example.com" }]
        : table === "event_registrations"
          ? mocks.registrations
          : table === "events"
            ? mocks.events
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
      data:
        table === "profiles"
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
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.registrations = [{ event_id: "ev-gone", checked_in_at: "2026-09-01T10:00:00Z" }];
  mocks.events = [];
});
afterEach(cleanup);

describe("Dashboard Home — checked-in event removed by its organizer", () => {
  it("shows the removed-by-organizer message, not the generic empty state", async () => {
    render(
      <MemoryRouter>
        <DashboardV2 />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("This event was removed by the organizer. Please join another event."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Join an event to see what's happening.")).not.toBeInTheDocument();
    expect(screen.queryByText("No event happening right now.")).not.toBeInTheDocument();
    // Still offers a way forward.
    expect(screen.getByRole("button", { name: "Browse Events" })).toBeInTheDocument();
  });

  it("falls back to the plain empty state when there are no checked-in registrations at all", async () => {
    mocks.registrations = [];
    render(
      <MemoryRouter>
        <DashboardV2 />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Join an event to see what's happening.")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("This event was removed by the organizer. Please join another event."),
      ).not.toBeInTheDocument(),
    );
  });
});
