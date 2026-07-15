import { useCallback, useEffect, useState } from "react";
import { MapPin, Loader2, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// Week 3: Render ATL is the only live event, so the engine call is scoped to it directly.
const RENDER_ATL_EVENT_ID = "0bdca68e-a936-4f10-9a32-bee99961ffa1";

interface OtherProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  role_type: string | null;
  matching_goal: string | null;
  desired_outcomes: string[] | null;
  areas_of_expertise: string[] | null;
  industry_focus: string[] | null;
}

interface EnrichedMatch {
  id: string;
  score: number;
  reason: string | null;
  sharedIndustries: string[];
  sharedInterests: string[];
  other: OtherProfile;
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

function getMatchLabel(score: number) {
  if (score >= 75) return { text: "Strong Match", className: "bg-success text-white" };
  if (score >= 50) return { text: "Good Match", className: "bg-blue-500 text-white" };
  return { text: "Potential Match", className: "bg-muted text-muted-foreground" };
}

export default function MatchesTab({ userId }: { userId: string }) {
  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadMatches = useCallback(async () => {
    const { data: matchRows, error } = await supabase
      .from("matches")
      .select("id, user_a_id, user_b_id, match_score, match_reason, shared_industries, shared_interests")
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .order("match_score", { ascending: false });

    if (error) {
      toast.error("Couldn't load matches — try refreshing.");
      setLoading(false);
      return;
    }

    const rows = matchRows ?? [];
    const otherIds = Array.from(
      new Set(rows.map((m) => (m.user_a_id === userId ? m.user_b_id : m.user_a_id)).filter((id): id is string => Boolean(id))),
    );

    const profileMap = new Map<string, OtherProfile>();
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, title, company, location, role_type, matching_goal, desired_outcomes, areas_of_expertise, industry_focus")
        .in("id", otherIds);
      for (const p of profiles ?? []) profileMap.set(p.id, p as OtherProfile);
    }

    const enriched: EnrichedMatch[] = rows
      .map((m) => {
        const otherId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
        const other = otherId ? profileMap.get(otherId) : undefined;
        if (!other) return null;
        return {
          id: m.id,
          score: m.match_score ?? 0,
          reason: m.match_reason,
          sharedIndustries: m.shared_industries ?? [],
          sharedInterests: m.shared_interests ?? [],
          other,
        };
      })
      .filter((m): m is EnrichedMatch => m !== null);

    setMatches(enriched);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const runMatching = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("match-engine", {
      body: { profileId: userId, eventId: RENDER_ATL_EVENT_ID },
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

  return (
    <div>
      <div className="ooo-card bg-card p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl">Your Matches</h2>
            <p className="text-sm text-muted-foreground normal-case font-sans mt-1">
              People you should meet at Render ATL 2026
            </p>
          </div>
          <Button onClick={runMatching} disabled={running} variant="secondary" size="sm">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {running ? "Running…" : "Run Matching"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground normal-case font-sans mt-3">
          {matches.length} {matches.length === 1 ? "person" : "people"} matched
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ooo-border bg-warm p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="ooo-border bg-warm p-8 text-center">
          <p className="text-sm text-muted-foreground normal-case font-sans">
            No matches yet. Your matches will appear here once the engine runs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: EnrichedMatch }) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const label = getMatchLabel(match.score);
  const { other } = match;
  const subtitle = [other.title, other.company].filter(Boolean).join(" · ");

  const handleConnect = async () => {
    setStatus("loading");

    const [{ data: authData }] = await Promise.all([supabase.auth.getUser(), new Promise((r) => setTimeout(r, 1000))]);
    const actingUser = authData?.user;
    if (!actingUser) {
      setStatus("idle");
      toast.error("You must be signed in to connect.");
      return;
    }

    const { error } = await supabase.from("match_actions").insert({
      match_id: match.id,
      action_type: "connection_requested",
      user_id: actingUser.id,
    });

    if (error) {
      setStatus("idle");
      toast.error("Couldn't send the request — try again.");
      return;
    }

    setStatus("sent");
    toast.success(`Connection request sent to ${other.full_name ?? "this member"}`);
  };

  return (
    <div className="ooo-border bg-warm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-12 w-12 border-2 border-primary shrink-0">
            {other.avatar_url && <AvatarImage src={other.avatar_url} alt={other.full_name ?? "Profile photo"} />}
            <AvatarFallback className={`font-label text-sm ${avatarClasses(other.id)}`}>
              {initials(other.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-bold normal-case font-sans truncate">{other.full_name ?? "Member"}</p>
            {subtitle && <p className="text-xs text-muted-foreground normal-case font-sans truncate">{subtitle}</p>}
            {other.location && (
              <p className="text-[11px] text-muted-foreground normal-case font-sans flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{other.location}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`font-label text-[10px] px-2 py-1 ooo-border ${label.className}`}>{label.text}</span>
          <span className="font-label text-xs text-muted-foreground">{match.score}</span>
        </div>
      </div>

      <Separator className="bg-primary/20" />

      {match.reason && (
        <p className="text-sm leading-relaxed normal-case font-sans break-words">{match.reason}</p>
      )}

      {(match.sharedIndustries.length > 0 || match.sharedInterests.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {match.sharedIndustries.length > 0 && (
            <span className="text-[10px] font-label bg-muted text-muted-foreground px-2 py-1 ooo-border">
              Shared: {match.sharedIndustries.join(", ")}
            </span>
          )}
          {match.sharedInterests.slice(0, 3).map((interest) => (
            <span key={interest} className="text-[10px] font-label bg-muted text-muted-foreground px-2 py-1 ooo-border">
              {interest}
            </span>
          ))}
        </div>
      )}

      <Button className="w-full" disabled={status !== "idle"} onClick={handleConnect}>
        {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === "sent" && <Check className="h-4 w-4" />}
        {status === "sent" ? "Request Sent" : status === "loading" ? "Sending…" : "Request to Connect"}
      </Button>
    </div>
  );
}
