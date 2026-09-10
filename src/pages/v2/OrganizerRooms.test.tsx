import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import OrganizerRooms from "./OrganizerRooms";

const mocks = vi.hoisted(() => ({
  user: { id: "user-a", email: "a@example.com" } as { id: string; email: string } | null,
  isOrganizer: true as boolean,
  myRooms: [] as Array<Record<string, unknown>>,
  insert: vi.fn(),
  insertResult: { data: { id: "new-room", name: "Founders Mixer" }, error: null } as {
    data: unknown;
    error: unknown;
  },
  update: vi.fn(),
  updateEq: vi.fn(),
  updateResult: { data: null as unknown, error: null as unknown },
  deleteEq: vi.fn(),
  deleteResult: { error: null as unknown },
  rpc: vi.fn(),
  rpcResult: {
    data: [{ match_count: 0, message_count: 0, meeting_count: 0 }] as unknown,
    error: null as unknown,
  },
}));

vi.mock("@/v2/AuthProvider", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "in"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn(async () =>
      table === "profiles"
        ? { data: { is_organizer: mocks.isOrganizer }, error: null }
        : { data: null, error: null },
    );
    // list query is awaited directly (thenable)
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: table === "events" ? mocks.myRooms : [], error: null }).then(resolve);
    builder.insert = vi.fn((payload: unknown) => {
      mocks.insert(payload);
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => mocks.insertResult),
        })),
      };
    });
    builder.update = vi.fn((payload: unknown) => {
      mocks.update(payload);
      return {
        eq: vi.fn((column: string, value: unknown) => {
          mocks.updateEq(column, value);
          return {
            select: vi.fn(() => ({ single: vi.fn(async () => mocks.updateResult) })),
          };
        }),
      };
    });
    builder.delete = vi.fn(() => ({
      eq: vi.fn((column: string, value: unknown) => {
        mocks.deleteEq(column, value);
        return Promise.resolve(mocks.deleteResult);
      }),
    }));
    return builder;
  };
  return {
    supabase: {
      from: vi.fn((table: string) => makeBuilder(table)),
      rpc: vi.fn((name: string, args: unknown) => {
        mocks.rpc(name, args);
        return Promise.resolve(mocks.rpcResult);
      }),
    },
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/v2/organizer"]}>
      <Routes>
        <Route path="/v2" element={<div>Attendee dashboard</div>} />
        <Route path="/v2/organizer" element={<OrganizerRooms />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.user = { id: "user-a", email: "a@example.com" };
  mocks.isOrganizer = true;
  mocks.myRooms = [];
  mocks.insert.mockReset();
  mocks.insertResult = { data: { id: "new-room", name: "Founders Mixer" }, error: null };
  mocks.update.mockReset();
  mocks.updateEq.mockReset();
  mocks.updateResult = { data: null, error: null };
  mocks.deleteEq.mockReset();
  mocks.deleteResult = { error: null };
  mocks.rpc.mockReset();
  mocks.rpcResult = { data: [{ match_count: 0, message_count: 0, meeting_count: 0 }], error: null };
});

const EVENT_ONE = {
  id: "evt-1",
  name: "Founders Mixer",
  venue: "The Wing",
  location: "Austin, TX",
  date: "2026-10-01",
  end_date: null,
  event_type: "Networking Event",
  is_published: true,
};

afterEach(cleanup);

describe("OrganizerRooms — visibility", () => {
  it("redirects a non-organizer back to the dashboard, no create form", async () => {
    mocks.isOrganizer = false;
    renderPage();
    expect(await screen.findByText("Attendee dashboard")).toBeInTheDocument();
    expect(screen.queryByLabelText(/event name/i)).not.toBeInTheDocument();
  });

  it("shows the create-room form to an organizer", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: /your events/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/event name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/event type/i)).toBeInTheDocument();
  });
});

describe("OrganizerRooms — create", () => {
  it("blocks submit with a blank name and never calls insert", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /your events/i });
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));
    expect(await screen.findByText(/event name is required/i)).toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("inserts with organizer_id set to the signed-in user and the chosen type", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /your events/i });

    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: "Founders Mixer" } });
    fireEvent.change(screen.getByLabelText(/venue/i), { target: { value: "The Wing" } });
    fireEvent.change(screen.getByLabelText(/event type/i), { target: { value: "Conference" } });
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Founders Mixer",
        venue: "The Wing",
        event_type: "Conference",
        organizer_id: "user-a",
        is_published: false,
      }),
    );
    expect(await screen.findByText(/created/i)).toBeInTheDocument();
  });

  it("surfaces an RLS / server rejection", async () => {
    mocks.insertResult = { data: null, error: { message: "new row violates row-level security policy" } };
    renderPage();
    await screen.findByRole("heading", { name: /your events/i });

    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: "Blocked Room" } });
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));

    expect(await screen.findByText(/couldn.t create the event/i)).toBeInTheDocument();
  });

  it("only offers the eight allowed event types", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /your events/i });
    const options = Array.from(
      screen.getByLabelText(/event type/i).querySelectorAll("option"),
    ).map((option) => option.textContent);
    expect(options).toEqual([
      "Conference",
      "Networking Event",
      "Corporate Event",
      "Community Event",
      "Festival",
      "Sports/Industry Event",
      "Concert",
      "Other",
    ]);
  });
});

describe("OrganizerRooms — edit", () => {
  it("pre-fills the form from the row and updates that row via update().eq('id', …)", async () => {
    mocks.myRooms = [EVENT_ONE];
    mocks.updateResult = { data: { ...EVENT_ONE, name: "Founders Mixer 2026" }, error: null };
    renderPage();
    await screen.findByText("Founders Mixer");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("heading", { name: /edit event/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/event name/i)).toHaveValue("Founders Mixer");
    expect(screen.getByLabelText(/venue/i)).toHaveValue("The Wing");
    expect(screen.getByLabelText(/event type/i)).toHaveValue("Networking Event");

    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: "Founders Mixer 2026" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Founders Mixer 2026",
        venue: "The Wing",
        event_type: "Networking Event",
        is_published: true,
      }),
    );
    // organizer_id is never part of an edit payload — ownership can't be reassigned.
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("organizer_id");
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "evt-1");
    expect(await screen.findByText("Founders Mixer 2026")).toBeInTheDocument();
  });

  it("reuses the creation validation on edit — a blank name blocks the update", async () => {
    mocks.myRooms = [EVENT_ONE];
    renderPage();
    await screen.findByText("Founders Mixer");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("heading", { name: /edit event/i });
    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/event name is required/i)).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("OrganizerRooms — hide / unhide", () => {
  it("Hide flips only is_published to false and touches no other column", async () => {
    mocks.myRooms = [EVENT_ONE];
    mocks.updateResult = { data: { ...EVENT_ONE, is_published: false }, error: null };
    renderPage();
    await screen.findByText("Founders Mixer");

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    // Exact match — the entire update payload is { is_published: false }.
    expect(mocks.update).toHaveBeenCalledWith({ is_published: false });
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "evt-1");
    expect(await screen.findByRole("button", { name: "Unhide" })).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
  });

  it("Unhide flips is_published back to true", async () => {
    mocks.myRooms = [{ ...EVENT_ONE, is_published: false }];
    mocks.updateResult = { data: { ...EVENT_ONE, is_published: true }, error: null };
    renderPage();
    await screen.findByText("Founders Mixer");

    fireEvent.click(screen.getByRole("button", { name: "Unhide" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith({ is_published: true });
    expect(await screen.findByRole("button", { name: "Hide" })).toBeInTheDocument();
  });
});

describe("OrganizerRooms — delete", () => {
  it("shows the cascade impact and gates the delete on an exact, case-sensitive name match", async () => {
    mocks.myRooms = [EVENT_ONE];
    mocks.rpcResult = { data: [{ match_count: 42, message_count: 15, meeting_count: 3 }], error: null };
    renderPage();
    await screen.findByText("Founders Mixer");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("event_deletion_impact", { p_event_id: "evt-1" }),
    );
    expect(await screen.findByText(/42 matches/)).toBeInTheDocument();
    expect(screen.getByText(/15 messages/)).toBeInTheDocument();
    expect(screen.getByText(/3 meetings/)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /delete permanently/i });
    expect(confirmButton).toBeDisabled();

    const confirmInput = screen.getByLabelText(/type the event name/i);
    fireEvent.change(confirmInput, { target: { value: "founders mixer" } });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(mocks.deleteEq).not.toHaveBeenCalled();

    fireEvent.change(confirmInput, { target: { value: "Founders Mixer" } });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    await waitFor(() => expect(mocks.deleteEq).toHaveBeenCalledWith("id", "evt-1"));
    await waitFor(() => expect(screen.queryByText("Founders Mixer")).not.toBeInTheDocument());
    expect(screen.getByText(/deleted/i)).toBeInTheDocument();
  });

  it("still requires the typed name when the impact counts fail to load (no silent zero)", async () => {
    mocks.myRooms = [EVENT_ONE];
    mocks.rpcResult = { data: null, error: { message: "not authorized to inspect this event" } };
    renderPage();
    await screen.findByText("Founders Mixer");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/couldn't load/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 matches/)).not.toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: /delete permanently/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type the event name/i), { target: { value: "Founders Mixer" } });
    expect(confirmButton).toBeEnabled();
  });
});
