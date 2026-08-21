import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { notificationDestination, type NotificationDestination } from "./notificationNavigation";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

interface NotificationItem extends NotificationRow {
  actorName: string | null;
}

const POLL_INTERVAL_MS = 45_000;

function notificationDescription(type: string, actorName: string | null) {
  switch (type) {
    case "connection_request":
      return actorName ? `${actorName} sent you a connection request` : "You have a new connection request";
    case "new_message":
      return actorName ? `${actorName} sent you a message` : "You have a new message";
    case "meeting_requested":
      return actorName ? `${actorName} requested a meeting` : "You have a new meeting request";
    case "meeting_accepted":
      return actorName ? `${actorName} accepted your meeting request` : "Your meeting request was accepted";
    case "meeting_scheduled":
      return actorName ? `Your meeting with ${actorName} is confirmed` : "Your meeting is confirmed";
    case "meeting_declined":
      return actorName ? `${actorName} declined your meeting request` : "Your meeting request was declined";
    default:
      return "You have new activity";
  }
}

function relativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Recently";

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000));
  if (elapsedSeconds < 60) return "Just now";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function NotificationBell({
  userId,
  onNavigate,
}: {
  userId: string;
  onNavigate: (destination: NotificationDestination) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);

  const loadNotifications = useCallback(async (showLoading = false) => {
    const requestId = ++requestRef.current;
    if (showLoading && mountedRef.current) setLoading(true);

    const [listResult, unreadResult] = await Promise.all([
      supabase
        .from("notifications")
        .select("id,user_id,actor_id,type,match_id,event_id,meeting_id,message_id,created_at,read_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .is("read_at", null)
        .limit(1),
    ]);

    if (!mountedRef.current || requestId !== requestRef.current) return;
    if (listResult.error || unreadResult.error) {
      setError(true);
      setLoading(false);
      return;
    }

    const rows = (listResult.data ?? []) as NotificationRow[];
    const actorIds = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))];
    const actorNames = new Map<string, string>();

    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("attendee_profiles")
        .select("id,full_name")
        .in("id", actorIds);

      if (!mountedRef.current || requestId !== requestRef.current) return;
      for (const profile of profiles ?? []) {
        if (profile.full_name) actorNames.set(profile.id, profile.full_name);
      }
    }

    setItems(rows.map((row) => ({ ...row, actorName: actorNames.get(row.actor_id) ?? null })));
    setHasUnread((unreadResult.data?.length ?? 0) > 0);
    setError(false);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    setItems([]);
    setHasUnread(false);
    setError(false);
    void loadNotifications(true);

    const refreshWhenFocused = () => { void loadNotifications(); };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadNotifications();
    };
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadNotifications();
    }, POLL_INTERVAL_MS);

    window.addEventListener("focus", refreshWhenFocused);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenFocused);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadNotifications]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) void loadNotifications();
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (openingId) return;
    setOpeningId(item.id);

    try {
      await supabase.rpc("mark_notification_read", { notification_id: item.id });
    } catch {
      // Navigation remains available when marking a notification read fails.
    }

    try {
      await loadNotifications();
    } catch {
      // Keep the current unread state if refresh is temporarily unavailable.
    } finally {
      const destination = notificationDestination(item);
      setOpeningId(null);
      setOpen(false);
      if (destination) onNavigate(destination);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={hasUnread ? "Notifications, unread activity" : "Notifications"}
          className="relative flex h-9 w-9 items-center justify-center border border-black bg-white text-black transition-colors hover:bg-offrip-light-gray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offrip-aqua focus-visible:ring-offset-2"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {hasUnread && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-red-600" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-label="Notifications list"
        className="w-[min(22rem,calc(100vw-2rem))] rounded-none border border-black bg-white p-0 text-black shadow-none"
      >
        <div className="border-b border-black px-4 py-3">
          <h2 className="font-offrip-display text-sm font-bold uppercase tracking-wide">Notifications</h2>
        </div>

        <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center font-offrip-body text-sm text-black/40" role="status">
              Loading notifications…
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center font-offrip-body text-sm text-black/50" role="alert">
              Notifications are unavailable right now.
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center font-offrip-body text-sm text-black/40">
              No notifications yet
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { void handleNotificationClick(item); }}
                disabled={openingId !== null}
                className={`block w-full border-b border-black/10 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-offrip-light-gray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-offrip-aqua disabled:cursor-wait ${item.read_at ? "bg-white" : "border-l-4 border-l-red-600 bg-offrip-light-gray"}`}
              >
                <p className={`normal-case font-offrip-body text-sm leading-snug ${item.read_at ? "text-black/60" : "font-semibold text-black"}`}>
                  {notificationDescription(item.type, item.actorName)}
                </p>
                <time dateTime={item.created_at} className="mt-1 block normal-case font-offrip-body text-[11px] text-black/35">
                  {relativeTime(item.created_at)}
                </time>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
