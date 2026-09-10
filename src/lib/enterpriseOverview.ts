// Presentation math for the Enterprise dashboard Overview tab. The edge
// function (supabase/functions/admin-auth/stats.ts) returns raw counts; these
// helpers turn them into the percentages, bar widths and labels the tab draws.

export interface FeedbackParticipation {
  participants: number;
  checkedIn: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface ConnectionsByDayPoint {
  date: string;
  connections: number;
  meetings: number;
}

export interface IntentBreakdownEntry {
  label: string;
  count: number;
  pct: number;
}

export interface AudienceSegment {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export interface RelationshipPair {
  key: string;
  label: string;
  color: string;
  matches: number;
  accepted: number;
  meetings: number;
}

export interface ConnectionHeatmap {
  groups: string[];
  matrix: number[][];
}

/**
 * The per-event payload returned by the admin-auth `event-stats` action. Mirrors
 * `EventStats` in supabase/functions/admin-auth/stats.ts — keep the two in sync.
 */
export interface EventStats {
  id: string;
  name: string;
  date: string | null;
  totalRegistrations: number;
  totalCheckedIn: number;
  profilesCreated: number;
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
  meetingsConfirmed: number;
  connectionsByStatus: {
    accepted: number;
    declined: number;
    pending: number;
  };
  connectionsWithConversation: number;
  conversationsStarted: number;
  outcomesReported: number;
  avgOverallRating: number | null;
  avgMatchingRating: number | null;
  avgNetworkingQuality: number | null;
  selfReportsTotal: number;
  selfReportsValuable: number;
  feedbackParticipation: FeedbackParticipation;
  connectionsByDay: ConnectionsByDayPoint[];
  funnel: FunnelStage[];
  roleBreakdown: LabelCount[];
  intentBreakdown: IntentBreakdownEntry[];
  segments: AudienceSegment[];
  relationshipPairs: RelationshipPair[];
  connectionHeatmap: ConnectionHeatmap;
  topExpertise: LabelCount[];
  topInterestsAndCommunities: LabelCount[];
  topIndustries: LabelCount[];
  topLocations: LabelCount[];
}

export type EnterpriseTab =
  | "events"
  | "overview"
  | "audience"
  | "relationships"
  | "outcomes"
  | "insights"
  | "reports";

export interface FunnelRow extends FunnelStage {
  /** Share of the first stage's value, 0–100. */
  pct: number;
  /** Bar width relative to the largest stage, 0–100, floored for visibility. */
  widthPct: number;
  color: string;
}

const FUNNEL_BAR_MIN_WIDTH = 15;

// Matches the Figma Make prototype's index-based colouring.
const FUNNEL_COLORS = {
  aqua: "#69C0BE",
  lime: "#DCE86A",
  blue: "#4387F5",
  orange: "#FF5338",
  black: "#000000",
} as const;

function funnelColor(index: number): string {
  if (index === 0) return FUNNEL_COLORS.aqua;
  if (index < 3) return FUNNEL_COLORS.lime;
  if (index < 5) return FUNNEL_COLORS.blue;
  if (index < 7) return FUNNEL_COLORS.orange;
  return FUNNEL_COLORS.black;
}

export function feedbackParticipationPct({ participants, checkedIn }: FeedbackParticipation): number {
  if (checkedIn <= 0) return 0;
  return Math.round((participants / checkedIn) * 100);
}

export function formatDayLabel(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function funnelRows(funnel: FunnelStage[]): FunnelRow[] {
  const firstValue = funnel[0]?.value ?? 0;
  const maxValue = funnel.reduce((max, stage) => Math.max(max, stage.value), 0);
  return funnel.map((stage, index) => ({
    ...stage,
    pct: firstValue > 0 ? Math.round((stage.value / firstValue) * 100) : 0,
    widthPct: maxValue > 0 ? Math.max(FUNNEL_BAR_MIN_WIDTH, (stage.value / maxValue) * 100) : 0,
    color: funnelColor(index),
  }));
}

/** "By function" rows — each bar scaled against the largest function. */
export function roleRows(breakdown: LabelCount[]): Array<LabelCount & { widthPct: number }> {
  const maxCount = breakdown.reduce((max, entry) => Math.max(max, entry.count), 0);
  return breakdown.map((entry) => ({
    ...entry,
    widthPct: maxCount > 0 ? (entry.count / maxCount) * 100 : 0,
  }));
}

/** "What did people come for" rows — bar width is 3x the percentage, capped at 100. */
export function intentRows(
  breakdown: IntentBreakdownEntry[],
): Array<IntentBreakdownEntry & { widthPct: number }> {
  return breakdown.map((entry) => ({ ...entry, widthPct: Math.min(100, entry.pct * 3) }));
}
