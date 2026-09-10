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
    return builder;
  };
  return { supabase: { from: vi.fn((table: string) => makeBuilder(table)) } };
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
});

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
