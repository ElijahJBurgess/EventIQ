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

  const conversationList = loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-b border-black/10 p-4 flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground normal-case font-sans">
            No conversations yet. Connect with a match to start one.
          </p>
        </div>
      ) : (
        <div>
          {conversations.map((c) => (
            <button
              key={c.matchId}
              onClick={() => setOpenConversation(c)}
              className={`w-full text-left border-b border-black/10 p-4 flex items-start gap-3 transition-colors ${openConversation?.matchId === c.matchId ? "bg-black text-white" : "hover:bg-offrip-light-gray"}`}
            >
              <Avatar className="h-12 w-12 border-2 border-primary shrink-0">
                {c.other.avatar_url && <AvatarImage src={c.other.avatar_url} alt={c.other.full_name ?? "Profile photo"} />}
                <AvatarFallback className={`font-label text-sm ${avatarClasses(c.other.id)}`}>
                  {initials(c.other.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xs truncate">{c.other.full_name ?? "Member"}</p>
                <p className={`text-[11px] normal-case font-offrip-body truncate mt-1 ${openConversation?.matchId === c.matchId ? "text-white/60" : "text-black/40"}`}>{c.lastContent}</p>
              </div>
              <span className={`text-[10px] normal-case font-offrip-body shrink-0 ${openConversation?.matchId === c.matchId ? "text-white/50" : "text-black/30"}`}>
                {formatTimestamp(c.lastCreatedAt)}
              </span>
            </button>
          ))}
        </div>
      );

  return (
    <div className="-mx-6 -my-8 flex h-[calc(100vh-56px)] min-h-[520px] border-x border-black/10">
      <aside className={`${openConversation ? "hidden md:flex" : "flex"} w-full md:w-72 shrink-0 flex-col border-r border-black`}>
        <div className="border-b border-black p-4">
          <h1 className="font-display text-sm">Keep it going.</h1>
          <p className="mt-1 text-xs text-black/40 normal-case font-offrip-body">The intro happened. Don't let the conversation die here.</p>
        </div>
        <div className="flex-1 overflow-y-auto">{conversationList}</div>
      </aside>
      <section className={`${openConversation ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {openConversation ? (
          <MessageThread
            embedded
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
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-black/30 normal-case font-offrip-body">Choose a conversation to keep it going.</div>
        )}
      </section>
    </div>
  );
}
