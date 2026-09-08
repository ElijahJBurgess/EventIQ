import { describe, expect, it } from "vitest";
import { selectHomeStatsEvent } from "./homeStatsEvent";

const TODAY = new Date("2026-09-08T15:00:00");

describe("selectHomeStatsEvent", () => {
  it("returns the event whose date range includes today", () => {
    const events = [
      { id: "past", date: "2026-08-01", end_date: "2026-08-03" },
      { id: "live", date: "2026-09-07", end_date: "2026-09-10" },
    ];
    const result = selectHomeStatsEvent(events, ["live", "past"], TODAY);
    expect(result?.id).toBe("live");
  });

  it("treats a single-day event (no end_date) on today as live", () => {
    const events = [{ id: "oneday", date: "2026-09-08", end_date: null }];
    const result = selectHomeStatsEvent(events, ["oneday"], TODAY);
    expect(result?.id).toBe("oneday");
  });

  it("falls back to the most recently checked-in event when nothing is live today", () => {
    const events = [
      { id: "older", date: "2026-06-01", end_date: "2026-06-02" },
      { id: "recent", date: "2026-08-20", end_date: "2026-08-21" },
    ];
    // checked-in ids are ordered most-recent-first
    const result = selectHomeStatsEvent(events, ["recent", "older"], TODAY);
    expect(result?.id).toBe("recent");
  });

  it("prefers a live event over a more recently checked-in past event", () => {
    const events = [
      { id: "live", date: "2026-09-01", end_date: "2026-09-30" },
      { id: "recent-past", date: "2026-09-05", end_date: "2026-09-06" },
    ];
    // user checked into the past event more recently than the live one
    const result = selectHomeStatsEvent(events, ["recent-past", "live"], TODAY);
    expect(result?.id).toBe("live");
  });

  it("ignores events the user has not checked into", () => {
    const events = [
      { id: "not-checked-in", date: "2026-09-07", end_date: "2026-09-10" },
      { id: "checked-in-past", date: "2026-07-01", end_date: "2026-07-02" },
    ];
    const result = selectHomeStatsEvent(events, ["checked-in-past"], TODAY);
    expect(result?.id).toBe("checked-in-past");
  });

  it("returns null when there are no checked-in events", () => {
    const events = [{ id: "a", date: "2026-09-07", end_date: "2026-09-10" }];
    expect(selectHomeStatsEvent(events, [], TODAY)).toBeNull();
  });

  it("returns null when no checked-in id matches a published event", () => {
    const events = [{ id: "a", date: "2026-09-07", end_date: "2026-09-10" }];
    expect(selectHomeStatsEvent(events, ["missing"], TODAY)).toBeNull();
  });
});
