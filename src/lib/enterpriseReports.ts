// Types + presentation helpers for the Enterprise dashboard "Reports" tab.
import type { EventStats } from "./enterpriseOverview";

export type ReportSectionKey = "executive_summary" | "audience" | "relationships" | "outcomes" | "ai_insights";

export interface ReportRow {
  id: string;
  event_id: string | null;
  executive_summary: string | null;
  insights: string[] | null;
  raw_metrics:
    | {
        meta?: { reportType?: string; title?: string; sections?: string[] };
        stats?: EventStats;
      }
    | null;
  generated_at: string | null;
}

export interface ReportTypeOption {
  key: string;
  /** Wizard option label. */
  label: string;
  /** Short tag shown on the report list. */
  tag: string;
  color: string;
  available: boolean;
  note?: string;
}

// Only "executive_impact" is buildable; the rest need sponsor data we don't
// have, or aren't defined yet. They still show in the wizard, disabled.
export const REPORT_TYPES: ReportTypeOption[] = [
  { key: "executive_impact", label: "Executive Impact", tag: "Executive", color: "#69C0BE", available: true },
  { key: "sponsor", label: "Sponsor", tag: "Sponsor", color: "#FF5338", available: false, note: "Needs sponsor data — coming soon" },
  { key: "recruiting", label: "Recruiting", tag: "Talent", color: "#4387F5", available: false, note: "Coming soon" },
  { key: "community", label: "Community", tag: "Portfolio", color: "#DCE86A", available: false, note: "Coming soon" },
  { key: "custom", label: "Custom", tag: "Custom", color: "#6B6B6B", available: false, note: "Coming soon" },
];

export const REPORT_SECTIONS: Array<{ key: ReportSectionKey; label: string; locked?: boolean }> = [
  { key: "executive_summary", label: "Executive Summary", locked: true },
  { key: "audience", label: "Audience" },
  { key: "relationships", label: "Relationships" },
  { key: "outcomes", label: "Outcomes" },
  { key: "ai_insights", label: "AI Insights" },
];

export function reportTypeMeta(key: string | undefined): ReportTypeOption {
  return REPORT_TYPES.find((type) => type.key === key) ?? REPORT_TYPES[0];
}

export function reportDisplayTitle(row: ReportRow): string {
  const title = row.raw_metrics?.meta?.title?.trim();
  return title && title.length > 0 ? title : "Untitled report";
}

export function reportSectionLabels(row: ReportRow): string[] {
  const keys = row.raw_metrics?.meta?.sections ?? [];
  return REPORT_SECTIONS.filter((section) => keys.includes(section.key)).map((section) => section.label);
}
