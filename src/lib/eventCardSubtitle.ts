export interface EventCardSubtitleInput {
  venue?: string | null;
  location?: string | null;
  date?: string | null;
  end_date?: string | null;
}

const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const DAY_MONTH: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

function parseDay(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * A readable date for an event card. A single date ("Sep 8, 2026") when there's
 * no end date, it equals the start, or it precedes the start (bad data);
 * otherwise a range ("Sep 8 – Nov 30, 2026", with the shared year written once).
 * Empty string when there's no start date.
 */
export function formatEventDateRange(date: string | null | undefined, endDate: string | null | undefined): string {
  const start = parseDay(date);
  if (!start) return "";
  const full = new Intl.DateTimeFormat(undefined, DAY_MONTH_YEAR);
  const end = endDate && endDate !== date ? parseDay(endDate) : null;
  if (!end || end.getTime() <= start.getTime()) {
    return full.format(start);
  }
  const startText = start.getFullYear() === end.getFullYear()
    ? new Intl.DateTimeFormat(undefined, DAY_MONTH).format(start)
    : full.format(start);
  return `${startText} – ${full.format(end)}`;
}

/**
 * The room-card subtitle: venue, location and a readable date, joined by " · "
 * with blank/null parts dropped — no leading, trailing, or doubled separators.
 */
export function buildEventCardSubtitle(ev: EventCardSubtitleInput): string {
  return [ev.venue, ev.location, formatEventDateRange(ev.date, ev.end_date)]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" · ");
}
