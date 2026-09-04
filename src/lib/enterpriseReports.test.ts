import { describe, expect, it } from "vitest";
import {
  REPORT_SECTIONS,
  REPORT_TYPES,
  reportDisplayTitle,
  reportSectionLabels,
  reportTypeMeta,
  type ReportRow,
} from "./enterpriseReports";

describe("REPORT_TYPES", () => {
  it("only makes Executive Impact selectable", () => {
    expect(REPORT_TYPES.filter((type) => type.available).map((type) => type.key)).toEqual(["executive_impact"]);
    for (const type of REPORT_TYPES.filter((type) => !type.available)) {
      expect(type.note).toMatch(/coming soon/i);
    }
  });
});

describe("REPORT_SECTIONS", () => {
  it("offers AI Insights and locks Executive Summary", () => {
    const keys = REPORT_SECTIONS.map((section) => section.key);
    expect(keys).toContain("ai_insights");
    expect(REPORT_SECTIONS.find((section) => section.key === "executive_summary")?.locked).toBe(true);
  });
});

describe("reportTypeMeta", () => {
  it("resolves a known key and falls back to Executive Impact", () => {
    expect(reportTypeMeta("sponsor").tag).toBe("Sponsor");
    expect(reportTypeMeta(undefined).key).toBe("executive_impact");
    expect(reportTypeMeta("nope").key).toBe("executive_impact");
  });
});

function row(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: "r1",
    event_id: "evt",
    executive_summary: "…",
    insights: [],
    raw_metrics: { meta: { reportType: "executive_impact", title: "Q3 board pack", sections: ["executive_summary", "audience", "ai_insights"] } },
    generated_at: "2026-09-03T00:00:00Z",
    ...overrides,
  };
}

describe("reportDisplayTitle", () => {
  it("uses the stored title, falling back when absent", () => {
    expect(reportDisplayTitle(row())).toBe("Q3 board pack");
    expect(reportDisplayTitle(row({ raw_metrics: { meta: {} } }))).toBe("Untitled report");
    expect(reportDisplayTitle(row({ raw_metrics: null }))).toBe("Untitled report");
  });
});

describe("reportSectionLabels", () => {
  it("maps stored section keys to labels in canonical order", () => {
    expect(reportSectionLabels(row())).toEqual(["Executive Summary", "Audience", "AI Insights"]);
    expect(reportSectionLabels(row({ raw_metrics: { meta: { sections: [] } } }))).toEqual([]);
  });
});
