import { describe, expect, it } from "vitest";
import { buildEventInsertRow, buildEventUpdateRow, DEFAULT_EVENT_TYPE } from "./createEvent.ts";

describe("buildEventInsertRow", () => {
  it("builds a row from a full valid payload", () => {
    const result = buildEventInsertRow({
      name: "  RKL Connections  ",
      venue: " The Foundry ",
      location: " Atlanta, GA ",
      date: "2026-09-08",
      endDate: "2026-11-30",
      eventType: "Networking Event",
      isPublished: true,
    });
    expect(result).toEqual({
      ok: true,
      row: {
        name: "RKL Connections",
        venue: "The Foundry",
        location: "Atlanta, GA",
        date: "2026-09-08",
        end_date: "2026-11-30",
        event_type: "Networking Event",
        is_published: true,
        is_demo: false,
      },
    });
  });

  it("rejects a missing name", () => {
    expect(buildEventInsertRow({}).ok).toBe(false);
    expect(buildEventInsertRow({})).toEqual({ ok: false, error: "name_required" });
  });

  it("rejects a blank / whitespace-only name", () => {
    expect(buildEventInsertRow({ name: "   " })).toEqual({ ok: false, error: "name_required" });
    expect(buildEventInsertRow({ name: 42 })).toEqual({ ok: false, error: "name_required" });
  });

  it("defaults event_type to a value the CHECK constraint accepts", () => {
    const result = buildEventInsertRow({ name: "Room" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.event_type).toBe(DEFAULT_EVENT_TYPE);
  });

  it("rejects an event_type outside the allowed set", () => {
    expect(buildEventInsertRow({ name: "Room", eventType: "Party" })).toEqual({
      ok: false,
      error: "invalid_event_type",
    });
  });

  it("accepts any of the allowed event types", () => {
    const result = buildEventInsertRow({ name: "Room", eventType: "Conference" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.event_type).toBe("Conference");
  });

  it("treats blank venue / location as null and never returns empty strings", () => {
    const result = buildEventInsertRow({ name: "Room", venue: "", location: "   " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.venue).toBeNull();
      expect(result.row.location).toBeNull();
    }
  });

  it("treats blank / missing dates as null", () => {
    const result = buildEventInsertRow({ name: "Room" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.date).toBeNull();
      expect(result.row.end_date).toBeNull();
    }
  });

  it("rejects a non-ISO date", () => {
    expect(buildEventInsertRow({ name: "Room", date: "09/08/2026" })).toEqual({
      ok: false,
      error: "invalid_date",
    });
    expect(buildEventInsertRow({ name: "Room", endDate: "next tuesday" })).toEqual({
      ok: false,
      error: "invalid_date",
    });
  });

  it("defaults is_published to false and forces is_demo to false", () => {
    const result = buildEventInsertRow({ name: "Room" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.is_published).toBe(false);
      expect(result.row.is_demo).toBe(false);
    }
    const truthyButNotBoolean = buildEventInsertRow({ name: "Room", isPublished: "yes" });
    if (truthyButNotBoolean.ok) expect(truthyButNotBoolean.row.is_published).toBe(false);
  });
});

describe("buildEventUpdateRow", () => {
  it("shapes a valid payload the same as create, minus is_demo", () => {
    const result = buildEventUpdateRow({
      name: "  Renamed Event ",
      venue: " New Venue ",
      location: "",
      date: "2026-10-01",
      endDate: "2026-10-02",
      eventType: "Conference",
      isPublished: true,
    });
    expect(result).toEqual({
      ok: true,
      row: {
        name: "Renamed Event",
        venue: "New Venue",
        location: null,
        date: "2026-10-01",
        end_date: "2026-10-02",
        event_type: "Conference",
        is_published: true,
      },
    });
    if (result.ok) expect(result.row).not.toHaveProperty("is_demo");
  });

  it("rejects the same invalid payloads as create", () => {
    expect(buildEventUpdateRow({}).ok).toBe(false);
    expect(buildEventUpdateRow({})).toEqual({ ok: false, error: "name_required" });
    expect(buildEventUpdateRow({ name: "X", eventType: "Party" })).toEqual({
      ok: false,
      error: "invalid_event_type",
    });
    expect(buildEventUpdateRow({ name: "X", date: "10/01/2026" })).toEqual({
      ok: false,
      error: "invalid_date",
    });
  });

  it("defaults event_type when the payload omits it (parity with create)", () => {
    const result = buildEventUpdateRow({ name: "X" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.event_type).toBe(DEFAULT_EVENT_TYPE);
  });
});
