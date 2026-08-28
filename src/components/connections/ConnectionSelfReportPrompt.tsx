// Phase 3: "Did you connect with [Name]?" self-report.
//
// Trigger: opportunistic, checked once per session on login/dashboard mount
// (not a background job -- no cron/infra needed) against connections that
// have been accepted for 24+ hours and haven't been answered yet. This
// covers both the "24 hours after acceptance" and "next login" trigger
// options at once: the condition is time-based, the check happens at the
// cheapest possible moment. A connection that already went through the
// formal "We Met" -> valuable Yes/No flow in MessageThread is excluded --
// that flow already answered this question for that connection, and asking
// again would be redundant.
//
// One eligible connection is shown at a time so this never turns into a
// wall of prompts; the RLS unique(match_id, user_id) on
// connection_self_reports guarantees a connection is never asked twice.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const PENDING_AFTER_MS = 24 * 60 * 60 * 1000;

type ReportResponse = "met" | "exchanged_messages" | "scheduled_for_later" | "not_yet" | "no_longer_interested";

const RESPONSE_OPTIONS: { value: ReportResponse; label: string }[] = [
  { value: "met", label: "Yes, we met" },
  { value: "exchanged_messages", label: "We exchanged messages" },
  { value: "scheduled_for_later", label: "We scheduled for later" },
  { value: "not_yet", label: "Not yet" },
  { value: "no_longer_interested", label: "No longer interested" },
];

interface EligibleConnection {
  matchId: string;
  eventId: string | null;
  otherName: string;
}

export default function ConnectionSelfReportPrompt({ userId }: { userId: string }) {
  const [connection, setConnection] = useState<EligibleConnection | null | undefined>(undefined);
  const [stage, setStage] = useState<"question" | "valuable">("question");
  const [submitting, setSubmitting] = useState(false);

  const findEligibleConnection = useCallback(async () => {
    const cutoff = new Date(Date.now() - PENDING_AFTER_MS).toISOString();

    const { data: matches } = await supabase
      .from("matches")
      .select("id,event_id,user_a_id,user_b_id,connection_status_updated_at")
      .eq("connection_status", "accepted")
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .lt("connection_status_updated_at", cutoff)
      .order("connection_status_updated_at", { ascending: true });

    const candidateMatches = matches ?? [];
    if (candidateMatches.length === 0) return null;

    const matchIds = candidateMatches.map((m) => m.id);
    const [{ data: existingReports }, { data: completedMeetings }] = await Promise.all([
      supabase.from("connection_self_reports").select("match_id").eq("user_id", userId).in("match_id", matchIds),
      supabase.from("meetings").select("id,match_id").in("match_id", matchIds).eq("status", "completed"),
    ]);
    const reportedMatchIds = new Set((existingReports ?? []).map((r) => r.match_id));

    const completedMeetingIds = (completedMeetings ?? []).map((m) => m.id);
    const { data: existingFeedback } = completedMeetingIds.length
      ? await supabase.from("feedback").select("meeting_id").eq("user_id", userId).in("meeting_id", completedMeetingIds)
      : { data: [] as { meeting_id: string | null }[] };
    const meetingsWithFeedback = new Set((existingFeedback ?? []).map((f) => f.meeting_id));
    const matchIdsAlreadyAnsweredViaMeeting = new Set(
      (completedMeetings ?? []).filter((m) => meetingsWithFeedback.has(m.id)).map((m) => m.match_id),
    );

    const eligible = candidateMatches.find((m) =>
      !reportedMatchIds.has(m.id) && !matchIdsAlreadyAnsweredViaMeeting.has(m.id),
    );
    if (!eligible) return null;

    const otherId = eligible.user_a_id === userId ? eligible.user_b_id : eligible.user_a_id;
    if (!otherId) return null;
    const { data: profile } = await supabase.from("attendee_profiles").select("full_name").eq("id", otherId).maybeSingle();

    return { matchId: eligible.id, eventId: eligible.event_id, otherName: profile?.full_name ?? "this connection" };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    findEligibleConnection()
      .then((result) => { if (!cancelled) setConnection(result); })
      .catch(() => { if (!cancelled) setConnection(null); });
    return () => { cancelled = true; };
  }, [findEligibleConnection]);

  const submitResponse = async (response: ReportResponse, wasValuable: boolean | null = null) => {
    if (!connection || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("connection_self_reports").insert({
      match_id: connection.matchId,
      user_id: userId,
      response,
      was_valuable: wasValuable,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't save your answer — try again.");
      return;
    }
    setConnection(null);
  };

  const handleResponse = (response: ReportResponse) => {
    if (response === "met") {
      setStage("valuable");
      return;
    }
    submitResponse(response);
  };

  if (!connection) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:px-6 sm:pb-6" role="dialog" aria-label="Connection self-report">
      <div className="ooo-border bg-card w-full max-w-lg p-5 shadow-offrip-hard">
        {stage === "question" ? (
          <>
            <p className="font-bold normal-case font-sans">Did you connect with {connection.otherName}?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {RESPONSE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={option.value === "met" ? "default" : "outline"}
                  disabled={submitting}
                  onClick={() => handleResponse(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="font-bold normal-case font-sans">Was connecting with {connection.otherName} valuable?</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={submitting} onClick={() => submitResponse("met", true)}>Yes</Button>
              <Button size="sm" variant="outline" disabled={submitting} onClick={() => submitResponse("met", false)}>No</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
