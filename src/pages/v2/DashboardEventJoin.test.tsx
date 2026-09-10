import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardV2 from "./Dashboard";

// Local calendar date (not the UTC date from toISOString) so the fixture event
// lines up with Dashboard's local-midnight "today" in every timezone.
const now = new Date();
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  user: { id: "current-user", email: "avery@example.com" },
  invoke: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  updateEqCalls: [] as Array<[string, unknown]>,
  registrations: [] as Array<Record<string, unknown>>,
  existingRegistration: null as null | { id: string },
  updateResult: { error: null } as { error: unknown },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
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

vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => mocks.toastSuccess(...a), error: (...a: unknown[]) => mocks.toastError(...a) },
}));

vi.mock("@/integrations/supabase/client", () => {
  const resultFor = (table: string) => ({
    data: table === "profiles"
      ? [{ id: "current-user", full_name: "Avery Morgan", email: "avery@example.com" }]
      : table === "events"
        ? [{ id: "room-today", name: "Room Today", venue: "Hall", location: "Los Angeles", date: TODAY, end_date: TODAY, is_demo: false }]
        : table === "event_registrations"
          ? mocks.registrations
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
        : table === "event_registrations"
          ? mocks.existingRegistration
          : null,
      error: null,
    }));
    builder.upsert = vi.fn((row: unknown, opts: unknown) => {
      mocks.upsert(row, opts);
      return Promise.resolve({ error: null });
    });
    builder.update = vi.fn((patch: unknown) => {
      mocks.update(patch);
      const chain: Record<string, unknown> = {
        eq: vi.fn((column: string, value: unknown) => {
          mocks.updateEqCalls.push([column, value]);
          return chain;
        }),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(mocks.updateResult).then(resolve),
      };
      return chain;
    });
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(resultFor(table)).then(resolve, reject);
    return builder;
  };

  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      rpc: vi.fn(async () => ({ data: null, error: null })),
      functions: { invoke: mocks.invoke },
    },
  };
});

async function openRoomsTab() {
  render(
    <MemoryRouter>
      <DashboardV2 />
    </MemoryRouter>,
  );
  const nav = await screen.findByRole("navigation", { name: "Attendee navigation" });
  fireEvent.click(within(nav).getByRole("button", { name: "Events" }));
  return screen.findByText("Room Today");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.invoke.mockResolvedValue({ data: null, error: null });
  mocks.registrations = [];
  mocks.existingRegistration = null;
  mocks.updateResult = { error: null };
  mocks.updateEqCalls = [];
});
afterEach(cleanup);

describe("Dashboard — joining a room checks you in immediately", () => {
  it("writes is_checked_in:true and a real checked_in_at as part of the join insert", async () => {
    await openRoomsTab();

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    const [row] = mocks.upsert.mock.calls[0];
    expect(row).toMatchObject({
      event_id: "room-today",
      profile_id: "current-user",
      registration_type: "attendee",
      status: "registered",
      is_checked_in: true,
    });
    const checkedInAt = (row as { checked_in_at: string }).checked_in_at;
    expect(typeof checkedInAt).toBe("string");
    const parsed = Date.parse(checkedInAt);
    expect(Number.isNaN(parsed)).toBe(false);
    expect(Math.abs(Date.now() - parsed)).toBeLessThan(10_000);
  });

  it("does the check-in in the join insert itself — the separate update path is never touched", async () => {
    await openRoomsTab();

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    // the match-engine call on join is unchanged
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("match-engine", { body: { eventId: "room-today" } }));
    // joining alone checked the user in; no second UPDATE action was needed
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ is_checked_in: true });
  });
});

describe("Dashboard — the manual checkIn stays a harmless no-op", () => {
  it("keeps the is_checked_in=false guard and does not error when the row is already checked in", async () => {
    // Row is joined but locally not-checked-in, so the legacy "Check In" button still renders.
    mocks.registrations = [{ event_id: "room-today", is_checked_in: false }];
    // Server-side the row is already true -> UPDATE ... WHERE is_checked_in = false matches 0 rows;
    // PostgREST returns { error: null }. The action must complete cleanly.
    mocks.updateResult = { error: null };

    await openRoomsTab();
    const button = await screen.findByRole("button", { name: "Check In" });
    fireEvent.click(button);

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const [patch] = mocks.update.mock.calls[0];
    expect(patch).toMatchObject({ is_checked_in: true });
    expect(typeof (patch as { checked_in_at: string }).checked_in_at).toBe("string");
    // the no-op guard is still there
    expect(mocks.updateEqCalls).toContainEqual(["is_checked_in", false]);
    // no error surfaced
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
