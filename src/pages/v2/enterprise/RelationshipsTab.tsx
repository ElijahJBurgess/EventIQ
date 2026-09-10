import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EventStats, RelationshipPair } from "@/lib/enterpriseOverview";

const PAIR_NOTES: Record<string, string> = {
  recruiters_candidates:
    "“Candidates” isn’t a captured role — this counts recruiters and hiring managers matched with corporate professionals, creators, community builders, and others.",
  enterprises_startups:
    "“Enterprises” and “Startups” aren’t captured roles — this counts corporate professionals matched with founders.",
};

function PairCard({ pair }: { pair: RelationshipPair }) {
  const note = PAIR_NOTES[pair.key];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="block w-full border border-black/10 p-5 text-left normal-case tracking-normal transition-shadow hover:shadow-[2px_2px_0_#000]"
        >
          <span className="mb-3 block font-display text-sm font-black tracking-tight" style={{ color: pair.color }}>
            {pair.label}
          </span>
          <span className="grid grid-cols-3 gap-3">
            {(
              [
                ["MATCHES", pair.matches],
                ["ACCEPTED", pair.accepted],
                ["MEETINGS", pair.meetings],
              ] as const
            ).map(([label, value]) => (
              <span key={label} className="block">
                <span className="block font-display text-2xl font-black">{value}</span>
                <span className="mt-0.5 block font-display text-[9px] font-bold tracking-wider text-black/30">
                  {label}
                </span>
              </span>
            ))}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs border border-black bg-white">
        <p className="font-display text-[10px] font-black tracking-widest" style={{ color: pair.color }}>
          {pair.label}
        </p>
        <p className="mt-1 font-offrip-body text-xs normal-case tracking-normal text-black/70">
          {pair.matches} matches · {pair.accepted} accepted · {pair.meetings} meetings
        </p>
        {note && (
          <p className="mt-2 font-offrip-body text-[11px] normal-case tracking-normal text-black/40">{note}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function HeatCell({ value, rowGroup, colGroup }: { value: number; rowGroup: string; colGroup: string }) {
  const cell = (
    <div
      className="flex h-10 w-10 items-center justify-center font-display text-[9px] font-black transition-all hover:ring-2 hover:ring-black"
      style={{
        backgroundColor: value === 0 ? "#F1F1F1" : `rgba(105, 192, 190, ${value / 100})`,
        color: value / 100 > 0.6 ? "#000000" : "#6B6B6B",
      }}
    >
      {value || "—"}
    </div>
  );
  if (value === 0) return cell;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="block normal-case tracking-normal">
          {cell}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs border border-black bg-white">
        <p className="font-display text-[10px] font-black tracking-widest">
          {rowGroup} ↔ {colGroup}
        </p>
        <p className="mt-1 font-offrip-body text-xs normal-case tracking-normal text-black/70">
          {value} / 100 relative match density
        </p>
      </PopoverContent>
    </Popover>
  );
}

function StatusCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ooo-border bg-card p-3">
      <p className="font-label text-[10px] text-muted-foreground">{label}</p>
      <p className="font-display text-2xl mt-1">{value}</p>
    </div>
  );
}

export default function RelationshipsTab({ event }: { event: EventStats }) {
  const { groups, matrix } = event.connectionHeatmap;
  const conversationRate =
    event.connectionsByStatus.accepted === 0
      ? 0
      : Math.round((event.connectionsWithConversation / event.connectionsByStatus.accepted) * 100);

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-1 font-display text-2xl font-black tracking-tight">HOW THE EVENT CONNECTED</div>
        <p className="font-offrip-body text-sm normal-case tracking-normal text-black/40">
          Cross-group relationship patterns
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {event.relationshipPairs.map((pair) => (
          <PairCard key={pair.key} pair={pair} />
        ))}
      </div>

      <div>
        <div className="mb-1 font-display text-sm font-black tracking-tight">CONNECTION HEATMAP</div>
        <p className="mb-4 font-offrip-body text-xs normal-case tracking-normal text-black/40">
          Strength of connections between attendee groups — click a cell for details
        </p>
        {groups.length === 0 ? (
          <p className="font-offrip-body text-xs normal-case tracking-normal text-black/40">Not enough data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse font-display text-[10px] font-bold">
              <thead>
                <tr>
                  <th className="w-20 p-1" />
                  {groups.map((group) => (
                    <th key={group} className="p-2 font-black tracking-wider text-black/40">
                      {group.slice(0, 4)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((rowGroup, ri) => (
                  <tr key={rowGroup}>
                    <td className="p-2 pr-3 text-right font-black tracking-wider text-black/40">
                      {rowGroup.slice(0, 4)}
                    </td>
                    {matrix[ri].map((value, ci) => (
                      <td key={groups[ci]} className="p-1">
                        <HeatCell value={value} rowGroup={rowGroup} colGroup={groups[ci]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-4 font-display text-sm font-black tracking-tight">CONNECTION & MEETING STATUS</div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatusCell label="Accepted" value={event.connectionsByStatus.accepted} />
            <StatusCell label="Declined" value={event.connectionsByStatus.declined} />
            <StatusCell label="Pending" value={event.connectionsByStatus.pending} />
            <StatusCell label="Conversation rate" value={`${conversationRate}%`} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                ["Requested", event.meetingsByStatus.requested],
                ["Accepted", event.meetingsByStatus.accepted],
                ["Declined", event.meetingsByStatus.declined],
                ["Scheduled", event.meetingsByStatus.scheduled],
                ["Completed", event.meetingsByStatus.completed],
              ] as const
            ).map(([label, value]) => (
              <StatusCell key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
