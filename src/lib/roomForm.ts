// Client-side validation + row shaping for self-serve room creation. The
// signed-in organizer inserts straight into `events` (RLS enforces the rest),
// so there is no edge function to lean on here.
//
// This mirrors supabase/functions/admin-auth/createEvent.ts (the owner's
// password-gated path) — the two are deliberately duplicated because a Vite
// client module can't import a Deno edge-function module, and each is a dozen
// lines fully covered by its own tests.

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

export type EventType = (typeof VALID_EVENT_TYPES)[number];
export const DEFAULT_EVENT_TYPE: EventType = "Networking Event";

export interface RoomFormInput {
  name: string;
  venue: string;
  location: string;
  date: string;
  endDate: string;
  eventType: string;
  isPublished: boolean;
}

export interface RoomInsert {
  name: string;
  venue: string | null;
  location: string | null;
  date: string | null;
  end_date: string | null;
  event_type: EventType;
  is_published: boolean;
}

export type RoomFormError = "name_required" | "invalid_event_type" | "invalid_date";

// Both fields on both variants — the app's tsconfig has strictNullChecks off,
// which makes discriminated-union narrowing on `ok` unreliable.
export type BuildRoomResult =
  | { ok: true; row: RoomInsert; error: null }
  | { ok: false; row: null; error: RoomFormError };

function trimmedOrNull(value: string, max = 200): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

// ISO date string, null when blank, or the "invalid" sentinel.
function isoDateOrNull(value: string): string | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "invalid";
}

export function buildRoomInsert(input: RoomFormInput): BuildRoomResult {
  const name = trimmedOrNull(input.name);
  if (!name) return { ok: false, row: null, error: "name_required" };

  const requestedType = input.eventType.trim();
  const eventType = (requestedType || DEFAULT_EVENT_TYPE) as EventType;
  if (!(VALID_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return { ok: false, row: null, error: "invalid_event_type" };
  }

  const date = isoDateOrNull(input.date);
  const endDate = isoDateOrNull(input.endDate);
  if (date === "invalid" || endDate === "invalid") return { ok: false, row: null, error: "invalid_date" };

  return {
    ok: true,
    error: null,
    row: {
      name,
      venue: trimmedOrNull(input.venue),
      location: trimmedOrNull(input.location),
      date,
      end_date: endDate,
      event_type: eventType,
      is_published: input.isPublished === true,
    },
  };
}
