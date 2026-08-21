import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessagesTab from "./MessagesTab";

const data = vi.hoisted(() => ({
  threadMounts: [] as string[],
  messages: [
    {
      id: "message-2",
      match_id: "match-2",
      event_id: "event-1",
      sender_id: "other-2",
      recipient_id: "user-1",
      content: "Second conversation",
      created_at: "2026-08-19T12:01:00.000Z",
    },
    {
      id: "message-1",
      match_id: "match-1",
      event_id: "event-1",
      sender_id: "other-1",
      recipient_id: "user-1",
      content: "First conversation",
      created_at: "2026-08-19T12:00:00.000Z",
    },
  ],
  profiles: [
    { id: "other-1", full_name: "Nia Brooks", avatar_url: null },
    { id: "other-2", full_name: "Marcus Reed", avatar_url: null },
  ],
  events: [{ id: "event-1", name: "OFFRIP Preview" }],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        if (table === "messages") {
          const query = {
            or: () => query,
            order: async () => ({ data: data.messages, error: null }),
          };
          return query;
        }
        return {
          in: async () => ({ data: table === "attendee_profiles" ? data.profiles : data.events, error: null }),
        };
      },
    }),
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("./MessageThread", async () => {
  const React = await import("react");
  function MockMessageThread({ matchId, onBack }: { matchId: string; onBack: () => void }) {
    React.useEffect(() => {
      data.threadMounts.push(matchId);
    }, [matchId]);
    return (
      <div>
        <span>Open thread: {matchId}</span>
        <button type="button" onClick={onBack}>Back to conversations</button>
      </div>
    );
  }
  return {
    default: MockMessageThread,
  };
});

describe("MessagesTab notification target", () => {
  beforeEach(() => {
    data.messages = [...data.messages];
    data.threadMounts = [];
  });

  afterEach(cleanup);

  it("waits for conversations, opens the exact match, and consumes the target", async () => {
    const onTargetHandled = vi.fn();
    render(
      <MessagesTab
        userId="user-1"
        onMessagesRead={vi.fn()}
        targetMatchId="match-1"
        onTargetHandled={onTargetHandled}
      />,
    );

    expect(await screen.findByText("Open thread: match-1")).toBeInTheDocument();
    expect(onTargetHandled).toHaveBeenCalledWith(true);
  });

  it("falls back safely when the target is missing and preserves normal navigation", async () => {
    const onTargetHandled = vi.fn();
    render(
      <MessagesTab
        userId="user-1"
        onMessagesRead={vi.fn()}
        targetMatchId="missing-match"
        onTargetHandled={onTargetHandled}
      />,
    );

    await waitFor(() => expect(onTargetHandled).toHaveBeenCalledWith(false));
    expect(screen.queryByText(/Open thread:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Marcus Reed/ }));
    expect(await screen.findByText("Open thread: match-2")).toBeInTheDocument();
  });

  it("remounts an already-open thread when a notification targets it", async () => {
    const view = render(
      <MessagesTab userId="user-1" onMessagesRead={vi.fn()} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Nia Brooks/ }));
    await waitFor(() => expect(data.threadMounts).toEqual(["match-1"]));

    view.rerender(
      <MessagesTab
        userId="user-1"
        onMessagesRead={vi.fn()}
        targetMatchId="match-1"
        onTargetHandled={vi.fn()}
      />,
    );

    await waitFor(() => expect(data.threadMounts).toEqual(["match-1", "match-1"]));
  });
});
