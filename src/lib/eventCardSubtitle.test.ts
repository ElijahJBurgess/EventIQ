import { describe, expect, it } from "vitest";
import { buildEventCardSubtitle, formatEventDateRange } from "./eventCardSubtitle";

describe("formatEventDateRange", () => {
  it("formats a single readable date when there is no end date", () => {
    const result = formatEventDateRange("2026-09-08", null);
    expect(result).not.toMatch(/^\d{4}-\d{2}-\d{2}$/); // not raw ISO
    expect(result).toMatch(/2026/);
    expect(result).not.toContain("–");
  });

  it("formats a range when end date differs from and follows the start date", () => {
    const single = formatEventDateRange("2026-09-08", null);
    const range = formatEventDateRange("2026-09-08", "2026-11-30");
    expect(range).not.toBe(single);
    expect(range).toContain("–");
    expect(range.length).toBeGreaterThan(single.length);
  });

  it("shows a single date when end date equals the start date", () => {
    expect(formatEventDateRange("2026-09-08", "2026-09-08")).toBe(formatEventDateRange("2026-09-08", null));
  });

  it("falls back to the single start date when end date is before the start date", () => {
    expect(formatEventDateRange("2026-09-08", "2026-09-01")).toBe(formatEventDateRange("2026-09-08", null));
  });

  it("returns an empty string when there is no start date", () => {
    expect(formatEventDateRange(null, "2026-11-30")).toBe("");
    expect(formatEventDateRange(null, null)).toBe("");
  });
});

describe("buildEventCardSubtitle", () => {
  it("joins venue, location and date with ' · ' when all are present", () => {
    const result = buildEventCardSubtitle({
      venue: "The Foundry Hall",
      location: "Atlanta, GA",
      date: "2026-08-01",
      end_date: null,
    });
    const parts = result.split(" · ");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("The Foundry Hall");
    expect(parts[1]).toBe("Atlanta, GA");
    expect(parts[2]).toBe(formatEventDateRange("2026-08-01", null));
    expect(result).not.toMatch(/·\s*·/);
  });

  it("shows only the date with no stray separators when venue and location are blank", () => {
    const result = buildEventCardSubtitle({ venue: null, location: "", date: "2026-09-08", end_date: null });
    expect(result).toBe(formatEventDateRange("2026-09-08", null));
    expect(result).not.toContain("·");
    expect(result).toBe(result.trim());
  });

  it("uses the range format in the subtitle when end_date differs", () => {
    const result = buildEventCardSubtitle({
      venue: null,
      location: null,
      date: "2026-09-08",
      end_date: "2026-11-30",
    });
    expect(result).toBe(formatEventDateRange("2026-09-08", "2026-11-30"));
    expect(result).toContain("–");
  });

  it("drops a blank date piece too", () => {
    const result = buildEventCardSubtitle({ venue: "Venue X", location: "  ", date: null, end_date: null });
    expect(result).toBe("Venue X");
  });

  it("returns an empty string when nothing is present", () => {
    expect(buildEventCardSubtitle({ venue: null, location: null, date: null, end_date: null })).toBe("");
  });
});
