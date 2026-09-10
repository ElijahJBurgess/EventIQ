export interface HomeStatsEventCandidate {
  id: string;
  date: string | null;
  end_date: string | null;
}

/**
 * Picks the event the Home tab should load its stats from: the event the user
 * most recently checked into. Home keeps showing that event's top matches /
 * Connections in Motion even after it has ended, and switches the moment the
 * user checks into a newer one — an event being "live by date" no longer
 * matters.
 *
 * `checkedInEventIdsMostRecentFirst` is the caller's checked-in registration
 * list already ordered by `checked_in_at` descending. `events` is the set of
 * published events those registrations point at (order irrelevant).
 */
export function selectHomeStatsEvent<T extends HomeStatsEventCandidate>(
  events: T[],
  checkedInEventIdsMostRecentFirst: string[],
): T | null {
  const orderedByCheckIn = checkedInEventIdsMostRecentFirst
    .map((id) => events.find((event) => event.id === id))
    .filter((event): event is T => Boolean(event));

  return orderedByCheckIn[0] ?? null;
}
