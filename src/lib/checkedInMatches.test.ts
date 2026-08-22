import { describe, expect, it } from "vitest";
import { getViewerMatchMetrics, selectTopCheckedInMatches } from "./checkedInMatches";

const userId = "current-user";
const row = (
  otherId: string,
  aToBScore: number | null,
  aToBConfidence: number | null = 80,
  overrides: Record<string, unknown> = {},
) => ({
  id: `match-${otherId}`,
  user_a_id: userId,
  user_b_id: otherId,
  a_to_b_score: aToBScore,
  b_to_a_score: 61,
  a_to_b_confidence: aToBConfidence,
  b_to_a_confidence: 75,
  ...overrides,
});

describe("selectTopCheckedInMatches", () => {
  it("uses A→B for user A and B→A for user B", () => {
    const stored = row("person", 88, 91, { user_a_id: "person", user_b_id: userId, b_to_a_score: 73, b_to_a_confidence: 77 });
    expect(getViewerMatchMetrics(stored, userId)).toEqual({ score: 73, confidence: 77 });
    expect(getViewerMatchMetrics(row("person", 88, 91), userId)).toEqual({ score: 88, confidence: 91 });
  });

  it("keeps checked-in filtering and applies score/confidence thresholds", () => {
    const rows = [row("qualified", 60, 70), row("low-score", 59, 100), row("low-confidence", 100, 69), row("absent", 99, 99)];
    const result = selectTopCheckedInMatches(rows, userId, new Set(["qualified", "low-score", "low-confidence"]));
    expect(result.rows.map((match) => match.user_b_id)).toEqual(["qualified"]);
    expect(result.eligibleCount).toBe(1);
  });

  it("sorts by viewer score and returns at most 10", () => {
    const rows = Array.from({ length: 14 }, (_, index) => row(`person-${index}`, 60 + index, 80));
    const result = selectTopCheckedInMatches(rows.reverse(), userId, new Set(rows.map((match) => match.user_b_id)));
    expect(result.eligibleCount).toBe(14);
    expect(result.rows).toHaveLength(10);
    expect(result.rows.map((match) => match.viewerScore)).toEqual([73, 72, 71, 70, 69, 68, 67, 66, 65, 64]);
  });

  it("excludes rows with missing V2 scores or confidence", () => {
    const result = selectTopCheckedInMatches([row("missing-score", null), row("missing-confidence", 90, null)], userId, new Set(["missing-score", "missing-confidence"]));
    expect(result).toEqual({ eligibleCount: 0, rows: [] });
  });
});
