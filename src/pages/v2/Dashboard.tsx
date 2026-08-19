import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/v2/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MatchesTab from "@/components/matches/MatchesTab";
import MessagesTab from "@/components/messages/MessagesTab";
import OffripButton from "@/components/offrip/Button";
import OffripCard from "@/components/offrip/Card";
import OffripChip from "@/components/offrip/Chip";
import EditProfileScreen from "@/components/profile/EditProfileScreen";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tab = "home" | "profile" | "events" | "matches" | "messages";
type NavItem = Exclude<Tab, "profile"> | "enterprise";

const NAV_ITEMS: NavItem[] = ["home", "events", "matches", "messages", "enterprise"];

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  title: string | null;
  location: string | null;
  role_type: string | null;
  bio: string | null;
  interests: string[] | null;
  avatar_url: string | null;
  total_points: number | null;
  profile_completion_score: number | null;
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
  scheduledMeetings: HomeMeeting[];
  topMatches: HomeMatch[];
  connectionsInMotion: HomeConnection[];
}

interface HomeMeeting {
  id: string;
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("home");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [editingFullProfile, setEditingFullProfile] = useState(false);

  const selectNavigationItem = (item: NavItem) => {
    if (item === "enterprise") {
      navigate("/v2/admin");
      return;
    }
    setTab(item);
  };

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(data as Profile | null);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    // read_at can't be set from the client (no UPDATE policy on messages),
    // so this only ever reflects messages that have never been opened.
    supabase
      .from("messages")
      .select("id")
      .eq("recipient_id", user.id)
      .is("read_at", null)
      .limit(1)
      .then(({ data }) => setHasUnreadMessages((data?.length ?? 0) > 0));
  }, [user]);

  if (loading) {
    return <div className="min-h-screen bg-aqua flex items-center justify-center font-label text-xl">Loading…</div>;
  }

  return (
    <div className={`min-h-screen ${tab === "home" ? "bg-offrip-white" : "bg-aqua"}`}>
      <header className="bg-card/95 border-b-2 border-primary sticky top-0 z-20 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="font-display text-lg">OFFRIP</span>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((t) => (
              <button
                key={t}
                onClick={() => selectNavigationItem(t)}
                className={`relative font-label text-xs px-3 py-2 ooo-border ${tab === t ? "bg-aqua" : "bg-card"}`}
              >
                {t === "enterprise" ? "Enterprise" : t === "home" ? "Home" : t}
                {t === "messages" && hasUnreadMessages && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-vermillion border border-primary" aria-label="Unread messages" />
                )}
              </button>
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full" aria-label="Open account menu">
                <Avatar className="h-10 w-10 rounded-full border-2 border-primary">
                  <AvatarFallback className={`rounded-full font-label text-xs ${offripAvatarClasses(user!.id)}`}>
                    {profileInitials(profile?.full_name ?? null)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="ooo-border bg-card">
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="sm:hidden flex border-t-2 border-primary">
          {NAV_ITEMS.map((t) => (
            <button key={t} onClick={() => selectNavigationItem(t)} className={`relative flex-1 font-label text-[11px] py-2 ${tab === t ? "bg-aqua" : "bg-card"}`}>
              {t === "enterprise" ? "Enterprise" : t === "home" ? "Home" : t}
              {t === "messages" && hasUnreadMessages && (
                <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-vermillion border border-primary" aria-label="Unread messages" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {tab === "home" && (
          <HomeTab profile={profile} userId={user!.id} onSeeRoom={() => setTab("matches")} />
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
        {tab === "events" && <EventsTab userId={user!.id} onViewMatches={() => setTab("matches")} />}
        {tab === "matches" && <MatchesTab userId={user!.id} />}
        {tab === "messages" && <MessagesTab userId={user!.id} />}
      </main>
    </div>
  );
}

function HomeTab({ profile, userId, onSeeRoom }: { profile: Profile | null; userId: string; onSeeRoom: () => void }) {
  const [stats, setStats] = useState<HomeStatsData | null | undefined>(undefined);

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

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activeEvent = (events ?? []).find((event) => {
        if (!event.date) return false;
        const start = new Date(`${event.date}T00:00:00`);
        const end = new Date(`${event.end_date ?? event.date}T00:00:00`);
        return start <= today && end >= today;
      });

      if (!activeEvent) {
        if (!cancelled) setStats(null);
        return;
      }

      const [registrationResult, matchResult, topMatchResult, incomingResult, unreadResult, meetingResult, connectionResult] = await Promise.all([
        supabase
          .from("event_registrations")
          .select("id", { count: "exact", head: true })
          .eq("event_id", activeEvent.id),
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("event_id", activeEvent.id)
          .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
          .gte("match_score", 75),
        supabase
          .from("matches")
          .select("id,user_a_id,user_b_id,match_score,match_reason")
          .eq("event_id", activeEvent.id)
          .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
          .order("match_score", { ascending: false })
          .limit(5),
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
          .select("id,requester_id,recipient_id,scheduled_at,location_note")
          .eq("event_id", activeEvent.id)
          .eq("status", "scheduled")
          .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
          .not("scheduled_at", "is", null)
          .order("scheduled_at", { ascending: true }),
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

      const meetingRows = meetingResult.data ?? [];
      const otherIds = Array.from(new Set(
        meetingRows
          .map((meeting) => meeting.requester_id === userId ? meeting.recipient_id : meeting.requester_id)
          .filter(Boolean),
      ));
      const { data: meetingProfiles } = otherIds.length > 0
        ? await supabase
          .from("profiles")
          .select("id,full_name,title,role_type,company,avatar_url")
          .in("id", otherIds)
        : { data: [] as Pick<Profile, "id" | "full_name" | "title" | "role_type" | "company" | "avatar_url">[] };
      const profileById = new Map((meetingProfiles ?? []).map((meetingProfile) => [meetingProfile.id, meetingProfile]));
      const scheduledMeetings: HomeMeeting[] = meetingRows
        .map((meeting) => {
          if (!meeting.scheduled_at) return null;
          const otherId = meeting.requester_id === userId ? meeting.recipient_id : meeting.requester_id;
          const other = profileById.get(otherId);
          if (!other) return null;
          return {
            id: meeting.id,
            otherId: other.id,
            otherName: other.full_name ?? "OOO member",
            otherAvatarUrl: other.avatar_url,
            otherRole: other.title ?? other.role_type ?? "Member",
            otherCompany: other.company,
            scheduledAt: meeting.scheduled_at,
            location: meeting.location_note,
          };
        })
        .filter((meeting): meeting is HomeMeeting => meeting !== null);

      const topMatchRows = topMatchResult.data ?? [];
      const topMatchProfileIds = topMatchRows
        .map((match) => match.user_a_id === userId ? match.user_b_id : match.user_a_id)
        .filter((profileId): profileId is string => Boolean(profileId));
      const { data: topMatchProfiles } = topMatchProfileIds.length > 0
        ? await supabase
          .from("profiles")
          .select("id,full_name,title,role_type,company,avatar_url")
          .in("id", topMatchProfileIds)
        : { data: [] as Pick<Profile, "id" | "full_name" | "title" | "role_type" | "company" | "avatar_url">[] };
      const topMatchProfileById = new Map((topMatchProfiles ?? []).map((matchProfile) => [matchProfile.id, matchProfile]));
      const topMatches: HomeMatch[] = topMatchRows
        .map((match) => {
          const otherId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
          const other = otherId ? topMatchProfileById.get(otherId) : undefined;
          if (!other) return null;
          return {
            id: match.id,
            otherId: other.id,
            name: other.full_name ?? "OOO member",
            avatarUrl: other.avatar_url,
            role: other.title ?? other.role_type ?? "Member",
            company: other.company,
            score: match.match_score ?? 0,
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
          .from("profiles")
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
            otherName: other.full_name ?? "OOO member",
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
          registrations: registrationResult.count ?? 0,
          strongMatches: matchResult.count ?? 0,
          pendingRequests,
          unreadMessages: unreadResult.count ?? 0,
          scheduledMeetings,
          topMatches,
          connectionsInMotion,
        });
      }
    };

    loadStats();
    return () => { cancelled = true; };
  }, [userId]);

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
  const matchLabel = (score: number) => score >= 75
    ? "Strong Match"
    : score >= 50
      ? "Good Match"
      : "Potential Match";
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

  return (
    <section className="bg-offrip-white p-6 font-offrip-body text-offrip-black sm:p-8">
      <h1 className="font-offrip-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
        Good to see you, <span className="text-offrip-orange">{firstName}</span>.
      </h1>
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
              ["People registered", stats.registrations],
              ["Strong matches", stats.strongMatches],
              ["Pending requests", stats.pendingRequests],
              ["Unread messages", stats.unreadMessages],
            ].map(([label, value]) => (
              <div key={label} className="border-2 border-offrip-black bg-offrip-white p-4">
                <p className="font-offrip-display text-3xl font-black">{value}</p>
                <p className="mt-1 font-offrip-display text-[10px] font-bold uppercase tracking-widest text-offrip-dark-gray">{label}</p>
              </div>
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
            <OffripButton onClick={onSeeRoom} className="shrink-0 !bg-offrip-white !text-offrip-black hover:!bg-offrip-aqua">
              See the Room
            </OffripButton>
          </div>
          <div className="mt-8">
            <h2 className="font-offrip-display text-2xl font-black uppercase tracking-tight">Your Day</h2>
            {stats.scheduledMeetings.length === 0 ? (
              <OffripCard className="mt-3 bg-offrip-light-gray p-5">
                <p className="font-offrip-body text-sm text-offrip-medium-gray">Nothing scheduled yet.</p>
              </OffripCard>
            ) : (
              <div className="mt-3 space-y-3">
                {stats.scheduledMeetings.map((meeting) => (
                  <OffripCard key={meeting.id} className="flex items-start justify-between gap-4 p-4">
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
          <div className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-offrip-display text-2xl font-black uppercase tracking-tight">Don't Leave Without Meeting</h2>
                <p className="mt-1 font-offrip-body text-sm text-offrip-medium-gray">Start here.</p>
              </div>
              {stats.topMatches.length > 0 && (
                <OffripButton variant="tertiary" onClick={onSeeRoom}>See all matches</OffripButton>
              )}
            </div>
            {stats.topMatches.length === 0 ? (
              <OffripCard className="mt-3 bg-offrip-light-gray p-5">
                <p className="font-offrip-body text-sm text-offrip-medium-gray">No matches yet.</p>
              </OffripCard>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {stats.topMatches.slice(0, 4).map((match, index) => (
                  <OffripCard key={match.id} interactive className={`border-t-8 p-4 ${matchAccentClasses[index % matchAccentClasses.length]}`}>
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
                    onClick={onSeeRoom}
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
                  <OffripCard key={connection.id} className="flex items-center justify-between gap-4 p-4">
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

interface EventRow { id: string; name: string; venue: string | null; location: string | null; date: string | null; end_date: string | null; is_demo: boolean | null; }

function EventsTab({ userId, onViewMatches }: { userId: string; onViewMatches: () => void }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [checkingInEventId, setCheckingInEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("events").select("id,name,venue,location,date,end_date,is_demo").eq("is_published", true).order("date");
    setEvents((data as EventRow[]) ?? []);
    const { data: regs } = await supabase.from("event_registrations").select("event_id,is_checked_in").eq("profile_id", userId);
    setJoined(new Set((regs ?? []).map((r: { event_id: string | null }) => r.event_id).filter(Boolean) as string[]));
    setCheckedIn(new Set(
      (regs ?? [])
        .filter((r: { event_id: string | null; is_checked_in: boolean }) => r.is_checked_in)
        .map((r: { event_id: string | null }) => r.event_id)
        .filter(Boolean) as string[],
    ));
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

    const { error } = await supabase.from("event_registrations").insert({
      event_id: eventId,
      profile_id: userId,
      registration_type: "attendee",
      status: "registered",
    });

    if (error) {
      setJoiningEventId(null);
      toast.error("Couldn't join this event — try again.");
      return;
    }

    setJoined((current) => new Set(current).add(eventId));

    try {
      const { error: matchingError } = await supabase.functions.invoke("match-engine", {
        body: { profileId: userId, eventId },
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

  const renderEvent = (ev: EventRow) => (
    <div key={ev.id} className="ooo-border bg-warm p-4 flex items-center justify-between gap-3">
      <div>
        <p className="font-display text-base">{ev.name}</p>
        <p className="text-xs text-muted-foreground normal-case font-sans">{ev.venue} · {ev.location} · {ev.date}</p>
      </div>
      {joined.has(ev.id) ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="font-label text-xs bg-aqua px-3 py-2 ooo-border">Joined</span>
          {isEventHappeningToday(ev) && (
            checkedIn.has(ev.id) ? (
              <span className="font-label text-xs bg-citron px-3 py-2 ooo-border">✓ Checked In</span>
            ) : (
              <button
                onClick={() => checkIn(ev.id)}
                disabled={checkingInEventId !== null}
                className="font-label text-xs bg-citron px-3 py-2 ooo-border disabled:opacity-50"
              >
                {checkingInEventId === ev.id ? "Checking In…" : "Check In"}
              </button>
            )
          )}
          <button onClick={onViewMatches} className="font-label text-xs bg-primary text-primary-foreground px-3 py-2 shadow-card">
            View Matches
          </button>
        </div>
      ) : (
        <button
          onClick={() => join(ev.id)}
          disabled={joiningEventId !== null}
          className="font-label text-xs bg-primary text-primary-foreground px-3 py-2 shadow-card disabled:opacity-50"
        >
          {joiningEventId === ev.id ? "Joining…" : "Join"}
        </button>
      )}
    </div>
  );

  return (
    <Section title="Events">
      {events.length === 0 && <p className="text-sm text-muted-foreground normal-case font-sans">No published events yet. Check back soon.</p>}
      {upcomingEvents.length > 0 && (
        <div>
          <h3 className="font-label text-sm mb-3">Upcoming</h3>
          <div className="space-y-3">{upcomingEvents.map(renderEvent)}</div>
        </div>
      )}
      {pastEvents.length > 0 && (
        <div className={upcomingEvents.length > 0 ? "mt-8" : ""}>
          <h3 className="font-label text-sm mb-3">Past</h3>
          <div className="space-y-3">{pastEvents.map(renderEvent)}</div>
        </div>
      )}
    </Section>
  );
}
