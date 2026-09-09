import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/v2/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FullProfileView from "@/components/matches/FullProfileView";
import ConciergeTab from "@/components/concierge/ConciergeTab";
import { useConciergeSession } from "@/components/concierge/useConciergeSession";
import MatchesTab from "@/components/matches/MatchesTab";
import MessagesTab from "@/components/messages/MessagesTab";
import MessageThread from "@/components/messages/MessageThread";
import ConnectionSelfReportPrompt from "@/components/connections/ConnectionSelfReportPrompt";
import NotificationBell from "@/components/notifications/NotificationBell";
import type { NotificationDestination } from "@/components/notifications/notificationNavigation";
import OffripButton from "@/components/offrip/Button";
import OffripCard from "@/components/offrip/Card";
import OffripChip from "@/components/offrip/Chip";
import EditProfileScreen from "@/components/profile/EditProfileScreen";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { buildConnectionSummary } from "@/lib/connectionSummary";
import { getViewerMatchMetrics } from "@/lib/checkedInMatches";
import { selectHomeStatsEvent } from "@/lib/homeStatsEvent";
import { buildEventCardSubtitle } from "@/lib/eventCardSubtitle";
import { companyColleagueNames, formatCompanyInRoom, dontLeaveWithoutMeetingHeading } from "@/lib/homeCopy";
import { getMatchBand } from "@/lib/matchPresentation";

type Tab = "home" | "profile" | "events" | "matches" | "concierge" | "connections" | "messages" | "myday";
type NavItem = Exclude<Tab, "profile" | "myday"> | "enterprise";

const NAV_ITEMS: NavItem[] = ["home", "events", "matches", "concierge", "connections", "messages"];

const NAV_LABELS: Record<NavItem, string> = {
  home: "Home",
  events: "Rooms",
  matches: "People",
  concierge: "Concierge",
  connections: "Connections",
  messages: "Messages",
  enterprise: "Enterprise",
};

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
  title?: string | null;
  role_type?: string | null;
  company?: string | null;
}

interface HomeStatsData {
  eventId: string;
  eventName: string;
  eventVenue: string | null;
  eventLocation: string | null;
  eventDate: string;
  eventEndDate: string | null;
  registrations: number;
  strongMatches: number;
  pendingRequests: number;
  unreadMessages: number;
  topMatches: HomeMatch[];
  connectionsInMotion: HomeConnection[];
  companyColleagues: string[];
}

interface HomeMeeting {
  id: string;
  matchId: string;
  otherId: string;
  otherName: string;
  otherAvatarUrl: string | null;
  otherRole: string;
  otherCompany: string | null;
  scheduledAt: string;
  location: string | null;
}

interface HomeMatch {
  id: string;
  otherId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  company: string | null;
  score: number;
  reason: string | null;
}

interface HomeConnection {
  id: string;
  otherId: string;
  otherName: string;
  otherAvatarUrl: string | null;
  status: "requested" | "accepted" | "scheduled";
  isRequester: boolean;
}

const OFFRIP_AVATAR_PALETTE = [
  "bg-offrip-aqua text-offrip-black",
  "bg-offrip-lime text-offrip-black",
  "bg-offrip-orange text-offrip-white",
  "bg-offrip-blue text-offrip-white",
];

function offripAvatarClasses(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return OFFRIP_AVATAR_PALETTE[hash % OFFRIP_AVATAR_PALETTE.length];
}

function profileInitials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function DashboardV2() {
  const { user, signOut, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("home");
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [notificationMatchId, setNotificationMatchId] = useState<string | null>(null);
  const conciergeSession = useConciergeSession({ selectedEventId });
  const [editingFullProfile, setEditingFullProfile] = useState(false);
  // Set from either Home or Matches; whichever tab was active when this was
  // set is exactly the tab the user lands back on, since `tab` itself is
  // never changed to open Full Profile View -- only overlaid on top of it.
  const [viewingMatchId, setViewingMatchId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selectNavigationItem = (item: NavItem) => {
    setViewingMatchId(null);
    setNotificationMatchId(null);
    if (item === "enterprise") {
      navigate("/v2/admin");
      return;
    }
    setTab(item);
  };

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("id,full_name").eq("id", user.id).maybeSingle();
    setProfile(data as Profile | null);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const refreshUnreadMessages = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("id")
      .eq("recipient_id", user.id)
      .is("read_at", null)
      .limit(1);
    setHasUnreadMessages((data?.length ?? 0) > 0);
  }, [user]);

  useEffect(() => { refreshUnreadMessages(); }, [refreshUnreadMessages]);

  const handleNotificationNavigation = useCallback((destination: NotificationDestination) => {
    setViewingMatchId(null);
    if (destination.tab === "messages") {
      setNotificationMatchId(destination.matchId);
      setTab("messages");
      return;
    }

    setNotificationMatchId(null);
    setTab("myday");
  }, []);

  const handleNotificationTarget = useCallback(() => {
    setNotificationMatchId(null);
  }, []);

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteError(null);
    const { error } = await deleteAccount();
    if (error) {
      setDeleteError(error);
      setDeletingAccount(false);
      return;
    }
    // The auth session is already gone; land on the sign-in screen.
    navigate("/v2/auth", { replace: true });
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center font-label text-xl">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-black sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-10">
          <button onClick={() => selectNavigationItem("home")} className="font-display text-xl tracking-tight leading-none normal-case shrink-0">OFFRIP</button>
          <nav aria-label="Attendee navigation" className="hidden lg:flex items-center gap-6 flex-1">
            {NAV_ITEMS.map((t) => (
              <button
                key={t}
                onClick={() => selectNavigationItem(t)}
                className={`relative text-[11px] tracking-widest transition-colors ${tab === t ? "text-black border-b-2 border-black pb-0.5" : "text-black/40 hover:text-black"}`}
              >
                {NAV_LABELS[t]}
                {t === "messages" && hasUnreadMessages && (
                  <span className="absolute -top-1 -right-2 h-2 w-2 rounded-full bg-offrip-orange" aria-label="Unread messages" />
                )}
              </button>
            ))}
          </nav>
          <button onClick={() => selectNavigationItem("enterprise")} className="hidden lg:flex text-[10px] tracking-widest border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors">
            Enterprise
          </button>
          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            <NotificationBell userId={user!.id} onNavigate={handleNotificationNavigation} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-11 w-11 items-center justify-center rounded-full" aria-label="Open account menu">
                  <Avatar className="h-8 w-8 rounded-full border-2 border-black">
                    <AvatarFallback className={`rounded-full font-label text-xs ${offripAvatarClasses(user!.id)}`}>
                      {profileInitials(profile?.full_name ?? null)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border border-black bg-white rounded-sm">
                <DropdownMenuItem
                  onSelect={() => {
                    setTab("profile");
                    setEditingFullProfile(true);
                  }}
                >
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem disabled>Privacy Policy</DropdownMenuItem>
                <DropdownMenuItem onSelect={async () => { await signOut(); navigate("/v2/auth"); }}>
                  Sign Out
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-offrip-orange focus:text-offrip-orange"
                  onSelect={() => {
                    setDeleteConfirmText("");
                    setDeleteError(null);
                    setDeleteDialogOpen(true);
                  }}
                >
                  Delete Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (!deletingAccount) setDeleteDialogOpen(open);
          }}
        >
          <AlertDialogContent className="border border-black rounded-sm bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display uppercase tracking-wide">
                Delete your account?
              </AlertDialogTitle>
              <AlertDialogDescription className="normal-case font-offrip-body text-black/70">
                This is <strong className="text-black">permanent and cannot be undone</strong>. Your
                profile, matches, messages, meetings and feedback are removed. Conversation threads
                you shared with other people disappear from their inboxes too.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <label
                htmlFor="delete-confirm"
                className="block text-[11px] tracking-widest uppercase text-black/60"
              >
                Type DELETE to confirm
              </label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                className="rounded-none border-black"
              />
              {deleteError && (
                <p className="text-sm text-offrip-orange normal-case font-offrip-body">{deleteError}</p>
              )}
            </div>
            <AlertDialogFooter>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deletingAccount}
                className="px-4 py-2 text-[11px] tracking-widest uppercase border border-black bg-white transition-colors hover:bg-black hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deletingAccount}
                className="px-4 py-2 text-[11px] tracking-widest uppercase border border-offrip-orange bg-offrip-orange text-white transition-colors hover:border-black hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingAccount ? "Deleting…" : "Delete my account"}
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <nav aria-label="Mobile attendee navigation" className="lg:hidden flex overflow-x-auto border-t border-black">
          {NAV_ITEMS.map((t) => (
            <button key={t} onClick={() => selectNavigationItem(t)} className={`relative flex min-h-11 shrink-0 items-center px-4 py-2.5 text-[10px] tracking-widest ${tab === t ? "bg-black text-white" : "text-black/40"}`}>
              {NAV_LABELS[t]}
              {t === "messages" && hasUnreadMessages && (
                <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-vermillion border border-primary" aria-label="Unread messages" />
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {viewingMatchId ? (
          <FullProfileView
            matchId={viewingMatchId}
            currentUserId={user!.id}
            onBack={() => setViewingMatchId(null)}
            backLabel={tab === "myday" ? "Back to My Day" : tab === "concierge" ? "Back to Concierge" : undefined}
          />
        ) : (
          <>
            {tab === "home" && (
              <HomeTab
                profile={profile}
                userId={user!.id}
                onSeeRoom={(eventId) => { setSelectedEventId(eventId); setTab("matches"); }}
                onSeeRooms={() => setTab("events")}
                onSeeDay={() => setTab("myday")}
                onSeeMessages={() => setTab("messages")}
                onSeeConnections={() => setTab("connections")}
                onViewFullProfile={setViewingMatchId}
              />
            )}
            {tab === "profile" && editingFullProfile && (
              <EditProfileScreen
                userId={user!.id}
                onClose={() => {
                  setEditingFullProfile(false);
                  setTab("home");
                }}
                onSaved={loadProfile}
              />
            )}
            {tab === "events" && <EventsTab userId={user!.id} onViewMatches={(eventId) => { setSelectedEventId(eventId); setTab("matches"); }} />}
            {tab === "matches" && (
              <MatchesTab
                userId={user!.id}
                selectedEventId={selectedEventId}
                onSelectedEventChange={setSelectedEventId}
                onViewFullProfile={setViewingMatchId}
                onGoHome={() => setTab("home")}
                onExploreRooms={() => setTab("events")}
              />
            )}
            {tab === "concierge" && (
              <ConciergeTab
                messages={conciergeSession.messages}
                draft={conciergeSession.draft}
                onDraftChange={conciergeSession.setDraft}
                selectedEventId={selectedEventId}
                loading={conciergeSession.loading}
                inlineError={conciergeSession.inlineError}
                onSubmit={conciergeSession.submit}
                onRetry={conciergeSession.retry}
                onViewProfile={setViewingMatchId}
                onViewMyDay={() => setTab("myday")}
              />
            )}
            {tab === "connections" && (
              <ConnectionsTab userId={user!.id} onViewFullProfile={setViewingMatchId} onMessagesRead={refreshUnreadMessages} />
            )}
            {tab === "messages" && (
              <MessagesTab
                userId={user!.id}
                onMessagesRead={refreshUnreadMessages}
                targetMatchId={notificationMatchId}
                onTargetHandled={handleNotificationTarget}
                onViewFullProfile={setViewingMatchId}
              />
            )}
            {tab === "myday" && <MyDayTab userId={user!.id} onBack={() => setTab("home")} onViewFullProfile={setViewingMatchId} />}
          </>
        )}
      </main>
      {user && <ConnectionSelfReportPrompt userId={user.id} />}
    </div>
  );
}

function HomeTab({
  profile,
  userId,
  onSeeRoom,
  onSeeRooms,
  onSeeDay,
  onSeeMessages,
  onSeeConnections,
  onViewFullProfile,
}: {
  profile: Profile | null;
  userId: string;
  onSeeRoom: (eventId?: string) => void;
  onSeeRooms: () => void;
  onSeeDay: () => void;
  onSeeMessages: () => void;
  onSeeConnections: () => void;
  onViewFullProfile: (matchId: string) => void;
}) {
  const [stats, setStats] = useState<HomeStatsData | null | undefined>(undefined);
  const [homeMeetings, setHomeMeetings] = useState<HomeMeeting[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const loadMeetings = async () => {
      const { data: meetingRows, error } = await supabase
        .from("meetings")
        .select("id,match_id,requester_id,recipient_id,scheduled_at,location_note")
        .eq("status", "scheduled")
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
        .not("scheduled_at", "is", null)
        .order("scheduled_at", { ascending: true });

      if (error) {
        toast.error("Couldn't load your meetings — try refreshing.");
        if (!cancelled) setHomeMeetings([]);
        return;
      }

      const rows = meetingRows ?? [];
      const otherIds = Array.from(new Set(
        rows.map((meeting) => meeting.requester_id === userId ? meeting.recipient_id : meeting.requester_id).filter(Boolean),
      ));
      const { data: meetingProfiles } = otherIds.length > 0
        ? await supabase
          .from("attendee_profiles")
          .select("id,full_name,title,role_type,company,avatar_url")
          .in("id", otherIds)
        : { data: [] as Pick<Profile, "id" | "full_name" | "title" | "role_type" | "company" | "avatar_url">[] };
      const profileById = new Map((meetingProfiles ?? []).map((meetingProfile) => [meetingProfile.id, meetingProfile]));
      const scheduledMeetings: HomeMeeting[] = rows
        .map((meeting) => {
          if (!meeting.scheduled_at || !meeting.match_id) return null;
          const otherId = meeting.requester_id === userId ? meeting.recipient_id : meeting.requester_id;
          const other = profileById.get(otherId);
          if (!other) return null;
          return {
            id: meeting.id,
            matchId: meeting.match_id,
            otherId: other.id,
            otherName: other.full_name ?? "OFFRIP member",
            otherAvatarUrl: other.avatar_url,
            otherRole: other.title ?? other.role_type ?? "Member",
            otherCompany: other.company,
            scheduledAt: meeting.scheduled_at,
            location: meeting.location_note,
          };
        })
        .filter((meeting): meeting is HomeMeeting => meeting !== null);

      if (!cancelled) setHomeMeetings(scheduledMeetings);
    };

    loadMeetings();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      const { data: registrations, error: registrationError } = await supabase
        .from("event_registrations")
        .select("event_id,checked_in_at")
        .eq("profile_id", userId)
        .eq("is_checked_in", true)
        .order("checked_in_at", { ascending: false });

      if (registrationError) {
        toast.error("Couldn't load your event activity — try refreshing.");
        if (!cancelled) setStats(null);
        return;
      }

      const eventIds = (registrations ?? [])
        .map((registration) => registration.event_id)
        .filter((eventId): eventId is string => Boolean(eventId));

      if (eventIds.length === 0) {
        if (!cancelled) setStats(null);
        return;
      }

      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id,name,venue,location,date,end_date")
        .in("id", eventIds)
        .eq("is_published", true);

      if (eventsError) {
        toast.error("Couldn't load your event activity — try refreshing.");
        if (!cancelled) setStats(null);
        return;
      }

      // The event to source Home stats from: the one live today if the user is
      // checked into one, otherwise the event they most recently checked into
      // (eventIds is ordered by checked_in_at desc) so Home doesn't go blank
      // between events.
      const activeEvent = selectHomeStatsEvent(events ?? [], eventIds, new Date());

      if (!activeEvent) {
        if (!cancelled) setStats(null);
        return;
      }

      // "Your company is in the room": other checked-in attendees at this event
      // whose company matches the viewer's own. Skipped when the viewer has no
      // company set. The RPC already filters by company; the client re-filters
      // as a backstop. Cast because home_company_colleagues isn't in the
      // generated types.ts yet (known drift — see README).
      const ownCompany = profile?.company ?? "";
      type CompanyColleagueRow = { full_name: string | null; company: string | null };
      const colleagueRows: CompanyColleagueRow[] = ownCompany.trim()
        ? (((await supabase.rpc("home_company_colleagues" as never, { p_event_id: activeEvent.id } as never)).data as
            | CompanyColleagueRow[]
            | null) ?? [])
        : [];
      const companyColleagues = companyColleagueNames(ownCompany, colleagueRows);

      const [registrationResult, scoredMatchResult, incomingResult, unreadResult, connectionResult] = await Promise.all([
        supabase.rpc("get_event_attendance_counts", { p_event_id: activeEvent.id }),
        supabase
          .from("matches")
          .select("id,user_a_id,user_b_id,a_to_b_score,b_to_a_score,a_to_b_confidence,b_to_a_confidence,match_reason")
          .eq("event_id", activeEvent.id)
          .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),
        supabase
          .from("messages")
          .select("match_id,created_at")
          .eq("event_id", activeEvent.id)
          .eq("recipient_id", userId)
          .eq("message_type", "connect_request"),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("event_id", activeEvent.id)
          .eq("recipient_id", userId)
          .is("read_at", null),
        supabase
          .from("meetings")
          .select("id,requester_id,recipient_id,status,requested_at")
          .eq("event_id", activeEvent.id)
          .in("status", ["requested", "accepted", "scheduled"])
          .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
          .order("requested_at", { ascending: false }),
      ]);

      const requestMatchIds = (incomingResult.data ?? [])
        .map((request) => request.match_id)
        .filter((matchId): matchId is string => Boolean(matchId));
      const { data: sentReplies } = requestMatchIds.length > 0
        ? await supabase
          .from("messages")
          .select("match_id,created_at")
          .eq("event_id", activeEvent.id)
          .eq("sender_id", userId)
          .in("match_id", requestMatchIds)
        : { data: [] as { match_id: string | null; created_at: string | null }[] };

      const pendingRequests = new Set(
        (incomingResult.data ?? [])
          .filter((request) => !sentReplies?.some((reply) => (
            reply.match_id === request.match_id
            && (reply.created_at ?? "") > (request.created_at ?? "")
          )))
          .map((request) => request.match_id)
          .filter((matchId): matchId is string => Boolean(matchId)),
      ).size;

      const viewerScoredMatches = (scoredMatchResult.data ?? [])
        .flatMap((match) => {
          const metrics = getViewerMatchMetrics(match, userId);
          if (!metrics || metrics.score === null) return [];
          const otherId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
          if (!otherId) return [];
          return [{ ...match, otherId, viewerScore: metrics.score }];
        })
        .sort((a, b) => b.viewerScore - a.viewerScore);

      const strongMatchCount = viewerScoredMatches.filter((match) => match.viewerScore >= 75).length;

      const topMatchRows = viewerScoredMatches.slice(0, 5);
      const topMatchProfileIds = topMatchRows.map((match) => match.otherId);
      const { data: topMatchProfiles } = topMatchProfileIds.length > 0
        ? await supabase
          .from("attendee_profiles")
          .select("id,full_name,title,role_type,company,avatar_url")
          .in("id", topMatchProfileIds)
        : { data: [] as Pick<Profile, "id" | "full_name" | "title" | "role_type" | "company" | "avatar_url">[] };
      const topMatchProfileById = new Map((topMatchProfiles ?? []).map((matchProfile) => [matchProfile.id, matchProfile]));
      const topMatches: HomeMatch[] = topMatchRows
        .map((match) => {
          const other = topMatchProfileById.get(match.otherId);
          if (!other) return null;
          return {
            id: match.id,
            otherId: other.id,
            name: other.full_name ?? "OFFRIP member",
            avatarUrl: other.avatar_url,
            role: other.title ?? other.role_type ?? "Member",
            company: other.company,
            score: match.viewerScore,
            reason: match.match_reason,
          };
        })
        .filter((match): match is HomeMatch => match !== null);

      const connectionRows = connectionResult.data ?? [];
      const connectionProfileIds = Array.from(new Set(
        connectionRows
          .map((connection) => connection.requester_id === userId ? connection.recipient_id : connection.requester_id)
          .filter(Boolean),
      ));
      const { data: connectionProfiles } = connectionProfileIds.length > 0
        ? await supabase
          .from("attendee_profiles")
          .select("id,full_name,avatar_url")
          .in("id", connectionProfileIds)
        : { data: [] as Pick<Profile, "id" | "full_name" | "avatar_url">[] };
      const connectionProfileById = new Map((connectionProfiles ?? []).map((connectionProfile) => [connectionProfile.id, connectionProfile]));
      const connectionsInMotion: HomeConnection[] = connectionRows
        .map((connection) => {
          if (!(["requested", "accepted", "scheduled"] as string[]).includes(connection.status)) return null;
          const otherId = connection.requester_id === userId ? connection.recipient_id : connection.requester_id;
          const other = connectionProfileById.get(otherId);
          if (!other) return null;
          return {
            id: connection.id,
            otherId: other.id,
            otherName: other.full_name ?? "OFFRIP member",
            otherAvatarUrl: other.avatar_url,
            status: connection.status as HomeConnection["status"],
            isRequester: connection.requester_id === userId,
          };
        })
        .filter((connection): connection is HomeConnection => connection !== null);

      if (!cancelled) {
        setStats({
          eventId: activeEvent.id,
          eventName: activeEvent.name,
          eventVenue: activeEvent.venue,
          eventLocation: activeEvent.location,
          eventDate: activeEvent.date,
          eventEndDate: activeEvent.end_date,
          registrations: Number(registrationResult.data?.[0]?.registered_count ?? 0),
          strongMatches: strongMatchCount,
          pendingRequests,
          unreadMessages: unreadResult.count ?? 0,
          topMatches,
          connectionsInMotion,
          companyColleagues,
        });
      }
    };

    loadStats();
    return () => { cancelled = true; };
  }, [userId, profile?.company]);

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "there";
  const formatEventDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formatMeetingTime = (date: string) => new Date(date).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  // Must stay in sync with the shared band logic in scorer.ts's scoreLabel —
  // this calls the same client-side helper MatchesTab/FullProfileView use so
  // the band never drifts out of sync across screens again.
  const matchLabel = (score: number) => getMatchBand(score).text;
  const connectionLabel = (connection: HomeConnection) => {
    if (connection.status === "requested") return connection.isRequester ? "Awaiting Response" : "Meeting Requested";
    if (connection.status === "accepted") return "Meeting Accepted";
    return "Meeting Scheduled";
  };
  const matchColors = ["aqua", "lime", "orange", "blue"] as const;
  const matchAccentClasses = [
    "border-t-offrip-aqua",
    "border-t-offrip-lime",
    "border-t-offrip-orange",
    "border-t-offrip-blue",
  ];
  const connectionColors = (connection: HomeConnection) => {
    if (connection.status === "requested") return connection.isRequester ? "lime" : "orange";
    if (connection.status === "accepted") return "aqua";
    return "blue";
  };
  const companyInRoomText = stats ? formatCompanyInRoom(stats.companyColleagues, profile?.company) : null;

  return (
    <section className="bg-offrip-white p-6 font-offrip-body text-offrip-black sm:p-8">
      <h1 className="font-offrip-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
        Good to see you, <span className="text-offrip-orange">{firstName}</span>.
      </h1>
      <div className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-offrip-display text-2xl font-black uppercase tracking-tight">Your Day</h2>
          <OffripButton variant="tertiary" onClick={onSeeDay}>See full day</OffripButton>
        </div>
        {homeMeetings === undefined ? (
          <OffripCard className="mt-3 bg-offrip-light-gray p-5">
            <p className="font-offrip-body text-sm text-offrip-medium-gray">Loading your meetings…</p>
          </OffripCard>
        ) : homeMeetings.length === 0 ? (
          <OffripCard className="mt-3 bg-offrip-light-gray p-5">
            <p className="font-offrip-body text-sm text-offrip-medium-gray">Nothing scheduled yet.</p>
          </OffripCard>
        ) : (
          <div className="mt-3 space-y-3">
            {homeMeetings.map((meeting) => (
              <OffripCard
                key={meeting.id}
                interactive
                onClick={() => onViewFullProfile(meeting.matchId)}
                className="flex items-start justify-between gap-4 p-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar className="h-12 w-12 shrink-0 rounded-full border-2 border-offrip-black">
                    {meeting.otherAvatarUrl && <AvatarImage src={meeting.otherAvatarUrl} alt={meeting.otherName} />}
                    <AvatarFallback className={`rounded-full font-offrip-display text-sm font-bold ${offripAvatarClasses(meeting.otherId)}`}>
                      {profileInitials(meeting.otherName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-offrip-display font-bold uppercase">{meeting.otherName}</p>
                    <p className="mt-1 font-offrip-body text-sm text-offrip-medium-gray">
                      {meeting.otherRole}{meeting.otherCompany ? ` · ${meeting.otherCompany}` : ""}
                    </p>
                    <p className="mt-2 font-offrip-body text-sm">{meeting.location ?? "Location to be decided"}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="font-offrip-display text-sm font-bold uppercase tracking-wide">{formatMeetingTime(meeting.scheduledAt)}</span>
                  <OffripChip color="blue">Scheduled</OffripChip>
                </div>
              </OffripCard>
            ))}
          </div>
        )}
      </div>
      {stats === undefined ? (
        <p className="mt-3 font-offrip-body text-offrip-medium-gray">Your day is loading.</p>
      ) : stats === null ? (
        <div className="mt-6 space-y-3">
          <div className="border-2 border-offrip-black bg-offrip-light-gray p-6 text-center">
            <p className="font-offrip-body text-offrip-medium-gray">Join an event to see what's happening.</p>
          </div>
          <div className="border-2 border-offrip-black bg-offrip-white p-6 text-center">
            <p className="font-offrip-body text-offrip-medium-gray">No event happening right now.</p>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <p className="mb-3 font-offrip-display text-xs font-bold uppercase tracking-widest text-offrip-medium-gray">Today at {stats.eventName}</p>
          <div className="grid grid-cols-2 gap-3 bg-offrip-aqua p-4 lg:grid-cols-4">
            {[
              { label: "People registered", value: stats.registrations, onClick: onSeeRooms },
              { label: "Strong matches", value: stats.strongMatches, onClick: () => onSeeRoom(stats.eventId) },
              { label: "Pending requests", value: stats.pendingRequests, onClick: onSeeConnections },
              { label: "Unread messages", value: stats.unreadMessages, onClick: onSeeMessages },
            ].map(({ label, value, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="border-2 border-offrip-black bg-offrip-white p-4 text-left transition-colors hover:bg-offrip-lime"
              >
                <p className="font-offrip-display text-3xl font-black">{value}</p>
                <p className="mt-1 font-offrip-display text-[10px] font-bold uppercase tracking-widest text-offrip-dark-gray">{label}</p>
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-4 border-2 border-offrip-black bg-offrip-black p-6 text-offrip-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-offrip-display text-xs font-bold uppercase tracking-widest text-offrip-aqua">Current event</p>
              <h2 className="mt-1 font-offrip-display text-2xl font-black uppercase">{stats.eventName}</h2>
              <p className="mt-2 font-offrip-body text-sm text-offrip-light-gray">
                {[stats.eventVenue, stats.eventLocation].filter(Boolean).join(" · ") || "Location to be announced"}
              </p>
              <p className="mt-1 font-offrip-body text-sm text-offrip-light-gray">
                {formatEventDate(stats.eventDate)}
                {stats.eventEndDate && stats.eventEndDate !== stats.eventDate
                  ? ` – ${formatEventDate(stats.eventEndDate)}`
                  : ""}
              </p>
            </div>
            <OffripButton onClick={() => onSeeRoom(stats.eventId)} className="shrink-0 !bg-offrip-white !text-offrip-black hover:!bg-offrip-aqua">
              See the Room
            </OffripButton>
          </div>
          {companyInRoomText && (
            <div className="mt-4 border-2 border-offrip-black bg-offrip-lime p-5">
              <p className="font-offrip-display text-xs font-bold uppercase tracking-widest">Your company is in the room</p>
              <p className="mt-1 font-offrip-body text-sm text-offrip-black">{companyInRoomText}</p>
            </div>
          )}
          <div className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-offrip-display text-2xl font-black uppercase tracking-tight">{dontLeaveWithoutMeetingHeading(stats.topMatches)}</h2>
                <p className="mt-1 font-offrip-body text-sm text-offrip-medium-gray">Start here.</p>
              </div>
              {stats.topMatches.length > 0 && (
                <OffripButton variant="tertiary" onClick={() => onSeeRoom(stats.eventId)}>See all matches</OffripButton>
              )}
            </div>
            {stats.topMatches.length === 0 ? (
              <OffripCard className="mt-3 bg-offrip-light-gray p-5">
                <p className="font-offrip-body text-sm text-offrip-medium-gray">No matches yet.</p>
              </OffripCard>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {stats.topMatches.slice(0, 4).map((match, index) => (
                  <OffripCard
                    key={match.id}
                    interactive
                    onClick={() => onViewFullProfile(match.id)}
                    className={`border-t-8 p-4 ${matchAccentClasses[index % matchAccentClasses.length]}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-12 w-12 shrink-0 rounded-full border-2 border-offrip-black">
                          {match.avatarUrl && <AvatarImage src={match.avatarUrl} alt={match.name} />}
                          <AvatarFallback className={`rounded-full font-offrip-display text-sm font-bold ${OFFRIP_AVATAR_PALETTE[index % OFFRIP_AVATAR_PALETTE.length]}`}>
                            {profileInitials(match.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-offrip-display font-bold uppercase">{match.name}</p>
                          <p className="mt-1 font-offrip-body text-sm text-offrip-medium-gray">
                            {match.role}{match.company ? ` · ${match.company}` : ""}
                          </p>
                        </div>
                      </div>
                      <OffripChip color={matchColors[index % matchColors.length]}>{match.score}%</OffripChip>
                    </div>
                    <p className="mt-3 font-offrip-display text-xs font-bold uppercase tracking-widest">{matchLabel(match.score)}</p>
                    {match.reason && (
                      <p className="mt-2 line-clamp-2 font-offrip-body text-sm text-offrip-medium-gray">{match.reason}</p>
                    )}
                  </OffripCard>
                ))}
              </div>
            )}
          </div>
          {stats.topMatches[4] && (
            <div className="mt-8">
              <h2 className="font-offrip-display text-lg font-black uppercase tracking-tight">Someone Worth Knowing Just Showed Up.</h2>
              <OffripCard className="mt-4 flex flex-col gap-5 !bg-offrip-black p-5 text-offrip-white sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar className="h-12 w-12 shrink-0 rounded-full border-2 border-offrip-black">
                    {stats.topMatches[4].avatarUrl && (
                      <AvatarImage src={stats.topMatches[4].avatarUrl} alt={stats.topMatches[4].name} />
                    )}
                    <AvatarFallback className="rounded-full bg-offrip-lime font-offrip-display text-sm font-bold text-offrip-black">
                      {profileInitials(stats.topMatches[4].name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-offrip-display font-bold uppercase">{stats.topMatches[4].name}</p>
                    <p className="mt-1 truncate font-offrip-body text-sm text-offrip-medium-gray">
                      {stats.topMatches[4].role}{stats.topMatches[4].company ? ` · ${stats.topMatches[4].company}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <OffripChip color="lime">{stats.topMatches[4].score}% Match</OffripChip>
                  <OffripButton
                    variant="secondary"
                    onClick={() => onSeeRoom(stats.eventId)}
                    className="!border-offrip-white !text-offrip-white hover:!bg-offrip-white hover:!text-offrip-black"
                  >
                    See Why →
                  </OffripButton>
                </div>
              </OffripCard>
            </div>
          )}
          <div className="mt-8">
            <h2 className="font-offrip-display text-2xl font-black uppercase tracking-tight">Connections in Motion</h2>
            {stats.connectionsInMotion.length === 0 ? (
              <OffripCard className="mt-3 bg-offrip-light-gray p-5">
                <p className="font-offrip-body text-sm text-offrip-medium-gray">Nothing in motion right now.</p>
              </OffripCard>
            ) : (
              <div className="mt-3 space-y-3">
                {stats.connectionsInMotion.map((connection) => (
                  <OffripCard
                    key={connection.id}
                    interactive
                    onClick={onSeeConnections}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0 rounded-full border-2 border-offrip-black">
                        {connection.otherAvatarUrl && <AvatarImage src={connection.otherAvatarUrl} alt={connection.otherName} />}
                        <AvatarFallback className={`rounded-full font-offrip-display text-xs font-bold ${offripAvatarClasses(connection.otherId)}`}>
                          {profileInitials(connection.otherName)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="truncate font-offrip-display font-bold uppercase">{connection.otherName}</p>
                    </div>
                    <OffripChip color={connectionColors(connection)}>{connectionLabel(connection)}</OffripChip>
                  </OffripCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="ooo-card bg-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

interface DayMeetingRow {
  id: string;
  match_id: string;
  status: string;
  scheduled_at: string | null;
  location_note: string | null;
  duration_minutes: number | null;
  requester_id: string;
  recipient_id: string;
  event_id: string | null;
  otherName: string;
  eventName: string;
}

export function MyDayTab({
  userId,
  onBack,
  onViewFullProfile,
}: {
  userId: string;
  onBack: () => void;
  onViewFullProfile: (matchId: string) => void;
}) {
  const [meetings, setMeetings] = useState<DayMeetingRow[]>([]);
  const [loadingDay, setLoadingDay] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadDay = async () => {
      const { data } = await supabase
        .from("meetings")
        .select("id,match_id,status,scheduled_at,location_note,duration_minutes,requester_id,recipient_id,event_id")
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
        .in("status", ["accepted", "scheduled"])
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      const raw = data ?? [];
      const profileIds = Array.from(new Set(raw.map((meeting) => meeting.requester_id === userId ? meeting.recipient_id : meeting.requester_id)));
      const eventIds = Array.from(new Set(raw.map((meeting) => meeting.event_id).filter((id): id is string => Boolean(id))));
      const [{ data: profiles }, { data: events }] = await Promise.all([
        profileIds.length ? supabase.from("attendee_profiles").select("id,full_name").in("id", profileIds) : Promise.resolve({ data: [] }),
        eventIds.length ? supabase.from("events").select("id,name").in("id", eventIds) : Promise.resolve({ data: [] }),
      ]);
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name ?? "Member"]));
      const eventMap = new Map((events ?? []).map((event) => [event.id, event.name]));
      const enriched = raw.map((meeting) => {
        const otherId = meeting.requester_id === userId ? meeting.recipient_id : meeting.requester_id;
        return {
          ...meeting,
          otherName: profileMap.get(otherId) ?? "Member",
          eventName: eventMap.get(meeting.event_id ?? "") ?? "OFFRIP event",
        };
      });
      if (!cancelled) {
        setMeetings(enriched);
        setLoadingDay(false);
      }
    };
    loadDay();
    return () => { cancelled = true; };
  }, [userId]);

  const scheduledMinutes = meetings.reduce((total, meeting) => total + (meeting.duration_minutes ?? 30), 0);
  return (
    <div>
      <button onClick={onBack} className="mb-8 inline-flex min-h-11 items-center text-[10px] tracking-widest text-black/40 hover:text-black">← Back home</button>
      <div className="mb-8">
        <div className="text-[10px] tracking-widest font-display text-black/30 mb-2">Your OFFRIP schedule</div>
        <h1 className="font-display text-4xl">Your day</h1>
        <p className="mt-1 text-sm text-black/40 normal-case font-offrip-body">Your meetings, plans, and people already in motion.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-offrip-aqua p-5"><div className="font-display text-4xl">{meetings.length}</div><div className="text-[10px] tracking-widest font-display text-black/50">Meetings</div></div>
        <div className="bg-offrip-lime p-5"><div className="font-display text-4xl">{scheduledMinutes}</div><div className="text-[10px] tracking-widest font-display text-black/50">Minutes scheduled</div></div>
      </div>
      <h2 className="font-display text-lg mb-4">Today's meetings</h2>
      {loadingDay ? (
        <p className="text-sm text-black/40 normal-case font-offrip-body">Loading your day…</p>
      ) : meetings.length === 0 ? (
        <div className="border border-black/10 p-8 text-center text-sm text-black/40 normal-case font-offrip-body">Nothing scheduled yet. Start a conversation with someone worth knowing.</div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting, index) => (
            <button
              key={meeting.id}
              type="button"
              onClick={() => onViewFullProfile(meeting.match_id)}
              className="w-full border border-black/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4 text-left hover:border-black focus-visible:border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offrip-aqua focus-visible:ring-offset-2 transition-colors"
            >
              <div className="font-display text-lg sm:w-28">{meeting.scheduled_at ? new Date(meeting.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Pending"}</div>
              <div className="h-11 w-11 rounded-full border-2 border-black flex items-center justify-center font-display text-xs" style={{ backgroundColor: ["#69C0BE", "#DCE86A", "#4387F5"][index % 3] }}>{profileInitials(meeting.otherName)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm">{meeting.otherName}</div>
                <div className="text-xs text-black/40 normal-case font-offrip-body mt-1">{meeting.eventName} · {meeting.location_note ?? "Location to be confirmed"}</div>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                <span className={`text-[10px] tracking-widest px-2 py-1 ${meeting.status === "scheduled" ? "bg-offrip-aqua" : "bg-offrip-lime"}`}>{meeting.status}</span>
                <span className="text-[10px] tracking-widest text-black/40">View profile →</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ConnectionRow {
  id: string;
  matchId: string | null;
  otherName: string;
  otherAvatarUrl: string | null;
  otherInitials: string;
  eventId: string | null;
  eventName: string;
  status: string;
  statusColor: string;
  isPendingOnMe: boolean;
  hasCompletedMeeting: boolean;
  upcomingMeeting: { scheduledAt: string; location: string | null } | null;
}

function ConnectionsTab({
  userId,
  onViewFullProfile,
  onMessagesRead,
}: {
  userId: string;
  onViewFullProfile: (matchId: string) => void;
  onMessagesRead: () => void | Promise<void>;
}) {
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [peopleMetCount, setPeopleMetCount] = useState(0);
  const [inMotionCount, setInMotionCount] = useState(0);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [respondingMatchId, setRespondingMatchId] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<{ matchId: string; eventId: string | null; eventName: string | null; other: { id: string; full_name: string | null; avatar_url: string | null } } | null>(null);
  const [notesOpenFor, setNotesOpenFor] = useState<string | null>(null);
  const [notesByMatch, setNotesByMatch] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    const [{ data: messages }, { data: meetings }] = await Promise.all([
      supabase
        .from("messages")
        .select("id,match_id,event_id,sender_id,recipient_id,message_type,created_at")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("meetings")
        .select("id,match_id,event_id,requester_id,recipient_id,status,requested_at,completed_at,scheduled_at,location_note")
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("requested_at", { ascending: false }),
    ]);

    const meetingRows = meetings ?? [];
    const matchIdsFromRows = Array.from(new Set([
      ...(messages ?? []).map((m) => m.match_id),
      ...meetingRows.map((m) => m.match_id),
    ].filter((id): id is string => Boolean(id))));

    const { data: matchRows } = matchIdsFromRows.length
      ? await supabase.from("matches").select("id,connection_status,connection_requested_by").in("id", matchIdsFromRows)
      : { data: [] as { id: string; connection_status: string; connection_requested_by: string | null }[] };
    const connectionStatuses = new Map(
      (matchRows ?? []).map((row) => [row.id, { status: row.connection_status, requestedBy: row.connection_requested_by }]),
    );

    const summary = buildConnectionSummary(userId, messages ?? [], meetingRows, connectionStatuses);

    const otherIds = summary.people.map((person) => person.personId);
    const eventIds = Array.from(new Set(summary.people.map((person) => person.eventId).filter((id): id is string => Boolean(id))));

    const [{ data: profiles }, { data: events }, { data: notes }] = await Promise.all([
      otherIds.length ? supabase.from("attendee_profiles").select("id,full_name,avatar_url").in("id", otherIds) : Promise.resolve({ data: [] }),
      eventIds.length ? supabase.from("events").select("id,name").in("id", eventIds) : Promise.resolve({ data: [] }),
      supabase.from("connection_notes").select("match_id,note").eq("user_id", userId),
    ]);
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const eventMap = new Map((events ?? []).map((event) => [event.id, event.name]));
    const meetingsByMatch = new Map(meetingRows.map((m) => [m.match_id, m]));

    const rows: ConnectionRow[] = summary.people.map((person) => {
      const profile = profileMap.get(person.personId);
      const name = profile?.full_name ?? "Member";
      const scheduledMeeting = person.matchId ? meetingsByMatch.get(person.matchId) : undefined;
      return {
        id: person.personId,
        matchId: person.matchId,
        otherName: name,
        otherAvatarUrl: profile?.avatar_url ?? null,
        otherInitials: profileInitials(name),
        eventId: person.eventId,
        eventName: eventMap.get(person.eventId ?? "") ?? "OFFRIP connection",
        status: person.status,
        statusColor: person.statusColor,
        isPendingOnMe: person.isPendingOnMe,
        hasCompletedMeeting: person.hasCompletedMeeting,
        upcomingMeeting: scheduledMeeting?.status === "scheduled" && scheduledMeeting.scheduled_at
          ? { scheduledAt: scheduledMeeting.scheduled_at, location: scheduledMeeting.location_note }
          : null,
      };
    });

    setConnections(rows);
    setConversationCount(summary.conversationCount);
    setPeopleMetCount(summary.peopleMetCount);
    setInMotionCount(summary.inMotionCount);
    setNotesByMatch(Object.fromEntries((notes ?? []).map((n) => [n.match_id, n.note])));
    setLoadingConnections(false);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    loadConnections().catch(() => { if (!cancelled) setLoadingConnections(false); });
    return () => { cancelled = true; };
  }, [loadConnections]);

  const respondToConnection = async (matchId: string, response: "accepted" | "declined") => {
    if (respondingMatchId) return;
    setRespondingMatchId(matchId);
    const { error } = await supabase.rpc("respond_to_connection", { p_match_id: matchId, p_response: response });
    setRespondingMatchId(null);
    if (error) {
      toast.error("Couldn't respond to this connection — try again.");
      return;
    }
    toast.success(response === "accepted" ? "Connection accepted" : "Connection declined");
    await loadConnections();
  };

  const saveNote = async (matchId: string) => {
    if (savingNotes) return;
    setSavingNotes(matchId);
    const note = notesByMatch[matchId] ?? "";
    const { error } = await supabase
      .from("connection_notes")
      .upsert({ match_id: matchId, user_id: userId, note, updated_at: new Date().toISOString() }, { onConflict: "match_id,user_id" });
    setSavingNotes(null);
    if (error) {
      toast.error("Couldn't save your note — try again.");
      return;
    }
    toast.success("Note saved");
  };

  if (openThread) {
    return (
      <div className="-mx-6 -my-8">
        <MessageThread
          embedded
          userId={userId}
          matchId={openThread.matchId}
          eventId={openThread.eventId}
          eventName={openThread.eventName}
          other={openThread.other}
          onViewFullProfile={onViewFullProfile}
          onMessagesRead={onMessagesRead}
          onBack={() => {
            setOpenThread(null);
            loadConnections();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-tight">Your connections</h1>
        <p className="mt-1 text-sm text-black/40 normal-case font-offrip-body">The connections you've made and the ones already in motion.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {[[peopleMetCount, "Matches You Met"], [inMotionCount, "In Motion"], [conversationCount, "Conversations"]].map(([value, label]) => (
          <div key={String(label)} className="border border-black/10 p-4 sm:p-5">
            <div className="font-display text-3xl sm:text-4xl">{value}</div>
            <div className="text-[10px] tracking-widest font-display text-black/40 mt-1">{label}</div>
          </div>
        ))}
      </div>
      <div className="font-display text-lg mb-4">Connections in motion</div>
      {loadingConnections ? (
        <p className="text-sm text-black/40 normal-case font-offrip-body">Loading connections…</p>
      ) : connections.length === 0 ? (
        <div className="border border-black/10 p-8 text-center text-sm text-black/40 normal-case font-offrip-body">Your accepted connections and conversations will appear here.</div>
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => (
            <div key={connection.id} className="border border-black/10 p-4 hover:border-black transition-colors">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => connection.matchId && onViewFullProfile(connection.matchId)}
                  disabled={!connection.matchId}
                  className="flex min-w-0 items-center gap-3 text-left sm:flex-1"
                >
                  <Avatar className="h-11 w-11 border-2 border-black shrink-0">
                    {connection.otherAvatarUrl && <AvatarImage src={connection.otherAvatarUrl} alt={connection.otherName} />}
                    <AvatarFallback className="font-display text-xs" style={{ backgroundColor: connection.statusColor }}>
                      {connection.otherInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm truncate">{connection.otherName}</div>
                    <div className="text-xs text-black/40 normal-case font-offrip-body truncate">{connection.eventName}</div>
                  </div>
                </button>
                <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                  <span
                    className="text-[10px] tracking-widest font-display text-right"
                    style={{ color: connection.statusColor === "#DCE86A" ? "#000" : connection.statusColor }}
                  >
                    {connection.status}
                  </span>
                  {connection.matchId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenThread({
                        matchId: connection.matchId!,
                        eventId: connection.eventId,
                        eventName: connection.eventName,
                        other: { id: connection.id, full_name: connection.otherName, avatar_url: connection.otherAvatarUrl },
                      })}
                    >
                      Message
                    </Button>
                  )}
                </div>
              </div>

              {connection.isPendingOnMe && connection.matchId && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/10 pt-3">
                  <p className="text-xs text-black/50 normal-case font-offrip-body flex-1 min-w-[160px]">
                    {connection.otherName} wants to connect.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={respondingMatchId !== null}
                    onClick={() => respondToConnection(connection.matchId!, "declined")}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={respondingMatchId !== null}
                    onClick={() => respondToConnection(connection.matchId!, "accepted")}
                  >
                    Accept
                  </Button>
                </div>
              )}

              {connection.upcomingMeeting && (
                <div className="mt-3 border-t border-black/10 pt-3 text-xs normal-case font-offrip-body text-black/60">
                  Meeting {new Date(connection.upcomingMeeting.scheduledAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {connection.upcomingMeeting.location ? ` · ${connection.upcomingMeeting.location}` : ""}
                </div>
              )}

              {connection.hasCompletedMeeting && (
                <div className="mt-3 border-t border-black/10 pt-3 text-xs normal-case font-offrip-body text-black/60 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> You met
                </div>
              )}

              {connection.matchId && (
                <div className="mt-3 border-t border-black/10 pt-3">
                  {notesOpenFor === connection.matchId ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <textarea
                        className="flex-1 ooo-border bg-card px-3 py-2 text-sm normal-case font-sans resize-none"
                        rows={2}
                        placeholder="Private note (only you can see this)"
                        value={notesByMatch[connection.matchId] ?? ""}
                        onChange={(e) => setNotesByMatch((prev) => ({ ...prev, [connection.matchId!]: e.target.value }))}
                      />
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" disabled={savingNotes !== null} onClick={() => saveNote(connection.matchId!)}>
                          {savingNotes === connection.matchId ? "Saving…" : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setNotesOpenFor(null)}>Close</Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNotesOpenFor(connection.matchId)}
                      className="text-xs text-black/40 normal-case font-offrip-body hover:text-black hover:underline"
                    >
                      {notesByMatch[connection.matchId]?.trim() ? "Edit private note" : "Add a private note"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface EventRow { id: string; name: string; venue: string | null; location: string | null; date: string | null; end_date: string | null; is_demo: boolean | null; }
interface RoomAttendeePreview { id: string; full_name: string | null; avatar_url: string | null; }

function EventsTab({ userId, onViewMatches }: { userId: string; onViewMatches: (eventId: string) => void }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [checkingInEventId, setCheckingInEventId] = useState<string | null>(null);
  const [attendeesByEvent, setAttendeesByEvent] = useState<Map<string, RoomAttendeePreview[]>>(new Map());

  const load = useCallback(async () => {
    const { data } = await supabase.from("events").select("id,name,venue,location,date,end_date,is_demo").eq("is_published", true).order("date");
    const eventRows = (data as EventRow[]) ?? [];
    setEvents(eventRows);
    const { data: regs } = await supabase.from("event_registrations").select("event_id,is_checked_in").eq("profile_id", userId);
    setJoined(new Set((regs ?? []).map((r: { event_id: string | null }) => r.event_id).filter(Boolean) as string[]));
    setCheckedIn(new Set(
      (regs ?? [])
        .filter((r: { event_id: string | null; is_checked_in: boolean }) => r.is_checked_in)
        .map((r: { event_id: string | null }) => r.event_id)
        .filter(Boolean) as string[],
    ));

    const eventIds = eventRows.map((event) => event.id);
    if (eventIds.length === 0) {
      setAttendeesByEvent(new Map());
      return;
    }
    const { data: matchRows } = await supabase
      .from("matches")
      .select("event_id,user_a_id,user_b_id")
      .in("event_id", eventIds)
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
    const otherIdsByEvent = new Map<string, string[]>();
    for (const match of matchRows ?? []) {
      if (!match.event_id) continue;
      const otherId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
      if (!otherId) continue;
      const existing = otherIdsByEvent.get(match.event_id) ?? [];
      if (existing.length < 4 && !existing.includes(otherId)) existing.push(otherId);
      otherIdsByEvent.set(match.event_id, existing);
    }
    const allOtherIds = Array.from(new Set(Array.from(otherIdsByEvent.values()).flat()));
    const { data: attendeeProfiles } = allOtherIds.length > 0
      ? await supabase.from("attendee_profiles").select("id,full_name,avatar_url").in("id", allOtherIds)
      : { data: [] as RoomAttendeePreview[] };
    const attendeeById = new Map((attendeeProfiles ?? []).map((attendee) => [attendee.id, attendee]));
    const nextAttendeesByEvent = new Map<string, RoomAttendeePreview[]>();
    for (const [eventId, otherIds] of otherIdsByEvent.entries()) {
      nextAttendeesByEvent.set(
        eventId,
        otherIds.map((id) => attendeeById.get(id)).filter((attendee): attendee is RoomAttendeePreview => Boolean(attendee)),
      );
    }
    setAttendeesByEvent(nextAttendeesByEvent);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventStartTime = (event: EventRow) => event.date ? new Date(`${event.date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  const eventEndTime = (event: EventRow) => {
    const finalDate = event.end_date ?? event.date;
    return finalDate ? new Date(`${finalDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  };
  const isEventHappeningToday = (event: EventRow) => (
    eventStartTime(event) <= today.getTime() && eventEndTime(event) >= today.getTime()
  );
  const upcomingEvents = events
    .filter((event) => eventEndTime(event) >= today.getTime())
    .sort((a, b) => eventStartTime(a) - eventStartTime(b));
  const pastEvents = events
    .filter((event) => eventEndTime(event) < today.getTime())
    .sort((a, b) => eventEndTime(b) - eventEndTime(a));

  const join = async (eventId: string) => {
    if (joined.has(eventId) || joiningEventId !== null) return;
    setJoiningEventId(eventId);

    const { data: existingRegistration, error: existingError } = await supabase
      .from("event_registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("profile_id", userId)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      setJoiningEventId(null);
      toast.error("Couldn't join this event — try again.");
      return;
    }

    if (existingRegistration) {
      setJoined((current) => new Set(current).add(eventId));
      setJoiningEventId(null);
      toast.success("You're already joined");
      return;
    }

    const { error } = await supabase
      .from("event_registrations")
      .upsert({
        event_id: eventId,
        profile_id: userId,
        registration_type: "attendee",
        status: "registered",
      }, {
        onConflict: "event_id,profile_id",
        ignoreDuplicates: true,
      });

    if (error) {
      setJoiningEventId(null);
      toast.error("Couldn't join this event — try again.");
      return;
    }

    setJoined((current) => new Set(current).add(eventId));

    try {
      const { error: matchingError } = await supabase.functions.invoke("match-engine", {
        body: { eventId },
      });
      if (matchingError) console.error("match-engine invoke failed after event registration:", matchingError);
    } catch (matchingError) {
      console.error("match-engine invoke failed after event registration:", matchingError);
    }

    setJoiningEventId(null);
    toast.success("Event joined — your matches are ready");
    await load();
  };

  const checkIn = async (eventId: string) => {
    if (checkedIn.has(eventId) || checkingInEventId !== null) return;
    setCheckingInEventId(eventId);

    const { error } = await supabase
      .from("event_registrations")
      .update({ is_checked_in: true, checked_in_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .eq("profile_id", userId)
      .eq("is_checked_in", false);

    setCheckingInEventId(null);
    if (error) {
      toast.error("Couldn't check in — try again.");
      return;
    }

    setCheckedIn((current) => new Set(current).add(eventId));
    toast.success("You're checked in");
  };

  const renderEvent = (ev: EventRow) => {
    const previewAttendees = attendeesByEvent.get(ev.id) ?? [];
    const subtitle = buildEventCardSubtitle(ev);
    return (
    <div key={ev.id} className="border border-black/10 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-black transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        {previewAttendees.length > 0 && (
          <div className="flex shrink-0 -space-x-3">
            {previewAttendees.map((attendee) => (
              <Avatar key={attendee.id} className="h-10 w-10 rounded-full border-2 border-white ring-1 ring-black/10">
                {attendee.avatar_url && <AvatarImage src={attendee.avatar_url} alt={attendee.full_name ?? "Member"} />}
                <AvatarFallback className={`rounded-full font-offrip-display text-xs font-bold ${offripAvatarClasses(attendee.id)}`}>
                  {profileInitials(attendee.full_name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-display text-lg">{ev.name}</p>
          {subtitle && (
            <p className="text-xs text-black/40 normal-case font-offrip-body mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {joined.has(ev.id) ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-[10px] bg-offrip-aqua px-3 py-2">Active room</span>
          {isEventHappeningToday(ev) && (
            checkedIn.has(ev.id) ? (
              <span className="text-[10px] bg-offrip-lime px-3 py-2">✓ Checked in</span>
            ) : (
              <button
                onClick={() => checkIn(ev.id)}
                disabled={checkingInEventId !== null}
                className="text-[10px] bg-offrip-lime px-3 py-2 disabled:opacity-50"
              >
                {checkingInEventId === ev.id ? "Checking In…" : "Check In"}
              </button>
            )
          )}
          <button onClick={() => onViewMatches(ev.id)} className="text-[10px] bg-black text-white px-4 py-2.5 hover:bg-offrip-aqua hover:text-black transition-colors">
            See the room →
          </button>
        </div>
      ) : (
        <button
          onClick={() => join(ev.id)}
          disabled={joiningEventId !== null}
          className="text-[10px] bg-black text-white px-4 py-2.5 hover:bg-offrip-aqua hover:text-black transition-colors disabled:opacity-50"
        >
          {joiningEventId === ev.id ? "Joining…" : "Join"}
        </button>
      )}
    </div>
    );
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-offrip-display text-3xl font-black uppercase tracking-tight sm:text-4xl">Your rooms</h1>
        <p className="mt-1 text-sm text-black/40 normal-case font-offrip-body">Where you're showing up and who you should know when you get there.</p>
      </div>
      {events.length === 0 && <p className="text-sm text-muted-foreground normal-case font-sans">No published events yet. Check back soon.</p>}
      {upcomingEvents.length > 0 && (
        <div>
          <h3 className="font-offrip-display text-xs font-bold uppercase tracking-widest text-offrip-medium-gray mb-3">Upcoming</h3>
          <div className="space-y-3">{upcomingEvents.map(renderEvent)}</div>
        </div>
      )}
      {pastEvents.length > 0 && (
        <div className={upcomingEvents.length > 0 ? "mt-8" : ""}>
          <h3 className="font-label text-sm mb-3">Past</h3>
          <div className="space-y-3">{pastEvents.map(renderEvent)}</div>
        </div>
      )}
    </div>
  );
}
