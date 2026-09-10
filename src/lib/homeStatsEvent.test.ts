import { describe, expect, it } from "vitest";
import { selectHomeStatsEvent } from "./homeStatsEvent";

describe("selectHomeStatsEvent", () => {
  it("returns the most recently checked-in event", () => {
    const events = [
      { id: "older", date: "2026-06-01", end_date: "2026-06-02" },
      { id: "recent", date: "2026-08-20", end_date: "2026-08-21" },
    ];
    // checked-in ids are ordered most-recent-first
    const result = selectHomeStatsEvent(events, ["recent", "older"]);
    expect(result?.id).toBe("recent");
  });

  it("returns the more recently checked-in event even when an older one is still within its date range", () => {
    const events = [
      // "live by date" — a wide range that would have included any plausible today
      { id: "older-still-live", date: "2000-01-01", end_date: "2100-12-31" },
      // single-day, long over, but checked into more recently
      { id: "newer-checkin", date: "2026-08-20", end_date: "2026-08-20" },
    ];
    const result = selectHomeStatsEvent(events, ["newer-checkin", "older-still-live"]);
    expect(result?.id).toBe("newer-checkin");
  });

  it("ignores events the user has not checked into", () => {
    const events = [
      { id: "not-checked-in", date: "2026-09-07", end_date: "2026-09-10" },
      { id: "checked-in-past", date: "2026-07-01", end_date: "2026-07-02" },
    ];
    const result = selectHomeStatsEvent(events, ["checked-in-past"]);
    expect(result?.id).toBe("checked-in-past");
  });

  it("returns null when there are no checked-in events", () => {
    const events = [{ id: "a", date: "2026-09-07", end_date: "2026-09-10" }];
    expect(selectHomeStatsEvent(events, [])).toBeNull();
  });

  it("returns null when no checked-in id matches a published event", () => {
    const events = [{ id: "a", date: "2026-09-07", end_date: "2026-09-10" }];
    expect(selectHomeStatsEvent(events, ["missing"])).toBeNull();
  });
});
