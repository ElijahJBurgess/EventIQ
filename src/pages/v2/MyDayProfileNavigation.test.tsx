import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyDayTab } from "./Dashboard";

const mocks = vi.hoisted(() => ({
  meetingsSelect: vi.fn(),
  meetings: [
    {
      id: "meeting-requester",
      match_id: "match-alice",
      status: "scheduled",
      scheduled_at: "2026-08-20T17:00:00.000Z",
      location_note: "Lobby",
      duration_minutes: 30,
      requester_id: "current-user",
      recipient_id: "alice-id",
      event_id: "event-id",
    },
    {
      id: "meeting-recipient",
      match_id: "match-bob",
      status: "accepted",
      scheduled_at: null,
      location_note: null,
      duration_minutes: 30,
      requester_id: "bob-id",
      recipient_id: "current-user",
      event_id: "event-id",
    },
  ],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "meetings") {
        const builder = {
          select: mocks.meetingsSelect,
          or: vi.fn(),
          in: vi.fn(),
          order: vi.fn(),
        };
        mocks.meetingsSelect.mockReturnValue(builder);
        builder.or.mockReturnValue(builder);
        builder.in.mockReturnValue(builder);
        builder.order.mockResolvedValue({ data: mocks.meetings });
        return builder;
      }

      if (table === "profiles") {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { id: "alice-id", full_name: "Alice Rivera" },
                { id: "bob-id", full_name: "Bob Chen" },
              ],
            }),
          }),
        };
      }

      return {
        select: () => ({
          in: () => Promise.resolve({ data: [{ id: "event-id", name: "OFFRIP Preview" }] }),
        }),
      };
    },
  },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("My Day profile navigation", () => {
  it("loads match_id and opens the correct profile from either participant side", async () => {
    const onViewFullProfile = vi.fn();
    render(<MyDayTab userId="current-user" onBack={vi.fn()} onViewFullProfile={onViewFullProfile} />);

    const aliceCard = await screen.findByRole("button", { name: /Alice Rivera/i });
    const bobCard = await screen.findByRole("button", { name: /Bob Chen/i });

    expect(mocks.meetingsSelect).toHaveBeenCalledWith(expect.stringContaining("match_id"));
    expect(aliceCard.tagName).toBe("BUTTON");
    expect(bobCard.tagName).toBe("BUTTON");
    expect(aliceCard).toHaveTextContent("View profile →");

    fireEvent.click(aliceCard);
    expect(onViewFullProfile).toHaveBeenLastCalledWith("match-alice");

    fireEvent.click(bobCard);
    expect(onViewFullProfile).toHaveBeenLastCalledWith("match-bob");
  });
});
