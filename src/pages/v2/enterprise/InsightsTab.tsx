import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { EventStats } from "@/lib/enterpriseOverview";

// Grounded in fields that actually exist on EventStats.
const SUGGESTED_QUESTIONS = [
  "How did check-in and profile completion compare to registrations?",
  "Where is the biggest drop-off in the relationship funnel?",
  "Which role pairings produced the most accepted connections?",
  "What were attendees most commonly trying to get out of the event?",
];

interface InsightsResponse {
  valid?: boolean;
  insights?: string[];
  error?: string;
}

interface CopilotResponse {
  valid?: boolean;
  answer?: string;
  error?: string;
}

export default function InsightsTab({ event, accessHash }: { event: EventStats; accessHash: string }) {
  const [insights, setInsights] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [copilotQ, setCopilotQ] = useState("");
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  const loadInsights = useCallback(
    async (refresh: boolean) => {
      setInsightsLoading(true);
      setInsightsError(null);
      const { data, error } = await supabase.functions.invoke("admin-auth", {
        body: {
          passwordHash: accessHash,
          action: "insights",
          eventId: event.id,
          ...(refresh ? { refresh: true } : {}),
        },
      });
      setInsightsLoading(false);

      const payload = data as InsightsResponse | null;
      if (error || !payload?.valid) {
        setInsightsError("Couldn't reach the insights service. Try again.");
        return;
      }
      if (Array.isArray(payload.insights) && payload.insights.length > 0) {
        setInsights(payload.insights);
      }
      if (payload.error) {
        setInsightsError(
          payload.error === "insights_unavailable"
            ? "Insights aren't configured for this project yet."
            : "Couldn't generate insights right now. Try again.",
        );
      }
    },
    [accessHash, event.id],
  );

  useEffect(() => {
    loadInsights(false);
  }, [loadInsights]);

  const handleAsk = async () => {
    const question = copilotQ.trim();
    if (!question || copilotLoading) return;
    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotReply(null);
    const { data, error } = await supabase.functions.invoke("admin-auth", {
      body: { passwordHash: accessHash, action: "copilot", eventId: event.id, question },
    });
    setCopilotLoading(false);

    const payload = data as CopilotResponse | null;
    if (error || !payload?.valid) {
      setCopilotError("Couldn't reach the copilot. Try again.");
      return;
    }
    if (payload.error || !payload.answer) {
      setCopilotError("Couldn't answer that from the event data. Try rephrasing.");
      return;
    }
    setCopilotReply(payload.answer);
  };

  const comingSoon = () => toast("Export is coming soon — it lives on the Reports tab.");

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 font-display text-2xl font-black tracking-tight">WHAT OFFRIP NOTICED</div>
          <p className="font-offrip-body text-sm normal-case tracking-normal text-black/40">
            AI-generated intelligence from {event.name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadInsights(true)}
          disabled={insightsLoading}
          className="shrink-0 font-display text-[10px] font-bold tracking-widest text-black/40 transition-colors hover:text-black disabled:opacity-40"
        >
          {insightsLoading ? "…" : "Refresh"}
        </button>
      </div>

      <div className="space-y-4">
        {insightsLoading && insights.length === 0 ? (
          <div className="flex items-center gap-2 font-offrip-body text-sm normal-case tracking-normal text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the event…
          </div>
        ) : insights.length === 0 ? (
          <p className="font-offrip-body text-sm normal-case tracking-normal text-black/40">No insights yet.</p>
        ) : (
          insights.map((insight, index) => (
            <div key={index} className="border-l-4 border-[#69C0BE] bg-[#F1F1F1] py-3 pl-5">
              <div className="mb-1 font-display text-[9px] font-bold tracking-widest text-[#69C0BE]">
                INSIGHT {String(index + 1).padStart(2, "0")}
              </div>
              <p className="font-offrip-body text-sm normal-case leading-relaxed tracking-normal text-black/80">
                {insight}
              </p>
            </div>
          ))
        )}
        {insightsError && (
          <p className="font-offrip-body text-xs normal-case tracking-normal text-destructive">{insightsError}</p>
        )}
      </div>

      <div className="bg-black p-6 text-white">
        <div className="mb-2 font-display text-sm font-black tracking-tight">ORGANIZER COPILOT</div>
        <div className="mb-4 font-offrip-body text-xs normal-case tracking-normal text-white/40">
          Ask OFFRIP anything about this event.
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => setCopilotQ(question)}
              className="border border-white/20 px-3 py-2 font-display text-[10px] font-bold text-white/60 transition-colors hover:bg-white/10"
            >
              {question}
            </button>
          ))}
        </div>
        <div className="mb-3 flex gap-3">
          <input
            value={copilotQ}
            onChange={(nativeEvent) => setCopilotQ(nativeEvent.target.value)}
            onKeyDown={(nativeEvent) => nativeEvent.key === "Enter" && handleAsk()}
            placeholder="Ask about your event data..."
            className="flex-1 border border-white/20 bg-white/10 px-4 py-2.5 font-offrip-body text-sm text-white outline-none placeholder:text-white/30 focus:border-white/50"
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={copilotLoading}
            className="bg-[#69C0BE] px-4 py-2.5 font-display text-[11px] font-black tracking-widest text-black transition-colors hover:bg-white disabled:opacity-60"
          >
            {copilotLoading ? "…" : "ASK →"}
          </button>
        </div>
        {copilotError && (
          <div className="border border-white/20 px-4 py-3 font-offrip-body text-sm normal-case tracking-normal text-white/60">
            {copilotError}
          </div>
        )}
        {copilotReply && (
          <div className="border border-white/20 px-4 py-3 font-offrip-body text-sm normal-case leading-relaxed tracking-normal text-white/80">
            {copilotReply}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border border-black p-5">
        <div>
          <div className="font-display text-sm font-black">EXPORT EXECUTIVE REPORT</div>
          <div className="mt-0.5 font-offrip-body text-xs normal-case tracking-normal text-black/40">
            Suitable for CMOs, CPOs, and event sponsors.
          </div>
        </div>
        <div className="flex gap-2">
          {(["PDF", "SLIDES", "CSV"] as const).map((label) => (
            <button
              key={label}
              type="button"
              onClick={comingSoon}
              className="border border-black px-3 py-2 font-display text-[10px] font-bold tracking-widest transition-colors hover:bg-black hover:text-white"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
