// Validation + row shaping for the admin-auth "create-event" action. Import-clean
// (no Deno globals) so it runs under Vitest -- see createEvent.test.ts.

// Must match the events_event_type_check CHECK constraint on public.events.
export const VALID_EVENT_TYPES = [
  "Conference",
  "Networking Event",
  "Corporate Event",
  "Community Event",
  "Festival",
  "Sports/Industry Event",
  "Concert",
  "Other",
] as const;

export const DEFAULT_EVENT_TYPE = "Networking Event";

export interface EventInsertRow {
  name: string;
  venue: string | null;
  location: string | null;
  date: string | null;
  end_date: string | null;
  event_type: string;
  is_published: boolean;
  is_demo: false;
}

// Same shape without `is_demo` — an edit must never flip that flag.
export type EventUpdateRow = Omit<EventInsertRow, "is_demo">;

export type EventValidationError = "name_required" | "invalid_event_type" | "invalid_date";

export type CreateEventResult =
  | { ok: true; row: EventInsertRow }
  | { ok: false; error: EventValidationError };

export type UpdateEventResult =
  | { ok: true; row: EventUpdateRow }
  | { ok: false; error: EventValidationError };

function trimmedText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

// Returns the ISO date string, null when absent/blank, or the "invalid" sentinel.
function isoDateOrNull(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "invalid";
}

export function buildEventInsertRow(payload: Record<string, unknown>): CreateEventResult {
  const name = trimmedText(payload.name);
  if (!name) return { ok: false, error: "name_required" };

  const requestedType = typeof payload.eventType === "string" ? payload.eventType.trim() : "";
  const eventType = requestedType || DEFAULT_EVENT_TYPE;
  if (!(VALID_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return { ok: false, error: "invalid_event_type" };
  }

  const date = isoDateOrNull(payload.date);
  const endDate = isoDateOrNull(payload.endDate);
  if (date === "invalid" || endDate === "invalid") return { ok: false, error: "invalid_date" };

  return {
    ok: true,
    row: {
      name,
      venue: trimmedText(payload.venue),
      location: trimmedText(payload.location),
      date,
      end_date: endDate,
      event_type: eventType,
      is_published: payload.isPublished === true,
      is_demo: false,
    },
  };
}

// The "update-event" action's row shaping. Same validation as creation — an
// edit on the owner dashboard must behave exactly like an edit on the
// self-serve page — just without `is_demo` in the payload.
export function buildEventUpdateRow(payload: Record<string, unknown>): UpdateEventResult {
  const result = buildEventInsertRow(payload);
  if (!result.ok) return result;
  const { is_demo: _isDemo, ...row } = result.row;
  return { ok: true, row };
}
