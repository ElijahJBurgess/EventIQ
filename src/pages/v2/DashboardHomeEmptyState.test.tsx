import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardV2 from "./Dashboard";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  user: { id: "current-user", email: "avery@example.com" },
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
  // Every table resolves empty (aside from the viewer's own profile). With no
  // checked-in registrations, HomeTab sets stats to null and shows the empty
  // state; EventsTab shows its "no published events" copy under its heading.
  const resultFor = (table: string) => ({
    data: table === "profiles"
      ? [{ id: "current-user", full_name: "Avery Morgan", email: "avery@example.com" }]
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
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("Dashboard Home empty state", () => {
  it("renders a Browse Events button in the 'join an event' box, and nothing in the other box", async () => {
    render(
      <MemoryRouter>
        <DashboardV2 />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Join an event to see what's happening.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse Events" })).toBeInTheDocument();
    expect(screen.getByText("No event happening right now.")).toBeInTheDocument();
  });

  it("switches to the Events tab when Browse Events is clicked (reuses onSeeRooms)", async () => {
    render(
      <MemoryRouter>
        <DashboardV2 />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Browse Events" }));

    // onSeeRooms flips the Dashboard tab to "events".
    expect(await screen.findByRole("heading", { name: /your events/i })).toBeInTheDocument();
    expect(screen.queryByText("Join an event to see what's happening.")).not.toBeInTheDocument();
  });
});
