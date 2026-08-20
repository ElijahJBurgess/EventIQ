import { describe, expect, it } from "vitest";
import { selectTopCheckedInMatches } from "./checkedInMatches";

const userId = "current-user";
const row = (otherId: string, score: number) => ({ id: `match-${otherId}`, user_a_id: userId, user_b_id: otherId, match_score: score });

describe("selectTopCheckedInMatches", () => {
  it("excludes registered-but-absent matches", () => {
    const result = selectTopCheckedInMatches([row("checked-in", 80), row("absent", 99)], userId, new Set(["checked-in"]));
    expect(result.rows.map((match) => match.user_b_id)).toEqual(["checked-in"]);
    expect(result.eligibleCount).toBe(1);
  });

  it("returns the top 10 eligible matches in descending persisted-score order", () => {
    const rows = Array.from({ length: 14 }, (_, index) => row(`person-${index}`, index * 7));
    const result = selectTopCheckedInMatches(rows.reverse(), userId, new Set(rows.map((match) => match.user_b_id)));
    expect(result.eligibleCount).toBe(14);
    expect(result.rows.map((match) => match.match_score)).toEqual([91, 84, 77, 70, 63, 56, 49, 42, 35, 28]);
  });

  it("returns every eligible match when fewer than 10 are checked in", () => {
    const result = selectTopCheckedInMatches([row("one", 30), row("two", 90), row("three", 60)], userId, new Set(["one", "two", "three"]));
    expect(result.eligibleCount).toBe(3);
    expect(result.rows.map((match) => match.match_score)).toEqual([90, 60, 30]);
  });

  it("returns an empty result when no matched profiles are checked in", () => {
    expect(selectTopCheckedInMatches([row("absent", 100)], userId, new Set())).toEqual({ eligibleCount: 0, rows: [] });
  });
});
