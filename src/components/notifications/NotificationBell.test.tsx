import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "./NotificationBell";
import { notificationDestination } from "./notificationNavigation";

const noopNavigate = () => undefined;

const backend = vi.hoisted(() => ({
  notifications: [] as Array<Record<string, unknown>>,
  unread: [] as Array<{ id: string }>,
  profiles: [] as Array<{ id: string; full_name: string | null }>,
  listError: null as { message: string } | null,
  unreadError: null as { message: string } | null,
  holdList: false,
  listCalls: 0,
  unreadCalls: 0,
  profileCalls: 0,
  orderCalls: [] as Array<[string, Record<string, unknown>]>,
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: backend.rpc,
    from: (table: string) => ({
      select: (columns: string) => {
        if (table === "attendee_profiles") {
          return {
            in: async () => {
              backend.profileCalls += 1;
              return { data: backend.profiles, error: null };
            },
          };
        }

        const isUnreadQuery = columns === "id";
        const query = {
          eq: () => query,
          is: () => query,
          order: (column: string, options: Record<string, unknown>) => {
            backend.orderCalls.push([column, options]);
            return query;
          },
          limit: () => {
            if (isUnreadQuery) {
              backend.unreadCalls += 1;
              return Promise.resolve({ data: backend.unread, error: backend.unreadError });
            }
            backend.listCalls += 1;
            if (backend.holdList) return new Promise(() => undefined);
            return Promise.resolve({ data: backend.notifications, error: backend.listError });
          },
        };
        return query;
      },
    }),
  },
}));

vi.mock("@/components/ui/popover", async () => {
  const React = await import("react");
  const PopoverContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void } | null>(null);

  return {
    Popover: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => (
      <PopoverContext.Provider value={{ open, onOpenChange }}>{children}</PopoverContext.Provider>
    ),
    PopoverTrigger: ({ children }: { children: React.ReactElement }) => {
      const context = React.useContext(PopoverContext)!;
      return React.cloneElement(children, { onClick: () => context.onOpenChange(!context.open) } as Record<string, unknown>);
    },
    PopoverContent: ({
      children,
      align: _align,
      sideOffset: _sideOffset,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { align?: string; sideOffset?: number }) => {
      const context = React.useContext(PopoverContext)!;
      return context.open ? <div {...props}>{children}</div> : null;
    },
  };
});

const notification = (overrides: Record<string, unknown>) => ({
  id: "notification-1",
  user_id: "user-1",
  actor_id: "actor-1",
  type: "new_message",
  match_id: "match-1",
  event_id: null,
  meeting_id: null,
  message_id: "message-1",
  created_at: new Date(Date.now() - 60_000).toISOString(),
  read_at: null,
  ...overrides,
});

describe("NotificationBell", () => {
  beforeEach(() => {
    backend.notifications = [];
    backend.unread = [];
    backend.profiles = [];
    backend.listError = null;
    backend.unreadError = null;
    backend.holdList = false;
    backend.listCalls = 0;
    backend.unreadCalls = 0;
    backend.profileCalls = 0;
    backend.orderCalls = [];
    backend.rpc.mockReset();
    backend.rpc.mockResolvedValue({ data: true, error: null });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows an accessible bell and only displays the red dot for unread notifications", async () => {
    const { rerender } = render(<NotificationBell userId="user-1" onNavigate={noopNavigate} />);

    expect(await screen.findByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(document.querySelector(".bg-red-600")).not.toBeInTheDocument();

    backend.unread = [{ id: "notification-1" }];
    rerender(<NotificationBell userId="user-2" onNavigate={noopNavigate} />);

    expect(await screen.findByRole("button", { name: "Notifications, unread activity" })).toBeInTheDocument();
    expect(document.querySelector(".bg-red-600")).toBeInTheDocument();
  });

  it("opens a newest-first list with actor copy, fallback copy, time, and distinct read styling", async () => {
    const now = Date.now();
    backend.notifications = [
      notification({ id: "new", actor_id: "actor-1", type: "meeting_scheduled", created_at: new Date(now - 30_000).toISOString() }),
      notification({ id: "old", actor_id: "missing", type: "new_message", created_at: new Date(now - 120_000).toISOString(), read_at: new Date().toISOString() }),
    ];
    backend.unread = [{ id: "new" }];
    backend.profiles = [{ id: "actor-1", full_name: "Marcus Reed" }];
    render(<NotificationBell userId="user-1" onNavigate={noopNavigate} />);

    const bell = await screen.findByRole("button", { name: "Notifications, unread activity" });
    fireEvent.click(bell);
    const list = await screen.findByLabelText("Notifications list");
    const descriptions = within(list).getAllByText(/confirmed|new message/);

    expect(descriptions[0]).toHaveTextContent("Your meeting with Marcus Reed is confirmed");
    expect(descriptions[1]).toHaveTextContent("You have a new message");
    expect(within(list).getByText("Just now")).toBeInTheDocument();
    expect(within(list).getByText("2m ago")).toBeInTheDocument();
    expect(descriptions[0].parentElement).toHaveClass("border-l-red-600");
    expect(descriptions[1].parentElement).not.toHaveClass("border-l-red-600");
    expect(backend.orderCalls).toContainEqual(["created_at", { ascending: false }]);
    expect(backend.rpc).not.toHaveBeenCalled();
  });

  it("shows loading, empty, and safe error states without marking anything read", async () => {
    backend.holdList = true;
    const loadingView = render(<NotificationBell userId="loading-user" onNavigate={noopNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading notifications");
    loadingView.unmount();

    backend.holdList = false;
    const emptyView = render(<NotificationBell userId="empty-user" onNavigate={noopNavigate} />);
    await waitFor(() => expect(backend.listCalls).toBeGreaterThan(1));
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
    emptyView.unmount();

    backend.listError = { message: "network failure" };
    render(<NotificationBell userId="error-user" onNavigate={noopNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Notifications are unavailable right now");
    expect(backend.rpc).not.toHaveBeenCalled();
  });

  it("refreshes on open, focus, visibility, and polling, then cleans up", async () => {
    vi.useFakeTimers();
    const view = render(<NotificationBell userId="user-1" onNavigate={noopNavigate} />);
    await act(async () => { await vi.runAllTicks(); });
    expect(backend.listCalls).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await act(async () => { await vi.runAllTicks(); });
    expect(backend.listCalls).toBe(2);

    await act(async () => {
      fireEvent.focus(window);
      await vi.runAllTicks();
    });
    expect(backend.listCalls).toBe(3);

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.runAllTicks();
    });
    expect(backend.listCalls).toBe(4);

    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(backend.listCalls).toBe(5);

    view.unmount();
    await act(async () => {
      fireEvent.focus(window);
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(backend.listCalls).toBe(5);
  });

  it.each([
    ["connection_request", { tab: "messages", matchId: "match-1" }],
    ["new_message", { tab: "messages", matchId: "match-1" }],
    ["meeting_requested", { tab: "messages", matchId: "match-1" }],
    ["meeting_accepted", { tab: "messages", matchId: "match-1" }],
    ["meeting_declined", { tab: "messages", matchId: "match-1" }],
    ["meeting_scheduled", { tab: "myday" }],
  ])("maps %s to its V1 destination", (type, expected) => {
    expect(notificationDestination({ type, match_id: "match-1" })).toEqual(expected);
  });

  it("marks only the clicked notification, refreshes the dot, and navigates", async () => {
    backend.notifications = [
      notification({ id: "first", actor_id: "actor-1", type: "new_message", match_id: "match-1" }),
      notification({ id: "second", actor_id: "actor-2", type: "meeting_requested", match_id: "match-2" }),
    ];
    backend.unread = [{ id: "first" }, { id: "second" }];
    backend.profiles = [
      { id: "actor-1", full_name: "Nia Brooks" },
      { id: "actor-2", full_name: "Marcus Reed" },
    ];
    backend.rpc.mockImplementation(async (_name, args: { notification_id: string }) => {
      backend.notifications = backend.notifications.map((row) => (
        row.id === args.notification_id ? { ...row, read_at: new Date().toISOString() } : row
      ));
      backend.unread = backend.unread.filter((row) => row.id !== args.notification_id);
      return { data: true, error: null };
    });
    const onNavigate = vi.fn();
    render(<NotificationBell userId="user-1" onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, unread activity" }));
    fireEvent.click(await screen.findByRole("button", { name: /Nia Brooks sent you a message/ }));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith({ tab: "messages", matchId: "match-1" }));
    expect(backend.rpc).toHaveBeenCalledWith("mark_notification_read", { notification_id: "first" });
    expect(screen.getByRole("button", { name: "Notifications, unread activity" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Notifications, unread activity" }));
    fireEvent.click(await screen.findByRole("button", { name: /Marcus Reed requested a meeting/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument());
    expect(backend.rpc).toHaveBeenLastCalledWith("mark_notification_read", { notification_id: "second" });
  });

  it("keeps a notification unread but still navigates when the read RPC fails", async () => {
    backend.notifications = [notification({ id: "failed", type: "new_message", match_id: "match-1" })];
    backend.unread = [{ id: "failed" }];
    backend.rpc.mockResolvedValue({ data: false, error: { message: "denied" } });
    const onNavigate = vi.fn();
    render(<NotificationBell userId="user-1" onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, unread activity" }));
    fireEvent.click(await screen.findByRole("button", { name: /new message/ }));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith({ tab: "messages", matchId: "match-1" }));
    expect(screen.getByRole("button", { name: "Notifications, unread activity" })).toBeInTheDocument();
  });
});
