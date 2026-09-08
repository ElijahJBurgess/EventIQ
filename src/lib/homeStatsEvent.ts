export interface HomeStatsEventCandidate {
  id: string;
  date: string | null;
  end_date: string | null;
}

/**
 * Picks the event the Home tab should load its stats from.
 *
 * Preference order:
 *  1. An event the user checked into whose date range includes today (live now).
 *  2. Otherwise, the event the user most recently checked into — so Home keeps
 *     showing top matches / Connections in Motion from the last event they
 *     attended even after it has ended, instead of going blank.
 *
 * `checkedInEventIdsMostRecentFirst` is the caller's checked-in registration
 * list already ordered by `checked_in_at` descending. `events` is the set of
 * published events those registrations point at (order irrelevant).
 */
export function selectHomeStatsEvent<T extends HomeStatsEventCandidate>(
  events: T[],
  checkedInEventIdsMostRecentFirst: string[],
  today: Date,
): T | null {
  const orderedByCheckIn = checkedInEventIdsMostRecentFirst
    .map((id) => events.find((event) => event.id === id))
    .filter((event): event is T => Boolean(event));

  if (orderedByCheckIn.length === 0) return null;

  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  const liveEvent = orderedByCheckIn.find((event) => {
    if (!event.date) return false;
    const start = new Date(`${event.date}T00:00:00`);
    const end = new Date(`${event.end_date ?? event.date}T00:00:00`);
    return start <= startOfToday && end >= startOfToday;
  });

  return liveEvent ?? orderedByCheckIn[0];
}
