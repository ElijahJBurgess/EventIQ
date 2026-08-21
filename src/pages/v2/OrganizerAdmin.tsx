import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const ADMIN_SESSION_KEY = "ooo-organizer-admin-session";
const ADMIN_SESSION_DURATION_MS = 72 * 60 * 60 * 1_000;

interface OrganizerSession {
  passwordHash: string;
  grantedAt: number;
}

function getValidOrganizerSession() {
  const storedSession = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!storedSession) return "";

  try {
    const session = JSON.parse(storedSession) as OrganizerSession;
    const age = Date.now() - session.grantedAt;
    const isValidHash = /^[a-f0-9]{64}$/.test(session.passwordHash);
    const isWithinAccessWindow = age >= 0 && age < ADMIN_SESSION_DURATION_MS;
    if (isValidHash && isWithinAccessWindow) return session.passwordHash;
  } catch {
    // Old or malformed organizer sessions should require the password again.
  }

  localStorage.removeItem(ADMIN_SESSION_KEY);
  return "";
}

interface EventStats {
  id: string;
  name: string;
  date: string | null;
  totalRegistrations: number;
  totalCheckedIn: number;
  totalMatches: number;
  totalConnectionRequests: number;
  totalMeetingRequests: number;
  meetingsByStatus: {
    requested: number;
    accepted: number;
    declined: number;
    scheduled: number;
    completed: number;
  };
  topMatchingGoals: Array<{ label: string; count: number }>;
  topExpertise: Array<{ label: string; count: number }>;
  topInterestsAndCommunities: Array<{ label: string; count: number }>;
}

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function OrganizerAdmin() {
  const navigate = useNavigate();
  const [accessHash, setAccessHash] = useState(getValidOrganizerSession);
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<EventStats[]>([]);
  const [loadingStats, setLoadingStats] = useState(Boolean(accessHash));

  const loadStats = useCallback(async (passwordHash: string) => {
    setLoadingStats(true);
    const { data, error: requestError } = await supabase.functions.invoke("admin-auth", {
      body: { passwordHash, action: "event-stats" },
    });
    setLoadingStats(false);

    if (requestError || !data?.valid) {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      setAccessHash("");
      setEvents([]);
      setError("Organizer access expired. Please enter the password again.");
      return false;
    }

    setEvents((data.events as EventStats[] | undefined) ?? []);
    return true;
  }, []);

  useEffect(() => {
    if (accessHash && events.length === 0) loadStats(accessHash);
  }, [accessHash, events.length, loadStats]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || checking) return;
    setChecking(true);
    setError("");

    const passwordHash = await hashPassword(password);
    const { data, error: requestError } = await supabase.functions.invoke("admin-auth", {
      body: { passwordHash, action: "event-stats" },
    });

    setChecking(false);
    setPassword("");
    if (requestError) {
      setError("Couldn't verify access. Please try again.");
      return;
    }
    if (!data?.valid) {
      setError("Incorrect password");
      return;
    }

    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
      passwordHash,
      grantedAt: Date.now(),
    } satisfies OrganizerSession));
    setEvents((data.events as EventStats[] | undefined) ?? []);
    setAccessHash(passwordHash);
  };

  const formatEventDate = (date: string | null) => {
    if (!date) return "Date to be announced";
    return new Date(`${date}T00:00:00`).toLocaleDateString([], {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-white/10 bg-black text-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
          <span className="font-display text-lg normal-case">OFFRIP</span>
          <span className="text-[10px] tracking-widest font-display text-white/30">Enterprise</span>
          <div className="flex-1" />
          <button onClick={() => navigate("/v2")} className="text-[10px] tracking-widest text-white/50 hover:text-white border border-white/20 px-3 py-1.5">
            Attendee view →
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {accessHash ? (
          <div>
            <p className="font-display text-[10px] text-black/30 mb-2 tracking-widest">Current event intelligence</p>
            <h1 className="text-4xl">Relationship overview</h1>
            <p className="normal-case font-offrip-body text-black/40 mt-2 mb-8">
              See who showed up, how the room connected, and what happened next.
            </p>

            {loadingStats ? (
              <div className="flex items-center gap-2 normal-case font-sans text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading event totals…
              </div>
            ) : events.length === 0 ? (
              <section className="ooo-card bg-card p-6 normal-case font-sans text-muted-foreground">
                No published events found.
              </section>
            ) : (
              <div className="space-y-6">
                {events.map((event) => {
                  const checkedInPercentage = event.totalRegistrations === 0
                    ? 0
                    : Math.round((event.totalCheckedIn / event.totalRegistrations) * 100);
                  return (
                    <section key={event.id} className="border border-black p-6 sm:p-8">
                      <h2 className="text-2xl">{event.name}</h2>
                      <p className="normal-case font-sans text-sm text-muted-foreground mt-1 mb-6">
                        {formatEventDate(event.date)}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="ooo-border bg-aqua p-4">
                          <p className="font-label text-xs text-muted-foreground">Registrations</p>
                          <p className="font-display text-3xl mt-2">{event.totalRegistrations}</p>
                        </div>
                        <div className="ooo-border bg-citron p-4">
                          <p className="font-label text-xs text-muted-foreground">Checked in</p>
                          <p className="font-display text-3xl mt-2">{event.totalCheckedIn}</p>
                        </div>
                        <div className="ooo-border bg-warm p-4">
                          <p className="font-label text-xs text-muted-foreground">Check-in rate</p>
                          <p className="font-display text-3xl mt-2">{checkedInPercentage}%</p>
                        </div>
                        <div className="ooo-border bg-card p-4">
                          <p className="font-label text-xs text-muted-foreground">Matches generated</p>
                          <p className="font-display text-3xl mt-2">{event.totalMatches}</p>
                        </div>
                        <div className="ooo-border bg-card p-4">
                          <p className="font-label text-xs text-muted-foreground">Connection requests</p>
                          <p className="font-display text-3xl mt-2">{event.totalConnectionRequests}</p>
                        </div>
                        <div className="ooo-border bg-card p-4">
                          <p className="font-label text-xs text-muted-foreground">Meeting requests</p>
                          <p className="font-display text-3xl mt-2">{event.totalMeetingRequests}</p>
                        </div>
                      </div>
                      <div className="mt-6 pt-6 border-t-2 border-primary">
                        <div className="mb-4">
                          <p className="font-label text-xs text-muted-foreground">Meeting activity</p>
                          <h3 className="text-xl mt-1">Meeting status</h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {([
                            ["Requested", event.meetingsByStatus.requested],
                            ["Accepted", event.meetingsByStatus.accepted],
                            ["Declined", event.meetingsByStatus.declined],
                            ["Scheduled", event.meetingsByStatus.scheduled],
                            ["Completed", event.meetingsByStatus.completed],
                          ] as const).map(([label, value]) => (
                            <div key={label} className={`ooo-border p-4 ${label === "Completed" ? "bg-citron" : "bg-card"}`}>
                              <p className="font-label text-[11px] text-muted-foreground">{label}</p>
                              <p className="font-display text-3xl mt-2">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-6 pt-6 border-t-2 border-primary">
                        <div className="mb-4">
                          <p className="font-label text-xs text-muted-foreground">Attendee insights</p>
                          <h3 className="text-xl mt-1">What attendees care about</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {([
                            ["Top matching goals", event.topMatchingGoals],
                            ["Top areas of expertise", event.topExpertise],
                            ["Top interests & communities", event.topInterestsAndCommunities],
                          ] as const).map(([title, items]) => (
                            <div key={title} className="ooo-border bg-card p-4">
                              <h4 className="font-label text-xs mb-3">{title}</h4>
                              {items.length === 0 ? (
                                <p className="normal-case font-sans text-sm text-muted-foreground">No data yet</p>
                              ) : (
                                <ol className="space-y-2">
                                  {items.map((item, index) => (
                                    <li key={item.label} className="flex items-start justify-between gap-3 normal-case font-sans text-sm">
                                      <span><span className="text-muted-foreground mr-2">{index + 1}.</span>{item.label}</span>
                                      <span className="font-label text-xs ooo-border bg-aqua px-2 py-1 shrink-0">{item.count}</span>
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <section className="ooo-card bg-card p-6 sm:p-8 max-w-md mx-auto">
            <h1 className="text-2xl sm:text-3xl">Organizer access</h1>
            <p className="normal-case font-sans text-sm text-muted-foreground mt-2 mb-6">
              Enter the shared organizer password to continue.
            </p>
            <form onSubmit={submit} className="space-y-4">
              <label className="block font-label text-xs">
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  className="mt-2 w-full ooo-border bg-card px-4 py-3 normal-case font-sans"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={checking}
                />
              </label>
              {error && <p className="normal-case font-sans text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={checking || !password}>
                {checking && <Loader2 className="h-4 w-4 animate-spin" />}
                {checking ? "Checking…" : "Continue"}
              </Button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
