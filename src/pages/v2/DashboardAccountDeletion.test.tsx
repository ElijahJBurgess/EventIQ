import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardV2 from "./Dashboard";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
  user: { id: "current-user", email: "avery@example.com" },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("@/v2/AuthProvider", () => ({
  useAuth: () => ({ user: mocks.user, signOut: mocks.signOut, deleteAccount: mocks.deleteAccount }),
}));

vi.mock("@/components/notifications/NotificationBell", () => ({
  default: () => <button aria-label="Notifications">Bell</button>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const resultFor = (table: string) => ({
    data: table === "profiles"
      ? [{ id: "current-user", full_name: "Avery Morgan", email: "avery@example.com" }]
      : table === "events"
        ? [{ id: "room-a", name: "Room A", venue: "Hall A", location: "Los Angeles", date: "2099-08-20", end_date: null, is_demo: false }]
        : table === "event_registrations"
          ? [{ event_id: "room-a", is_checked_in: true, checked_in_at: "2099-08-20T09:00:00Z" }]
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
      data: table === "profiles" ? { id: "current-user", full_name: "Avery Morgan", email: "avery@example.com" } : null,
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

async function openAccountMenu() {
  render(
    <MemoryRouter>
      <DashboardV2 />
    </MemoryRouter>,
  );
  const trigger = await screen.findByRole("button", { name: /account menu/i });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  return screen.findByRole("menuitem", { name: /delete account/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteAccount.mockResolvedValue({ error: null });
});
afterEach(cleanup);

describe("Dashboard — account deletion", () => {
  it("puts a Delete Account entry in the account menu", async () => {
    const item = await openAccountMenu();
    expect(item).toBeInTheDocument();
  });

  it("requires an explicit typed confirmation before the destructive action is enabled", async () => {
    const item = await openAccountMenu();
    fireEvent.click(item);

    expect(await screen.findByText(/permanent/i)).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: /delete my account/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type delete/i), { target: { value: "DELETE" } });
    expect(confirmButton).toBeEnabled();
  });

  it("calls deleteAccount and redirects to the auth screen on success", async () => {
    const item = await openAccountMenu();
    fireEvent.click(item);
    fireEvent.change(await screen.findByLabelText(/type delete/i), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/v2/auth", { replace: true }));
  });

  it("keeps the user on the dashboard and shows the reason when deletion is blocked", async () => {
    mocks.deleteAccount.mockResolvedValue({
      error: "You still organize one or more events. Hand those off or delete them before deleting your account.",
      code: "organizer_has_events",
    });
    const item = await openAccountMenu();
    fireEvent.click(item);
    fireEvent.change(await screen.findByLabelText(/type delete/i), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    expect(await screen.findByText(/you still organize one or more events/i)).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalledWith("/v2/auth", { replace: true });
  });
});
