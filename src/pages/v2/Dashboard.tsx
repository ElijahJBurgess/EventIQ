import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/v2/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MatchesTab from "@/components/matches/MatchesTab";
import MessagesTab from "@/components/messages/MessagesTab";

type Tab = "profile" | "events" | "matches" | "messages";
type NavItem = Tab | "enterprise";

const NAV_ITEMS: NavItem[] = ["profile", "events", "matches", "messages", "enterprise"];

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
  total_points: number | null;
  profile_completion_score: number | null;
}

const ROLE_TYPES = ["Founder", "Investor", "Recruiter", "Corporate Leader", "Creator", "Community Builder", "Student", "Professional", "Sponsor", "Other"];

export default function DashboardV2() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

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
    <div className="min-h-screen bg-aqua">
      <header className="bg-card/95 border-b-2 border-primary sticky top-0 z-20 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="font-display text-lg">OOO</span>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((t) => (
              <button
                key={t}
                onClick={() => selectNavigationItem(t)}
                className={`relative font-label text-xs px-3 py-2 ooo-border ${tab === t ? "bg-aqua" : "bg-card"}`}
              >
                {t === "enterprise" ? "Enterprise" : t}
                {t === "messages" && hasUnreadMessages && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-vermillion border border-primary" aria-label="Unread messages" />
                )}
              </button>
            ))}
          </nav>
          <button onClick={async () => { await signOut(); navigate("/v2/auth"); }} className="font-label text-xs px-3 py-2 ooo-border bg-card">
            Sign out
          </button>
        </div>
        <div className="sm:hidden flex border-t-2 border-primary">
          {NAV_ITEMS.map((t) => (
            <button key={t} onClick={() => selectNavigationItem(t)} className={`relative flex-1 font-label text-[11px] py-2 ${tab === t ? "bg-aqua" : "bg-card"}`}>
              {t === "enterprise" ? "Enterprise" : t}
              {t === "messages" && hasUnreadMessages && (
                <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-vermillion border border-primary" aria-label="Unread messages" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {tab === "profile" && <ProfileTab profile={profile} userId={user!.id} email={user!.email!} onSaved={loadProfile} />}
        {tab === "events" && <EventsTab userId={user!.id} onViewMatches={() => setTab("matches")} />}
        {tab === "matches" && <MatchesTab userId={user!.id} />}
        {tab === "messages" && <MessagesTab userId={user!.id} />}
      </main>
    </div>
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

function ProfileTab({ profile, userId, email, onSaved }: { profile: Profile | null; userId: string; email: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    company: profile?.company ?? "",
    title: profile?.title ?? "",
    location: profile?.location ?? "",
    role_type: profile?.role_type ?? "Professional",
    bio: profile?.bio ?? "",
    interests: (profile?.interests ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const interests = form.interests.split(",").map((s) => s.trim()).filter(Boolean);
    // profile_completion_score (and profile_completed) are set once by the
    // setup wizard, which is the one true source of what "complete" means
    // for this app -- saving here must not recalculate or overwrite them.
    const { error } = await supabase.from("profiles").update({
      ...form,
      interests,
      email,
    }).eq("id", userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    onSaved();
  };

  const input = "w-full ooo-border bg-card px-4 py-3 normal-case font-sans";

  return (
    <Section title="Your profile" action={<span className="font-label text-xs">{profile?.profile_completion_score ?? 0}% complete</span>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={input} placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <input className={input} placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <input className={input} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className={input} placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <select className={input} value={form.role_type} onChange={(e) => setForm({ ...form, role_type: e.target.value })}>
          {ROLE_TYPES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <input className={input} placeholder="Interests (comma separated)" value={form.interests} onChange={(e) => setForm({ ...form, interests: e.target.value })} />
      </div>
      <textarea className={`${input} mt-3`} placeholder="Short bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      <button onClick={save} disabled={saving} className="mt-4 bg-primary text-primary-foreground px-6 py-3 shadow-card hover-lift font-label disabled:opacity-50">
        {saving ? "Saving…" : "Save profile"}
      </button>
    </Section>
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
