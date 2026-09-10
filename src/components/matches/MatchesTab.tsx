import { useCallback, useEffect, useState } from "react";
import { MapPin, Loader2, RefreshCw, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendConnectRequest } from "@/lib/connectRequest";
import { selectTopCheckedInMatches } from "@/lib/checkedInMatches";
import { fetchSavedMatchIds, saveMatch, unsaveMatch } from "@/lib/savedMatches";
import { getViewerReciprocityLabel } from "@/lib/matchPresentation";
import { buildMatchTags } from "@/lib/matchTags";
import OffripButton from "@/components/offrip/Button";
import OffripCard from "@/components/offrip/Card";
import OffripChip from "@/components/offrip/Chip";
import ConnectComposer from "@/components/matches/ConnectComposer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface JoinedEvent {
  id: string;
  name: string;
  date: string | null;
}

interface OtherProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
}

interface EnrichedMatch {
  id: string;
  eventId: string;
  score: number;
  confidence: number;
  reciprocityLabel: string | null;
  reason: string | null;
  sharedIndustries: string[];
  sharedInterests: string[];
  other: OtherProfile;
  alreadyConnected: boolean;
}

// Cycled by card position so the Matches grid reads like the Home cards.
const OFFRIP_AVATAR_PALETTE = [
  "bg-offrip-aqua text-offrip-black",
  "bg-offrip-orange text-offrip-white",
  "bg-offrip-lime text-offrip-black",
  "bg-offrip-blue text-offrip-white",
];
const SCORE_CHIP_COLORS = ["aqua", "orange", "lime", "blue"] as const;

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function MatchesTab({
  userId,
  selectedEventId,
  onSelectedEventChange,
  onViewFullProfile,
  onGoHome,
  onExploreRooms,
}: {
  userId: string;
  selectedEventId?: string;
  onSelectedEventChange: (eventId: string | undefined) => void;
  onViewFullProfile: (matchId: string) => void;
  onGoHome?: () => void;
  onExploreRooms?: () => void;
}) {
  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [joinedEvents, setJoinedEvents] = useState<JoinedEvent[]>([]);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [savedMatchIds, setSavedMatchIds] = useState<Set<string>>(new Set());
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSavedMatchIds(userId).then((ids) => {
      if (!cancelled) setSavedMatchIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleSaved = useCallback(async (matchId: string) => {
    const isSaved = savedMatchIds.has(matchId);
    setSavedMatchIds((current) => {
      const next = new Set(current);
      if (isSaved) next.delete(matchId); else next.add(matchId);
      return next;
    });
    const ok = isSaved ? await unsaveMatch(matchId, userId) : await saveMatch(matchId, userId);
    if (!ok) {
      // Revert on failure.
      setSavedMatchIds((current) => {
        const next = new Set(current);
        if (isSaved) next.add(matchId); else next.delete(matchId);
        return next;
      });
      toast.error(isSaved ? "Couldn't remove from saved — try again." : "Couldn't save — try again.");
    }
  }, [savedMatchIds, userId]);

  useEffect(() => {
    let cancelled = false;

    const loadJoinedEvents = async () => {
      const { data: registrations, error: registrationsError } = await supabase
        .from("event_registrations")
        .select("event_id")
        .eq("profile_id", userId)
        .eq("status", "registered");

      if (cancelled) return;
      if (registrationsError) {
        toast.error("Couldn't load your events — try refreshing.");
        setLoading(false);
        return;
      }

      const eventIds = Array.from(
        new Set((registrations ?? []).map((registration) => registration.event_id).filter((id): id is string => Boolean(id))),
      );

      if (eventIds.length === 0) {
        setJoinedEvents([]);
        if (selectedEventId !== undefined) onSelectedEventChange(undefined);
        setMatches([]);
        setLoading(false);
        return;
      }

      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, name, date")
        .in("id", eventIds)
        .order("date", { ascending: true });

      if (cancelled) return;
      if (eventsError) {
        toast.error("Couldn't load your events — try refreshing.");
        setLoading(false);
        return;
      }

      const nextEvents = (events as JoinedEvent[] | null) ?? [];
      setJoinedEvents(nextEvents);
      const nextSelectedEventId = selectedEventId && nextEvents.some((event) => event.id === selectedEventId)
        ? selectedEventId
        : nextEvents[0]?.id;
      if (nextSelectedEventId !== selectedEventId) onSelectedEventChange(nextSelectedEventId);
    };

    loadJoinedEvents();
    return () => {
      cancelled = true;
    };
  }, [onSelectedEventChange, selectedEventId, userId]);

  const loadMatches = useCallback(async () => {
    if (!selectedEventId) return;

    const [{ data: matchRows, error }, { data: checkedInRegistrations, error: checkInError }] = await Promise.all([
      supabase
        .from("matches")
        .select("id, event_id, user_a_id, user_b_id, a_to_b_score, b_to_a_score, a_to_b_confidence, b_to_a_confidence, reciprocity_label, match_reason, shared_industries, shared_interests")
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .eq("event_id", selectedEventId),
      supabase
        .from("matched_event_attendance")
        .select("profile_id")
        .eq("event_id", selectedEventId)
        .eq("is_checked_in", true)
        .not("profile_id", "is", null),
    ]);

    if (error || checkInError) {
      toast.error("Couldn't load matches — try refreshing.");
      setLoading(false);
      return;
    }

    const checkedInProfileIds = new Set(
      (checkedInRegistrations ?? []).map((registration) => registration.profile_id).filter((id): id is string => Boolean(id)),
    );
    const selected = selectTopCheckedInMatches(matchRows ?? [], userId, checkedInProfileIds);
    const rows = selected.rows;
    setEligibleCount(selected.eligibleCount);
    const otherIds = Array.from(
      new Set(rows.map((m) => (m.user_a_id === userId ? m.user_b_id : m.user_a_id)).filter((id): id is string => Boolean(id))),
    );

    const profileMap = new Map<string, OtherProfile>();
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from("attendee_profiles")
        .select("id, full_name, avatar_url, title, company, location")
        .in("id", otherIds);
      for (const p of profiles ?? []) profileMap.set(p.id, p as OtherProfile);
    }

    // Which matches already have a connect message from this user -- so a
    // page refresh shows the real "already sent" state instead of resetting
    // the button to idle. Scoped to message_type "connect_request" only, so
    // it never reflects normal follow-up messages sent from MessageThread.
    const { data: sentConnectMessages } = await supabase
      .from("messages")
      .select("match_id")
      .eq("sender_id", userId)
      .eq("message_type", "connect_request");
    const connectedMatchIds = new Set((sentConnectMessages ?? []).map((row) => row.match_id));

    const enriched: EnrichedMatch[] = rows
      .map((m) => {
        const otherId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
        const other = otherId ? profileMap.get(otherId) : undefined;
        if (!other) return null;
        return {
          id: m.id,
          eventId: m.event_id ?? selectedEventId,
          score: m.viewerScore,
          confidence: m.viewerConfidence,
          reciprocityLabel: getViewerReciprocityLabel(m.reciprocity_label, m.user_a_id === userId),
          reason: m.match_reason,
          sharedIndustries: m.shared_industries ?? [],
          sharedInterests: m.shared_interests ?? [],
          other,
          alreadyConnected: connectedMatchIds.has(m.id),
        };
      })
      .filter((m): m is EnrichedMatch => m !== null);

    setMatches(enriched);
    setLoading(false);
  }, [selectedEventId, userId]);

  useEffect(() => {
    if (!selectedEventId) return;
    setLoading(true);
    loadMatches();
  }, [loadMatches, selectedEventId]);

  const runMatching = async () => {
    if (!selectedEventId) return;
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("match-engine", {
      body: { eventId: selectedEventId },
    });
    setRunning(false);

    if (error) {
      toast.error("Matching engine failed — try again in a moment.");
      return;
    }

    toast.success(`Matching complete — ${data?.matchesSaved ?? 0} new matches found`);
    setLoading(true);
    await loadMatches();
  };

  const refreshRoom = async () => {
    if (!selectedEventId || refreshing) return;
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  };

  const selectedEvent = joinedEvents.find((event) => event.id === selectedEventId) ?? null;

  return (
    <div>
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl">Matches worth knowing</h1>
            <p className="text-sm text-black/40 normal-case font-offrip-body mt-1 max-w-2xl">
              {selectedEvent ? `Matches you should meet at ${selectedEvent.name}` : "Join an event to discover matches you should meet"}
            </p>
          </div>
          {selectedEvent && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setShowSavedOnly((current) => !current)}
                variant={showSavedOnly ? "default" : "outline"}
                size="sm"
              >
                <Bookmark className="h-4 w-4" />
                {showSavedOnly ? "Showing Saved" : "Saved"}
              </Button>
              <Button onClick={refreshRoom} disabled={refreshing || running} variant="outline" size="sm">
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {refreshing ? "Refreshing…" : "Refresh Event"}
              </Button>
              <Button onClick={runMatching} disabled={running || refreshing} variant="secondary" size="sm">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {running ? "Running…" : "Run Matching"}
              </Button>
            </div>
          )}
        </div>
        {joinedEvents.length > 1 && (
          <label className="mt-4 block text-xs font-label">
            Event
            <select
              value={selectedEventId ?? ""}
              onChange={(event) => onSelectedEventChange(event.target.value)}
              className="mt-2 w-full sm:max-w-xs ooo-border bg-card px-3 py-2 normal-case font-sans"
            >
              {joinedEvents.map((event) => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </label>
        )}
        {selectedEvent && (
          <p className="text-xs text-muted-foreground normal-case font-sans mt-3">
            {eligibleCount > 10
              ? `Showing 10 of ${eligibleCount} checked-in matches`
              : `${eligibleCount} checked-in ${eligibleCount === 1 ? "match" : "matches"}`}
          </p>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ooo-border bg-warm p-5 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : (() => {
        const visibleMatches = showSavedOnly ? matches.filter((m) => savedMatchIds.has(m.id)) : matches;
        if (visibleMatches.length === 0) {
          if (showSavedOnly) {
            return (
              <div className="border border-black/10 bg-white p-8 text-center">
                <p className="text-sm text-muted-foreground normal-case font-sans">
                  No saved matches yet — tap the bookmark on a match to save it for later.
                </p>
              </div>
            );
          }
          if (!selectedEvent) {
            return (
              <div className="border border-black/10 bg-white p-8 text-center">
                <p className="text-sm text-muted-foreground normal-case font-sans">
                  You haven't joined any events yet. Join an event to start finding matches.
                </p>
              </div>
            );
          }
          return (
            <div className="border border-black/10 bg-white p-8 text-center">
              <p className="text-sm normal-case font-offrip-body">
                We're still curating your personalized matches. Stay tuned.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {onGoHome && (
                  <Button onClick={onGoHome} variant="outline" size="sm">Back to Home</Button>
                )}
                {onExploreRooms && (
                  <Button onClick={onExploreRooms} variant="secondary" size="sm">Explore Events</Button>
                )}
              </div>
            </div>
          );
        }
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visibleMatches.map((m, index) => (
              <MatchCard
                key={m.id}
                match={m}
                index={index}
                eventName={selectedEvent?.name ?? "this event"}
                onViewFullProfile={onViewFullProfile}
                isSaved={savedMatchIds.has(m.id)}
                onToggleSaved={toggleSaved}
              />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

function MatchCard({
  match,
  index,
  eventName,
  onViewFullProfile,
  isSaved,
  onToggleSaved,
}: {
  match: EnrichedMatch;
  index: number;
  eventName: string;
  onViewFullProfile: (matchId: string) => void;
  isSaved: boolean;
  onToggleSaved: (matchId: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "composing" | "sending" | "sent">(
    match.alreadyConnected ? "sent" : "idle",
  );
  const [reasonOpen, setReasonOpen] = useState(false);
  const { other } = match;
  const name = other.full_name ?? "Member";
  const subtitle = [other.title, other.company].filter(Boolean).join(" · ");
  const tags = buildMatchTags(match.sharedIndustries, match.sharedInterests);
  const avatarClass = OFFRIP_AVATAR_PALETTE[index % OFFRIP_AVATAR_PALETTE.length];
  const scoreColor = SCORE_CHIP_COLORS[index % SCORE_CHIP_COLORS.length];
  const composing = status === "composing" || status === "sending";
  const actionCell =
    "flex items-center justify-center px-2 py-4 text-center font-offrip-display text-[10px] font-black uppercase tracking-widest transition-colors disabled:pointer-events-none";

  const sendConnectMessage = async (rawContent: string) => {
    const content = rawContent.trim();
    if (!content) return;

    setStatus("sending");

    const [{ data: authData }] = await Promise.all([supabase.auth.getUser(), new Promise((r) => setTimeout(r, 1000))]);
    const actingUser = authData?.user;
    if (!actingUser) {
      setStatus("composing");
      toast.error("You must be signed in to connect.");
      return;
    }

    const result = await sendConnectRequest({
      matchId: match.id,
      eventId: match.eventId,
      senderId: actingUser.id,
      recipientId: other.id,
      content,
    });

    if (result.status === "error") {
      setStatus("composing");
      toast.error("Couldn't send the message — try again.");
      return;
    }

    setStatus("sent");
    // "already_sent" (a unique constraint violation under the hood -- e.g.
    // sent from another tab/device) shows the same sent state without a
    // fresh success toast, matching the original behavior.
    if (result.status === "sent") {
      toast.success(`Message sent to ${other.full_name ?? "this member"}`);
    }
  };

  return (
    <OffripCard className="flex flex-col">
      <div className="p-5">
        <div className="border border-offrip-black/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <Avatar className="h-14 w-14 shrink-0 rounded-full border-2 border-offrip-black">
                {other.avatar_url && <AvatarImage src={other.avatar_url} alt={name} />}
                <AvatarFallback className={`rounded-full font-offrip-display text-base font-bold ${avatarClass}`}>
                  {initials(other.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onViewFullProfile(match.id)}
                  className="block max-w-full truncate text-left font-offrip-display text-xl font-bold uppercase leading-tight hover:underline focus-visible:underline focus:outline-none"
                >
                  {name}
                </button>
                {subtitle && (
                  <p className="mt-1.5 font-offrip-body text-sm text-offrip-medium-gray">{subtitle}</p>
                )}
                {other.location && (
                  <p className="mt-1.5 flex items-center gap-1 font-offrip-body text-sm text-offrip-medium-gray">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{other.location}</span>
                  </p>
                )}
              </div>
            </div>
            <OffripChip color={scoreColor}>{match.score}%</OffripChip>
          </div>

          {tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex border border-offrip-black/20 px-2.5 py-1 font-offrip-display text-[10px] font-bold uppercase tracking-wide text-offrip-black"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {composing && (
          <div className="mt-5">
            <ConnectComposer
              defaultMessage={`Hi! Looking forward to connecting at ${eventName}.`}
              sending={status === "sending"}
              onSend={sendConnectMessage}
              onCancel={() => setStatus("idle")}
            />
          </div>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 border-t border-offrip-black/10">
        <button
          type="button"
          onClick={() => onViewFullProfile(match.id)}
          className={`${actionCell} border-b border-r border-offrip-black/10 hover:bg-offrip-black hover:text-offrip-white`}
        >
          View Profile
        </button>
        <button
          type="button"
          onClick={() => setReasonOpen(true)}
          disabled={!match.reason}
          className={`${actionCell} border-b border-offrip-black/10 disabled:opacity-30 hover:bg-offrip-black hover:text-offrip-white`}
        >
          See Why
        </button>
        <button
          type="button"
          onClick={() => setStatus("composing")}
          disabled={status === "sent" || composing}
          className={`${actionCell} border-r border-offrip-black/10 disabled:opacity-40 hover:bg-offrip-black hover:text-offrip-white`}
        >
          {status === "sent" ? "Message Sent" : "Message"}
        </button>
        <button
          type="button"
          onClick={() => onToggleSaved(match.id)}
          aria-pressed={isSaved}
          className={`${actionCell} ${
            isSaved ? "bg-offrip-black text-offrip-white" : "hover:bg-offrip-black hover:text-offrip-white"
          }`}
        >
          <Bookmark className={`mr-1 h-3 w-3 ${isSaved ? "fill-current" : ""}`} />
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent className="border border-offrip-black bg-offrip-white sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="font-offrip-display uppercase tracking-wide">
              Why OFFRIP matched you
            </DialogTitle>
            <DialogDescription className="font-offrip-body text-offrip-medium-gray">
              {[name, subtitle].filter(Boolean).join(" · ")}
            </DialogDescription>
          </DialogHeader>
          <p className="font-offrip-body text-sm leading-relaxed text-offrip-black">{match.reason}</p>
        </DialogContent>
      </Dialog>
    </OffripCard>
  );
}
