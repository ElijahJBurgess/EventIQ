import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  feedbackParticipationPct,
  formatDayLabel,
  funnelRows,
  type EnterpriseTab,
  type EventStats,
} from "@/lib/enterpriseOverview";

// Clicking a stat opens a plain-language definition — mirrors the prototype's
// showDef() behaviour. Keyed by the visible label.
const METRIC_DEFS: Record<string, string> = {
  "PROFILES CREATED":
    "Registered attendees who finished building their profile, whether or not they checked in.",
  "MATCHES GENERATED": "Every attendee-to-attendee match the engine produced for this event.",
  "CONNECTION REQUESTS": "Connect requests attendees sent from their matches.",
  "CONNECTIONS ACCEPTED": "Requests the other person accepted, forming a mutual connection.",
  "CONVERSATIONS STARTED":
    "Accepted connections where at least one person sent a message — a reply isn't required.",
  "MEETINGS CONFIRMED": "Meetings both people agreed to: accepted, scheduled, or already completed.",
  "OUTCOMES REPORTED": "Post-connection self-reports attendees submitted about how it went.",
  "MEETINGS SCHEDULED": "Meetings with a locked-in time — scheduled or already completed.",
  "MEETINGS COMPLETED": "Meetings marked done.",
  "FEEDBACK PARTICIPATION":
    "Share of checked-in attendees who left any event feedback or connection self-report.",
};

function StatCard({ value, label }: { value: string; label: string }) {
  const definition = METRIC_DEFS[label];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="block w-full border border-black/10 p-4 text-left normal-case tracking-normal transition-shadow hover:shadow-[2px_2px_0_#000]"
        >
          <span className="block font-display font-black text-3xl">{value}</span>
          <span className="mt-1 block font-display text-[10px] font-bold tracking-widest text-black/50">
            {label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs border border-black bg-white">
        <p className="font-display text-[10px] font-black tracking-widest">{label}</p>
        <p className="mt-1 font-offrip-body text-xs normal-case tracking-normal leading-relaxed text-black/70">
          {definition}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function SectionHeader({
  title,
  subtitle,
  onViewAll,
}: {
  title: string;
  subtitle: string;
  onViewAll: () => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-display text-sm font-black tracking-tight">{title}</h3>
        <button
          type="button"
          onClick={onViewAll}
          aria-label={`View all — ${title}`}
          className="font-display text-[10px] font-bold tracking-widest text-black/40 transition-colors hover:text-black"
        >
          VIEW ALL →
        </button>
      </div>
      <p className="font-offrip-body text-xs normal-case tracking-normal text-black/40">{subtitle}</p>
    </div>
  );
}

export default function OverviewTab({
  event,
  onNavigateTab,
}: {
  event: EventStats;
  onNavigateTab: (tab: EnterpriseTab) => void;
}) {
  const fmt = (value: number) => value.toLocaleString("en-US");
  const meetingsScheduled = event.meetingsByStatus.scheduled + event.meetingsByStatus.completed;
  const rows = funnelRows(event.funnel);
  const chartData = event.connectionsByDay.map((point) => ({ ...point, label: formatDayLabel(point.date) }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard value={fmt(event.profilesCreated)} label="PROFILES CREATED" />
        <StatCard value={fmt(event.totalMatches)} label="MATCHES GENERATED" />
        <StatCard value={fmt(event.totalConnectionRequests)} label="CONNECTION REQUESTS" />
        <StatCard value={fmt(event.connectionsByStatus.accepted)} label="CONNECTIONS ACCEPTED" />
        <StatCard value={fmt(event.conversationsStarted)} label="CONVERSATIONS STARTED" />
        <StatCard value={fmt(event.meetingsConfirmed)} label="MEETINGS CONFIRMED" />
        <StatCard value={fmt(event.outcomesReported)} label="OUTCOMES REPORTED" />
      </div>

      <section>
        <SectionHeader
          title="EXPERIENCE SIGNALS"
          subtitle="Meetings, feedback, and engagement across the event"
          onViewAll={() => onNavigateTab("outcomes")}
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard value={fmt(meetingsScheduled)} label="MEETINGS SCHEDULED" />
          <StatCard value={fmt(event.meetingsByStatus.completed)} label="MEETINGS COMPLETED" />
          <StatCard
            value={`${feedbackParticipationPct(event.feedbackParticipation)}%`}
            label="FEEDBACK PARTICIPATION"
          />
        </div>
      </section>

      <section>
        <SectionHeader
          title="CONNECTIONS OVER TIME"
          subtitle="Connections and meetings by day"
          onViewAll={() => onNavigateTab("relationships")}
        />
        {chartData.length === 0 ? (
          <p className="font-offrip-body text-xs normal-case tracking-normal text-black/40">
            No connection activity yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: "Barlow", fontWeight: 700 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fontFamily: "Barlow" }} />
              <Tooltip />
              <Bar dataKey="connections" fill="#69C0BE" name="Connections" />
              <Bar dataKey="meetings" fill="#000000" name="Meetings" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section>
        <SectionHeader
          title="RELATIONSHIP FUNNEL"
          subtitle="From profile to outcome"
          onViewAll={() => onNavigateTab("audience")}
        />
        <div className="space-y-1">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-4">
              <div className="w-36 shrink-0 text-right font-display text-[10px] font-bold text-black/40">
                {row.label}
              </div>
              <div className="relative h-8 flex-1 overflow-hidden bg-black/5">
                <div
                  className="flex h-full items-center pl-3"
                  style={{ width: `${row.widthPct}%`, backgroundColor: row.color }}
                >
                  <span className="whitespace-nowrap font-display text-[10px] font-black text-black/70">
                    {fmt(row.value)}
                  </span>
                </div>
              </div>
              <div className="w-10 shrink-0 font-display text-[10px] font-bold text-black/30">{row.pct}%</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
