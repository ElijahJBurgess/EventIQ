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

  it("keeps checked-in filtering but applies no score/confidence floor", () => {
    // Matches Home's behavior: any real (non-null) match to a checked-in
    // attendee is eligible, regardless of how low its score/confidence is.
    const rows = [row("high", 90, 90), row("low-score", 53, 80), row("low-confidence", 80, 30), row("absent", 99, 99)];
    const result = selectTopCheckedInMatches(rows, userId, new Set(["high", "low-score", "low-confidence"]));
    expect(result.rows.map((match) => match.user_b_id)).toEqual(["high", "low-confidence", "low-score"]);
    expect(result.eligibleCount).toBe(3);
  });

  it("includes a low-score match that the old 60/70 floor would have dropped", () => {
    const result = selectTopCheckedInMatches([row("faint", 53, 80)], userId, new Set(["faint"]));
    expect(result.rows.map((match) => match.user_b_id)).toEqual(["faint"]);
    expect(result.rows[0].viewerScore).toBe(53);
    expect(result.eligibleCount).toBe(1);
  });

  it("sorts by viewer score and returns at most 10", () => {
    const rows = Array.from({ length: 14 }, (_, index) => row(`person-${index}`, 20 + index, 80));
    const result = selectTopCheckedInMatches(rows.reverse(), userId, new Set(rows.map((match) => match.user_b_id)));
    expect(result.eligibleCount).toBe(14);
    expect(result.rows).toHaveLength(10);
    expect(result.rows.map((match) => match.viewerScore)).toEqual([33, 32, 31, 30, 29, 28, 27, 26, 25, 24]);
  });

  it("excludes rows with missing V2 scores or confidence", () => {
    const result = selectTopCheckedInMatches([row("missing-score", null), row("missing-confidence", 90, null)], userId, new Set(["missing-score", "missing-confidence"]));
    expect(result).toEqual({ eligibleCount: 0, rows: [] });
  });
});
