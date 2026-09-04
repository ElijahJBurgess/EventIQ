// Report composition for the Enterprise dashboard "Reports" tab. Import-clean
// (type-only import from stats.ts) so it runs under Vitest --
// see supabase/functions/admin-auth/report.test.ts.
import type { EventStats } from "./stats.ts";

// Only "executive_impact" is buildable today; the others need data we don't have.
export const BUILDABLE_REPORT_TYPE = "executive_impact";

export const KNOWN_REPORT_SECTIONS = [
  "executive_summary",
  "audience",
  "relationships",
  "outcomes",
  "ai_insights",
] as const;
export type ReportSection = (typeof KNOWN_REPORT_SECTIONS)[number];

/**
 * A plain-English recap built entirely from the aggregated EventStats -- every
 * number is present in the payload, so it is deterministically verifiable.
 */
export function buildExecutiveSummary(stats: EventStats): string {
  const checkInPct = stats.totalRegistrations > 0
    ? ` (${Math.round((stats.totalCheckedIn / stats.totalRegistrations) * 100)}%)`
    : "";
  const outcomeNoun = stats.outcomesReported === 1 ? "attendee" : "attendees";
  const ratingClause = stats.avgOverallRating !== null
    ? ` (average overall rating ${stats.avgOverallRating.toFixed(1)} out of 5)`
    : "";

  return [
    `${stats.name} drew ${stats.totalRegistrations} registered attendees, ${stats.totalCheckedIn} of whom checked in${checkInPct}.`,
    `The matching engine produced ${stats.totalMatches} matches; attendees sent ${stats.totalConnectionRequests} connection requests, and ${stats.connectionsByStatus.accepted} became mutual connections.`,
    `${stats.conversationsStarted} of those started a conversation, and ${stats.meetingsConfirmed} meetings were confirmed (${stats.meetingsByStatus.completed} completed).`,
    `${stats.outcomesReported} ${outcomeNoun} reported an outcome.`,
    `${stats.feedbackParticipation.participants} of ${stats.feedbackParticipation.checkedIn} checked-in attendees left feedback${ratingClause}.`,
  ].join(" ");
}
