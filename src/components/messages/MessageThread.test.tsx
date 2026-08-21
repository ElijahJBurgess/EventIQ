import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessageThread, { ACTIVE_THREAD_REFRESH_INTERVAL_MS } from "./MessageThread";

interface TestMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

const backend = vi.hoisted(() => ({
  messagesByMatch: {} as Record<string, TestMessage[]>,
  messageQueries: [] as string[],
  rpc: vi.fn(async () => ({ data: true, error: null })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        let selectedMatchId = "";
        const query = {
          eq: (_column: string, value: string) => {
            selectedMatchId = value;
            return query;
          },
          order: async () => {
            if (table === "messages") {
              backend.messageQueries.push(selectedMatchId);
              return { data: backend.messagesByMatch[selectedMatchId] ?? [], error: null };
            }
            return { data: [], error: null };
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
        return query;
      },
    }),
    rpc: backend.rpc,
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

const existingMessage: TestMessage = {
  id: "message-1",
  sender_id: "other-1",
  content: "Existing message",
  created_at: "2026-08-21T12:00:00.000Z",
  read_at: "2026-08-21T12:01:00.000Z",
};

function renderThread(matchId = "match-1") {
  return render(
    <MessageThread
      userId="user-1"
      matchId={matchId}
      eventId={null}
      eventName="OFFRIP Room"
      other={{ id: "other-1", full_name: "Morgan Lee", avatar_url: null }}
      onBack={vi.fn()}
      onMessagesRead={vi.fn()}
    />,
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("MessageThread active refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    backend.messagesByMatch = { "match-1": [existingMessage], "match-2": [] };
    backend.messageQueries = [];
    backend.rpc.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("loads existing messages and adds a new incoming message without reopening", async () => {
    const onMessagesRead = vi.fn();
    render(
      <MessageThread
        userId="user-1"
        matchId="match-1"
        eventId={null}
        eventName="OFFRIP Room"
        other={{ id: "other-1", full_name: "Morgan Lee", avatar_url: null }}
        onBack={vi.fn()}
        onMessagesRead={onMessagesRead}
      />,
    );
    await flushEffects();
    expect(screen.getByText("Existing message")).toBeInTheDocument();

    backend.messagesByMatch["match-1"] = [
      existingMessage,
      {
        id: "message-2",
        sender_id: "other-1",
        content: "Arrived while open",
        created_at: "2026-08-21T12:02:00.000Z",
        read_at: null,
      },
    ];

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVE_THREAD_REFRESH_INTERVAL_MS);
    });

    expect(screen.getByText("Arrived while open")).toBeInTheDocument();
    expect(backend.rpc).toHaveBeenLastCalledWith("mark_message_thread_read", { p_match_id: "match-1" });
    expect(onMessagesRead).toHaveBeenCalledTimes(2);
  });

  it("renders refreshed sender messages without treating them as incoming unread", async () => {
    const onMessagesRead = vi.fn();
    render(
      <MessageThread
        userId="user-1"
        matchId="match-1"
        eventId={null}
        eventName="OFFRIP Room"
        other={{ id: "other-1", full_name: "Morgan Lee", avatar_url: null }}
        onBack={vi.fn()}
        onMessagesRead={onMessagesRead}
      />,
    );
    await flushEffects();

    backend.messagesByMatch["match-1"] = [
      existingMessage,
      {
        id: "message-3",
        sender_id: "user-1",
        content: "My message from another session",
        created_at: "2026-08-21T12:03:00.000Z",
        read_at: null,
      },
    ];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVE_THREAD_REFRESH_INTERVAL_MS);
    });

    expect(screen.getByText("My message from another session")).toBeInTheDocument();
    expect(backend.rpc).toHaveBeenCalledTimes(1);
    expect(onMessagesRead).toHaveBeenCalledTimes(1);
  });

  it("refreshes on focus and visibility without duplicating rendered messages", async () => {
    renderThread();
    await flushEffects();

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(backend.messageQueries).toEqual(["match-1", "match-1", "match-1"]);
    expect(screen.getAllByText("Existing message")).toHaveLength(1);
  });

  it("cleans up active-thread polling and listeners on unmount", async () => {
    const view = renderThread();
    await flushEffects();
    expect(backend.messageQueries).toHaveLength(1);

    view.unmount();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(ACTIVE_THREAD_REFRESH_INTERVAL_MS);
    });

    expect(backend.messageQueries).toHaveLength(1);
  });
});
