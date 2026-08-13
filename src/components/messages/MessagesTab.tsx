import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import MessageThread from "./MessageThread";

interface OtherProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Conversation {
  matchId: string;
  eventId: string | null;
  eventName: string | null;
  other: OtherProfile;
  lastContent: string;
  lastCreatedAt: string;
}

const AVATAR_PALETTE = [
  "bg-aqua text-aqua-foreground",
  "bg-citron text-citron-foreground",
  "bg-vermillion text-vermillion-foreground",
  "bg-warm text-warm-foreground",
];

function avatarClasses(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesTab({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [openConversation, setOpenConversation] = useState<Conversation | null>(null);

  const loadConversations = useCallback(async () => {
    const { data: messageRows, error } = await supabase
      .from("messages")
      .select("id, match_id, event_id, sender_id, recipient_id, content, created_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Couldn't load messages — try refreshing.");
      setLoading(false);
      return;
    }

    const rows = messageRows ?? [];
    type Group = { otherId: string; eventId: string | null; lastContent: string; lastCreatedAt: string };
    const groups = new Map<string, Group>();

    for (const m of rows) {
      if (groups.has(m.match_id as string)) continue;
      const otherId = m.sender_id === userId ? m.recipient_id : m.sender_id;
      if (!otherId || !m.match_id) continue;
      // Rows are already ordered newest-first, so the first row seen per
      // match_id is that conversation's most recent message.
      groups.set(m.match_id, {
        otherId,
        eventId: m.event_id,
        lastContent: m.content,
        lastCreatedAt: m.created_at ?? "",
      });
    }

    const matchIds = Array.from(groups.keys());
    const otherIds = Array.from(new Set(Array.from(groups.values()).map((g) => g.otherId)));
    const eventIds = Array.from(
      new Set(Array.from(groups.values()).map((g) => g.eventId).filter((id): id is string => Boolean(id))),
    );

    const [{ data: profiles }, { data: events }] = await Promise.all([
      otherIds.length > 0
        ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", otherIds)
        : Promise.resolve({ data: [] as OtherProfile[] }),
      eventIds.length > 0
        ? supabase.from("events").select("id, name").in("id", eventIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const profileMap = new Map<string, OtherProfile>();
    for (const p of profiles ?? []) profileMap.set(p.id, p as OtherProfile);
    const eventMap = new Map<string, string>();
    for (const event of events ?? []) eventMap.set(event.id, event.name);

    const list: Conversation[] = matchIds
      .map((matchId) => {
        const group = groups.get(matchId)!;
        const other = profileMap.get(group.otherId);
        if (!other) return null;
        return {
          matchId,
          eventId: group.eventId,
          eventName: group.eventId ? (eventMap.get(group.eventId) ?? null) : null,
          other,
          lastContent: group.lastContent,
          lastCreatedAt: group.lastCreatedAt,
        };
      })
      .filter((c): c is Conversation => c !== null)
      .sort((a, b) => (a.lastCreatedAt < b.lastCreatedAt ? 1 : -1));

    setConversations(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  if (openConversation) {
    return (
      <MessageThread
        userId={userId}
        matchId={openConversation.matchId}
        eventId={openConversation.eventId}
        eventName={openConversation.eventName}
        other={openConversation.other}
        onBack={() => {
          setOpenConversation(null);
          loadConversations();
        }}
      />
    );
  }

  return (
    <div>
      <div className="ooo-card bg-card p-6 mb-6">
        <h2 className="text-2xl">Messages</h2>
        <p className="text-sm text-muted-foreground normal-case font-sans mt-1">
          Conversations with your event connections
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ooo-border bg-warm p-4 flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="ooo-border bg-warm p-8 text-center">
          <p className="text-sm text-muted-foreground normal-case font-sans">
            No conversations yet. Connect with a match to start one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((c) => (
            <button
              key={c.matchId}
              onClick={() => setOpenConversation(c)}
              className="w-full text-left ooo-border bg-warm p-4 flex items-center gap-3 hover-lift"
            >
              <Avatar className="h-12 w-12 border-2 border-primary shrink-0">
                {c.other.avatar_url && <AvatarImage src={c.other.avatar_url} alt={c.other.full_name ?? "Profile photo"} />}
                <AvatarFallback className={`font-label text-sm ${avatarClasses(c.other.id)}`}>
                  {initials(c.other.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-bold normal-case font-sans truncate">{c.other.full_name ?? "Member"}</p>
                  <span className="ooo-border bg-card px-2 py-0.5 text-[10px] font-label shrink-0">
                    {c.eventName ?? "General"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground normal-case font-sans truncate mt-0.5">{c.lastContent}</p>
              </div>
              <span className="text-[11px] text-muted-foreground normal-case font-sans shrink-0">
                {formatTimestamp(c.lastCreatedAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
