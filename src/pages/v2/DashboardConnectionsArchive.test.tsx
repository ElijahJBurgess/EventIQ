import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardV2 from "./Dashboard";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  user: { id: "current-user", email: "me@example.com" },
  connectionNotes: [] as Array<{ match_id: string; note: string; archived: boolean }>,
  upsert: vi.fn(),
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
  const resultFor = (table: string): { data: unknown[]; error: null; count: number } => {
    if (table === "profiles") {
      return { data: [{ id: "current-user", full_name: "Me", email: "me@example.com" }], error: null, count: 0 };
    }
    if (table === "messages") {
      return {
        data: [
          {
            id: "msg-1",
            match_id: "match-1",
            event_id: "evt-1",
            sender_id: "current-user",
            recipient_id: "other-1",
            message_type: "connect_request",
            created_at: "2026-09-01T10:00:00Z",
          },
        ],
        error: null,
        count: 0,
      };
    }
    if (table === "matches") {
      return {
        data: [{ id: "match-1", connection_status: "accepted", connection_requested_by: "current-user" }],
        error: null,
        count: 0,
      };
    }
    if (table === "attendee_profiles") {
      return { data: [{ id: "other-1", full_name: "Riley Other", avatar_url: null }], error: null, count: 0 };
    }
    if (table === "events") return { data: [{ id: "evt-1", name: "Test Event" }], error: null, count: 0 };
    if (table === "connection_notes") return { data: mocks.connectionNotes, error: null, count: 0 };
    // event_registrations, meetings, etc. — empty so HomeTab lands on its empty state fast.
    return { data: [], error: null, count: 0 };
  };

  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "in", "or", "order", "limit", "gte", "not"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn(async () => ({
      data: table === "profiles"
        ? { id: "current-user", full_name: "Me", email: "me@example.com" }
        : null,
      error: null,
    }));
    builder.upsert = vi.fn((row: unknown, opts: unknown) => {
      mocks.upsert(table, row, opts);
      return Promise.resolve({ error: null });
    });
    builder.then = (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) =>
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

async function openConnectionsTab() {
  render(
    <MemoryRouter>
      <DashboardV2 />
    </MemoryRouter>,
  );
  const nav = await screen.findByRole("navigation", { name: "Attendee navigation" });
  fireEvent.click(within(nav).getByRole("button", { name: "Connections" }));
  await screen.findByText("Riley Other");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connectionNotes = [];
});
afterEach(cleanup);

describe("Connections tab — archive / unarchive", () => {
  it("shows an active connection under the Active filter and not under Archived", async () => {
    await openConnectionsTab();

    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "archived" }));
    expect(screen.queryByText("Riley Other")).not.toBeInTheDocument();
    expect(screen.getByText(/no archived connections/i)).toBeInTheDocument();
  });

  it("archiving a connection writes archived:true to connection_notes and moves it out of Active", async () => {
    await openConnectionsTab();

    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() =>
      expect(mocks.upsert).toHaveBeenCalledWith(
        "connection_notes",
        expect.objectContaining({ match_id: "match-1", user_id: "current-user", archived: true }),
        expect.objectContaining({ onConflict: "match_id,user_id" }),
      ),
    );
    // Optimistically removed from the Active list.
    await waitFor(() => expect(screen.queryByText("Riley Other")).not.toBeInTheDocument());

    // ...and now visible under the Archived filter, with an Unarchive action.
    fireEvent.click(screen.getByRole("button", { name: "archived" }));
    expect(await screen.findByText("Riley Other")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unarchive/i })).toBeInTheDocument();
  });

  it("a pre-archived connection loads straight into the Archived view and unarchives back", async () => {
    mocks.connectionNotes = [{ match_id: "match-1", note: "", archived: true }];
    render(
      <MemoryRouter>
        <DashboardV2 />
      </MemoryRouter>,
    );
    const nav = await screen.findByRole("navigation", { name: "Attendee navigation" });
    fireEvent.click(within(nav).getByRole("button", { name: "Connections" }));

    // Not in Active…
    await screen.findByText(/your accepted connections/i);
    expect(screen.queryByText("Riley Other")).not.toBeInTheDocument();

    // …but in Archived.
    fireEvent.click(screen.getByRole("button", { name: "archived" }));
    expect(await screen.findByText("Riley Other")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /unarchive/i }));
    await waitFor(() =>
      expect(mocks.upsert).toHaveBeenCalledWith(
        "connection_notes",
        expect.objectContaining({ match_id: "match-1", archived: false }),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Riley Other")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "active" }));
    expect(await screen.findByText("Riley Other")).toBeInTheDocument();
  });
});
