// Pure orchestration for self-serve account deletion. All I/O is injected as
// ports so this runs under Vitest without Deno or a live Supabase project.
//
// Deletion strategy (confirmed with the product owner): hard delete. Removing
// the auth.users row cascades to public.profiles and every table that carries an
// ON DELETE CASCADE foreign key back to it (matches, messages, meetings,
// feedback, connection_notes, connection_self_reports, match_actions,
// notifications, points, check_ins, event_registrations, sponsor_engagements) as
// well as the auth.* sub-tables. Two things do not cascade and are handled here
// first:
//   1. reports.generated_by is ON DELETE NO ACTION -- it must be nulled or the
//      profiles delete fails with a foreign key violation.
//   2. Storage objects in the profile-photos bucket have no foreign key to the
//      user at all, so they must be removed explicitly.
// An organizer (events.organizer_id, also NO ACTION) is blocked outright: we
// never want to cascade-delete an event and take every other attendee's data
// with it.

export interface AccountDeletionPorts {
  /** Number of events where this user is the organizer. */
  countOrganizedEvents(userId: string): Promise<number>;
  /** Null out reports.generated_by for this user; returns rows changed. */
  clearGeneratedReports(userId: string): Promise<number>;
  /** Remove every object under `<userId>/` in the profile-photos bucket; returns objects removed. */
  deleteProfilePhotos(userId: string): Promise<number>;
  /** Delete the auth.users row, cascading profiles and all dependent data. */
  deleteAuthUser(userId: string): Promise<void>;
}

export type AccountDeletionResult =
  | { status: "blocked_organizer"; organizedEventCount: number }
  | { status: "deleted"; clearedReports: number; deletedPhotos: number };

export async function deleteAccount(
  userId: string,
  ports: AccountDeletionPorts,
): Promise<AccountDeletionResult> {
  const organizedEventCount = await ports.countOrganizedEvents(userId);
  if (organizedEventCount > 0) {
    return { status: "blocked_organizer", organizedEventCount };
  }

  // Everything below runs before the irreversible deleteAuthUser call. Each step
  // is idempotent, so a failure here is safe to retry.
  const clearedReports = await ports.clearGeneratedReports(userId);
  const deletedPhotos = await ports.deleteProfilePhotos(userId);
  await ports.deleteAuthUser(userId);

  return { status: "deleted", clearedReports, deletedPhotos };
}
