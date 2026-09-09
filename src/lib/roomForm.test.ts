import { describe, expect, it } from "vitest";
import { buildRoomInsert, DEFAULT_EVENT_TYPE, VALID_EVENT_TYPES, type RoomFormInput } from "./roomForm";

const base: RoomFormInput = {
  name: "Founders Mixer",
  venue: "The Wing",
  location: "Atlanta, GA",
  date: "2026-10-01",
  endDate: "",
  eventType: "Networking Event",
  isPublished: false,
};

describe("buildRoomInsert", () => {
  it("rejects a blank name", () => {
    expect(buildRoomInsert({ ...base, name: "" })).toEqual({ ok: false, row: null, error: "name_required" });
    expect(buildRoomInsert({ ...base, name: "   " })).toEqual({ ok: false, row: null, error: "name_required" });
  });

  it("trims the name and keeps the rest", () => {
    const result = buildRoomInsert({ ...base, name: "  Founders Mixer  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.name).toBe("Founders Mixer");
  });

  it("accepts every allowed event_type", () => {
    for (const eventType of VALID_EVENT_TYPES) {
      const result = buildRoomInsert({ ...base, eventType });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.row.event_type).toBe(eventType);
    }
  });

  it("rejects an event_type outside the CHECK constraint", () => {
    expect(buildRoomInsert({ ...base, eventType: "Rave" })).toEqual({ ok: false, row: null, error: "invalid_event_type" });
  });

  it("defaults a blank event_type to Networking Event", () => {
    const result = buildRoomInsert({ ...base, eventType: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.event_type).toBe(DEFAULT_EVENT_TYPE);
  });

  it("nulls blank optional text and trims the rest", () => {
    const result = buildRoomInsert({ ...base, venue: "  ", location: "  Atlanta  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.venue).toBeNull();
      expect(result.row.location).toBe("Atlanta");
    }
  });

  it("accepts ISO dates, nulls blanks, rejects malformed dates", () => {
    const ok = buildRoomInsert({ ...base, date: "2026-10-01", endDate: "" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.row.date).toBe("2026-10-01");
      expect(ok.row.end_date).toBeNull();
    }
    expect(buildRoomInsert({ ...base, date: "2026/10/01" })).toEqual({ ok: false, row: null, error: "invalid_date" });
    expect(buildRoomInsert({ ...base, endDate: "Oct 1" })).toEqual({ ok: false, row: null, error: "invalid_date" });
  });

  it("carries the is_published flag through", () => {
    const published = buildRoomInsert({ ...base, isPublished: true });
    expect(published.ok && published.row.is_published).toBe(true);
    const draft = buildRoomInsert({ ...base, isPublished: false });
    expect(draft.ok && draft.row.is_published).toBe(false);
  });

  it("never sets organizer_id — the caller attaches auth.uid()", () => {
    const result = buildRoomInsert(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect("organizer_id" in result.row).toBe(false);
  });
});
