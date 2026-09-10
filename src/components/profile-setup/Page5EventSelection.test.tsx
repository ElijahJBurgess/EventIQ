import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Page5EventSelection from "./Page5EventSelection";

const mocks = vi.hoisted(() => ({
  events: [] as Array<{ id: string; name: string; date: string | null }>,
  eventsError: null as unknown,
  upsert: vi.fn(),
  upsertResult: { error: null } as { error: unknown },
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const eventsQuery = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order"]) chain[method] = vi.fn(() => chain);
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: mocks.events, error: mocks.eventsError }).then(resolve);
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => {
        if (table === "events") return eventsQuery();
        return {
          upsert: (row: unknown, opts: unknown) => {
            mocks.upsert(row, opts);
            return Promise.resolve(mocks.upsertResult);
          },
        };
      },
      functions: { invoke: (...args: unknown[]) => mocks.invoke(...args) },
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.events = [
    { id: "evt-1", name: "Founders Mixer", date: "2026-09-20" },
    { id: "evt-2", name: "AI Summit", date: "2026-10-01" },
  ];
  mocks.eventsError = null;
  mocks.upsertResult = { error: null };
  mocks.invoke.mockResolvedValue({ data: null, error: null });
});
afterEach(cleanup);

async function renderPage(onContinue = vi.fn()) {
  render(<Page5EventSelection profileId="user-1" onContinue={onContinue} />);
  await screen.findByText("Founders Mixer");
  return { onContinue };
}

describe("Page5EventSelection — mandatory event pick", () => {
  it("has no skip path — onContinue is unreachable without joining", async () => {
    const { onContinue } = await renderPage();

    expect(screen.queryByRole("button", { name: /skip/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/skip/i)).not.toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("reaches onContinue only by actually joining an event", async () => {
    const { onContinue } = await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Founders Mixer/ }));

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("match-engine", { body: { eventId: "evt-1" } }));
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
  });

  it("checks the user in as part of the join insert — is_checked_in true with a real timestamp", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /AI Summit/ }));

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    const [row] = mocks.upsert.mock.calls[0];
    expect(row).toMatchObject({
      event_id: "evt-2",
      profile_id: "user-1",
      registration_type: "attendee",
      status: "registered",
      is_checked_in: true,
    });
    const checkedInAt = (row as { checked_in_at: string }).checked_in_at;
    expect(typeof checkedInAt).toBe("string");
    expect(Number.isNaN(Date.parse(checkedInAt))).toBe(false);
    expect(Math.abs(Date.now() - Date.parse(checkedInAt))).toBeLessThan(10_000);
  });

  it("does not call onContinue when the join insert fails", async () => {
    mocks.upsertResult = { error: { message: "row-level security" } };
    const { onContinue } = await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Founders Mixer/ }));

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/couldn't join this event/i)).toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
