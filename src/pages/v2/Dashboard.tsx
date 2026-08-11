import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/v2/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MatchesTab from "@/components/matches/MatchesTab";
import MessagesTab from "@/components/messages/MessagesTab";

type Tab = "profile" | "events" | "matches" | "messages";

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
            {(["profile", "events", "matches", "messages"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative font-label text-xs px-3 py-2 ooo-border ${tab === t ? "bg-aqua" : "bg-card"}`}
              >
                {t}
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
          {(["profile", "events", "matches", "messages"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`relative flex-1 font-label text-[11px] py-2 ${tab === t ? "bg-aqua" : "bg-card"}`}>
              {t}
              {t === "messages" && hasUnreadMessages && (
                <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-vermillion border border-primary" aria-label="Unread messages" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {tab === "profile" && <ProfileTab profile={profile} userId={user!.id} email={user!.email!} onSaved={loadProfile} />}
        {tab === "events" && <EventsTab userId={user!.id} />}
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

interface EventRow { id: string; name: string; venue: string | null; location: string | null; date: string | null; is_demo: boolean | null; }

function EventsTab({ userId }: { userId: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data } = await supabase.from("events").select("id,name,venue,location,date,is_demo").eq("is_published", true).order("date");
    setEvents((data as EventRow[]) ?? []);
    const { data: regs } = await supabase.from("event_registrations").select("event_id").eq("profile_id", userId);
    setJoined(new Set((regs ?? []).map((r: { event_id: string | null }) => r.event_id).filter(Boolean) as string[]));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const join = async (eventId: string) => {
    const { error } = await supabase.from("event_registrations").insert({
      event_id: eventId,
      profile_id: userId,
      registration_type: "attendee",
      status: "registered",
    });
    if (error) return toast.error(error.message);
    await supabase.from("check_ins").upsert({ event_id: eventId, user_id: userId, status: "checked_in", checked_in_at: new Date().toISOString() }, { onConflict: "event_id,user_id" });
    toast.success("You're in — checked in");
    load();
  };

  return (
    <Section title="Events">
      {events.length === 0 && <p className="text-sm text-muted-foreground normal-case font-sans">No published events yet. Check back soon.</p>}
      <div className="space-y-3">
        {events.map((ev) => (
          <div key={ev.id} className="ooo-border bg-warm p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-base">{ev.name}</p>
              <p className="text-xs text-muted-foreground normal-case font-sans">{ev.venue} · {ev.location} · {ev.date}</p>
            </div>
            {joined.has(ev.id) ? (
              <span className="font-label text-xs bg-aqua px-3 py-2 ooo-border">Joined</span>
            ) : (
              <button onClick={() => join(ev.id)} className="font-label text-xs bg-primary text-primary-foreground px-3 py-2 shadow-card">Join</button>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
