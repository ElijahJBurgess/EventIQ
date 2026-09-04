import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  intentRows,
  roleRows,
  type AudienceSegment,
  type EventStats,
  type LabelCount,
} from "@/lib/enterpriseOverview";

const SEGMENT_DESCRIPTIONS: Record<string, string> = {
  "C-Suite / Executives": "Attendees at Vice President or Partner seniority.",
  "Founders": "Attendees whose role is Founder / Co-founder.",
  "Actively hiring": "Recruiters and hiring managers, plus anyone whose primary goal is to hire talent.",
  "Raising capital": "Attendees whose primary goal is to raise capital or meet investors.",
  "Seeking partnerships":
    "Brand / partnership leaders, plus anyone whose primary goal is partnerships, brand partners, or sponsorships.",
  "Open to opportunities":
    "Attendees exploring opportunities generally, meeting people without a specific ask, or looking to meet collaborators.",
};

function BreakdownRow({
  label,
  display,
  widthPct,
  color,
  detail,
}: {
  label: string;
  display: string;
  widthPct: number;
  color: string;
  detail: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex w-full items-center gap-3 normal-case tracking-normal">
          <span className="w-28 shrink-0 text-right font-offrip-body text-[11px] text-black/50">{label}</span>
          <span className="relative h-6 flex-1 bg-black/5">
            <span
              className="flex h-full items-center pl-2"
              style={{ width: `${Math.max(widthPct, 6)}%`, backgroundColor: color }}
            >
              <span className="font-display text-[10px] font-black text-black/70">{display}</span>
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs border border-black bg-white">
        <p className="font-display text-[10px] font-black tracking-widest">{label}</p>
        <p className="mt-1 font-offrip-body text-xs normal-case tracking-normal text-black/70">{detail}</p>
      </PopoverContent>
    </Popover>
  );
}

function SegmentCard({ segment, attendeeCount }: { segment: AudienceSegment; attendeeCount: number }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="block w-full border border-black/10 p-4 text-left normal-case tracking-normal transition-shadow hover:shadow-[2px_2px_0_#000]"
        >
          <span className="block font-display text-3xl font-black">{segment.count}</span>
          <span className="mt-1 block font-display text-[10px] font-bold tracking-widest text-black/50">
            {segment.label}
          </span>
          <span className="mt-0.5 block font-offrip-body text-[11px] text-black/30">
            {segment.pct}% of attendees
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs border border-black bg-white">
        <p className="font-display text-[10px] font-black tracking-widest">{segment.label}</p>
        <p className="mt-1 font-offrip-body text-xs normal-case tracking-normal text-black/70">
          {segment.count} of {attendeeCount} attendees ({segment.pct}%).{" "}
          {SEGMENT_DESCRIPTIONS[segment.label] ?? ""}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function RankedList({ title, items }: { title: string; items: LabelCount[] }) {
  return (
    <div className="ooo-border bg-card p-4">
      <h4 className="font-label text-xs mb-3">{title}</h4>
      {items.length === 0 ? (
        <p className="normal-case font-sans text-sm text-muted-foreground">No data yet</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.label}
              className="flex items-start justify-between gap-3 normal-case font-sans text-sm"
            >
              <span>
                <span className="text-muted-foreground mr-2">{index + 1}.</span>
                {item.label}
              </span>
              <span className="font-label text-xs ooo-border bg-aqua px-2 py-1 shrink-0">{item.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function AudienceTab({ event }: { event: EventStats }) {
  const attendeeCount = event.totalCheckedIn;
  const functions = roleRows(event.roleBreakdown);
  const intents = intentRows(event.intentBreakdown);

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-1 font-display text-2xl font-black tracking-tight">WHO WAS IN THE ROOM?</div>
        <p className="font-offrip-body text-sm normal-case tracking-normal text-black/40">
          {attendeeCount} attendees · {event.name}
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="mb-4 font-display text-sm font-black tracking-tight">BY FUNCTION</div>
          <div className="space-y-2">
            {functions.length === 0 ? (
              <p className="font-offrip-body text-xs normal-case tracking-normal text-black/40">No data yet.</p>
            ) : (
              functions.map((role) => (
                <BreakdownRow
                  key={role.label}
                  label={role.label}
                  display={String(role.count)}
                  widthPct={role.widthPct}
                  color="#69C0BE"
                  detail={`${role.count} of ${attendeeCount} checked-in attendees.`}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 font-display text-sm font-black tracking-tight">WHAT DID PEOPLE COME FOR?</div>
          <div className="space-y-2">
            {intents.length === 0 ? (
              <p className="font-offrip-body text-xs normal-case tracking-normal text-black/40">No data yet.</p>
            ) : (
              intents.map((intent) => (
                <BreakdownRow
                  key={intent.label}
                  label={intent.label}
                  display={`${intent.pct}%`}
                  widthPct={intent.widthPct}
                  color="#DCE86A"
                  detail={`${intent.count} attendees · ${intent.pct}% of the room.`}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {event.segments.map((segment) => (
          <SegmentCard key={segment.key} segment={segment} attendeeCount={attendeeCount} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RankedList title="Industries" items={event.topIndustries} />
        <RankedList title="Locations" items={event.topLocations} />
      </div>
    </div>
  );
}
