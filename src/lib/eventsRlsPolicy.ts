// Executable mirror of the Row-Level-Security policies on public.events after
// migration 20260909000000_self_serve_organizer_rooms.sql. Kept here so the
// self-serve organizer boundary is regression-tested in CI without a live DB.
// If you change the policies in that migration, change these predicates too.
//
// Effective policies:
//   "Anyone can view published events"  SELECT / public
//     USING (is_published = true OR organizer_id = auth.uid())
//   "Organizers can manage events"      ALL / authenticated
//     USING       (organizer_id = auth.uid() AND public.is_organizer())
//     WITH CHECK  (organizer_id = auth.uid() AND public.is_organizer())
//   (the old "Authenticated can insert events" INSERT policy is dropped)

export interface EventRow {
  organizer_id: string | null;
  is_published: boolean;
}

/** What a signed-in JWT reduces to for these policies. `uid` is null for anon. */
export interface AuthContext {
  uid: string | null;
  isOrganizer: boolean;
}

// "Anyone can view published events"
function viewPublishedPolicy(ctx: AuthContext, row: EventRow): boolean {
  return row.is_published === true || row.organizer_id === ctx.uid;
}

// "Organizers can manage events" — same expression for USING and WITH CHECK.
function organizerManagePolicy(ctx: AuthContext, row: EventRow): boolean {
  return ctx.uid !== null && ctx.isOrganizer === true && row.organizer_id === ctx.uid;
}

/** A row is visible if any permissive SELECT policy allows it. */
export function canSelectEvent(ctx: AuthContext, row: EventRow): boolean {
  return viewPublishedPolicy(ctx, row) || organizerManagePolicy(ctx, row);
}

/** INSERT is governed only by the manage policy's WITH CHECK now. */
export function canInsertEvent(ctx: AuthContext, row: EventRow): boolean {
  return organizerManagePolicy(ctx, row);
}

/** UPDATE needs the old row to pass USING and the new row to pass WITH CHECK. */
export function canUpdateEvent(ctx: AuthContext, before: EventRow, after: EventRow): boolean {
  return organizerManagePolicy(ctx, before) && organizerManagePolicy(ctx, after);
}

export function canDeleteEvent(ctx: AuthContext, row: EventRow): boolean {
  return organizerManagePolicy(ctx, row);
}
