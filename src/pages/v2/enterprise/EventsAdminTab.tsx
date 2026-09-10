import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { buildRoomInsert, DEFAULT_EVENT_TYPE, type RoomFormInput } from "@/lib/roomForm";

// The owner dashboard is password-gated (admin-auth edge function), not scoped
// by Supabase auth RLS. Every write here goes through admin-auth actions running
// with the service-role key, so the owner can manage ANY event — including ones
// created by other organizers on the self-serve /v2/organizer page.

interface AdminEvent {
  id: string;
  name: string;
  venue: string | null;
  location: string | null;
  date: string | null;
  end_date: string | null;
  event_type: string | null;
  is_published: boolean;
}

interface DeleteImpact {
  matches: number;
  messages: number;
  meetings: number;
}

// Mirrors OrganizerRooms.tsx's CREATE_ERRORS — the self-serve validation
// (buildRoomInsert) is shared; only the transport differs (admin-auth action
// here vs. a direct RLS-checked insert there).
const FORM_ERRORS: Record<string, string> = {
  name_required: "Event name is required.",
  invalid_event_type: "That event type isn't allowed.",
  invalid_date: "Dates must look like 2026-09-09.",
};

function eventToForm(event: AdminEvent): RoomFormInput {
  return {
    name: event.name ?? "",
    venue: event.venue ?? "",
    location: event.location ?? "",
    date: event.date ?? "",
    endDate: event.end_date ?? "",
    // Preserved as-is (this page's create form has no event-type field), then
    // re-validated by the shared buildRoomInsert.
    eventType: event.event_type ?? DEFAULT_EVENT_TYPE,
    isPublished: event.is_published === true,
  };
}

function countLabel(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export default function EventsAdminTab({
  accessHash,
  reloadNonce,
}: {
  accessHash: string;
  reloadNonce: number;
}) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [form, setForm] = useState<RoomFormInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | "loading" | "error" | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const fieldClass = "mt-2 w-full ooo-border bg-card px-4 py-3 normal-case font-sans";
  const labelClass = "block font-label text-xs";

  const invokeAdmin = useCallback(
    async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("admin-auth", {
        body: { passwordHash: accessHash, ...body },
      });
      return { data: data as Record<string, unknown> | null, error };
    },
    [accessHash],
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await invokeAdmin({ action: "list-events" });
    setLoading(false);
    if (error || !data?.valid) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    setEvents((data.events as AdminEvent[] | undefined) ?? []);
  }, [invokeAdmin]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents, reloadNonce]);

  const updateForm = <K extends keyof RoomFormInput>(key: K, value: RoomFormInput[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const startEdit = (event: AdminEvent) => {
    setDeletingId(null);
    setDeleteImpact(null);
    setEditingId(event.id);
    setForm(eventToForm(event));
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(null);
    setMessage(null);
  };

  const submitEdit = async (nativeEvent: FormEvent) => {
    nativeEvent.preventDefault();
    if (submitting || !editingId || !form) return;
    setMessage(null);

    // Shared client-side validation + shaping — identical to OrganizerRooms.tsx.
    const built = buildRoomInsert(form);
    if (!built.ok || !built.row) {
      setMessage({ kind: "error", text: FORM_ERRORS[built.error ?? ""] ?? "Couldn't save the event." });
      return;
    }

    setSubmitting(true);
    const { data, error } = await invokeAdmin({
      action: "update-event",
      eventId: editingId,
      name: form.name,
      venue: form.venue,
      location: form.location,
      date: form.date,
      endDate: form.endDate,
      eventType: form.eventType,
      isPublished: form.isPublished,
    });
    setSubmitting(false);

    if (error || !data?.valid) {
      setMessage({ kind: "error", text: "Couldn't save the event. Your organizer session may have expired." });
      return;
    }
    if (typeof data.error === "string") {
      setMessage({ kind: "error", text: FORM_ERRORS[data.error] ?? "Couldn't save the event." });
      return;
    }

    const updated = data.event as AdminEvent;
    setEvents((prev) => prev.map((current) => (current.id === updated.id ? updated : current)));
    cancelEdit();
    setMessage({ kind: "success", text: `Updated "${updated.name}".` });
  };

  const toggleHide = async (event: AdminEvent) => {
    if (rowBusyId) return;
    setMessage(null);
    setRowBusyId(event.id);
    const nextPublished = !event.is_published;
    const { data, error } = await invokeAdmin({
      action: "set-event-published",
      eventId: event.id,
      isPublished: nextPublished,
    });
    setRowBusyId(null);

    if (error || !data?.valid || typeof data.error === "string") {
      setMessage({ kind: "error", text: "Couldn't update visibility. Try again." });
      return;
    }
    const updated = data.event as AdminEvent;
    setEvents((prev) => prev.map((current) => (current.id === updated.id ? updated : current)));
    setMessage({
      kind: "success",
      text: nextPublished ? `"${updated.name}" is visible again.` : `"${updated.name}" is hidden.`,
    });
  };

  const startDelete = async (event: AdminEvent) => {
    setEditingId(null);
    setForm(null);
    setMessage(null);
    setDeleteConfirmText("");
    setDeletingId(event.id);
    setDeleteImpact("loading");

    const { data, error } = await invokeAdmin({ action: "event-deletion-impact", eventId: event.id });
    if (error || !data?.valid || typeof data.error === "string") {
      setDeleteImpact("error");
      return;
    }
    setDeleteImpact({
      matches: Number(data.matches ?? 0),
      messages: Number(data.messages ?? 0),
      meetings: Number(data.meetings ?? 0),
    });
  };

  const cancelDelete = () => {
    setDeletingId(null);
    setDeleteImpact(null);
    setDeleteConfirmText("");
  };

  const confirmDelete = async (event: AdminEvent) => {
    if (rowBusyId || deleteConfirmText !== event.name) return;
    setRowBusyId(event.id);
    const { data, error } = await invokeAdmin({
      action: "delete-event",
      eventId: event.id,
      confirmName: deleteConfirmText,
    });
    setRowBusyId(null);

    if (error || !data?.valid || typeof data.error === "string" || data.deleted !== true) {
      setMessage({ kind: "error", text: "Couldn't delete the event. Try again." });
      return;
    }
    setEvents((prev) => prev.filter((current) => current.id !== event.id));
    cancelDelete();
    setMessage({ kind: "success", text: `Deleted "${event.name}".` });
  };

  return (
    <section>
      <div className="mb-4">
        <p className="font-label text-xs text-muted-foreground">Event management</p>
        <h3 className="text-xl mt-1">All events</h3>
        <p className="normal-case font-offrip-body text-sm text-muted-foreground mt-1">
          Every event on the platform — including ones created by organizers on the self-serve page.
          Owner access here has no ownership restriction.
        </p>
      </div>

      {message && (
        <p
          className={`normal-case font-sans text-sm mb-4 ${message.kind === "error" ? "text-destructive" : "text-emerald-600"}`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 normal-case font-sans text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
        </div>
      ) : loadError ? (
        <p className="normal-case font-sans text-sm text-destructive" role="alert">
          Couldn't load events. Your organizer session may have expired.
        </p>
      ) : events.length === 0 ? (
        <p className="normal-case font-offrip-body text-sm text-muted-foreground">
          No events yet. Create one above.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="ooo-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-label text-sm">{event.name}</span>
                <span className="font-label text-[10px] tracking-widest text-muted-foreground">
                  {event.is_published ? "PUBLISHED" : "DRAFT"}
                </span>
              </div>
              <p className="normal-case font-sans text-sm text-muted-foreground mt-1">
                {[event.event_type, event.venue, event.location, event.date].filter(Boolean).join(" · ") ||
                  "No details yet"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(event)}
                  disabled={rowBusyId !== null}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleHide(event)}
                  disabled={rowBusyId !== null}
                >
                  {rowBusyId === event.id ? "Saving…" : event.is_published ? "Hide" : "Unhide"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startDelete(event)}
                  disabled={rowBusyId !== null}
                >
                  Delete
                </Button>
              </div>

              {editingId === event.id && form && (
                <form onSubmit={submitEdit} className="mt-4 ooo-border bg-white p-4 space-y-4">
                  <h4 className="text-lg">Edit event</h4>
                  <label className={labelClass} htmlFor={`admin-event-name-${event.id}`}>
                    Event name <span className="text-destructive">*</span>
                    <input
                      id={`admin-event-name-${event.id}`}
                      className={fieldClass}
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      disabled={submitting}
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass} htmlFor={`admin-event-venue-${event.id}`}>
                      Venue
                      <input
                        id={`admin-event-venue-${event.id}`}
                        className={fieldClass}
                        value={form.venue}
                        onChange={(e) => updateForm("venue", e.target.value)}
                        disabled={submitting}
                      />
                    </label>
                    <label className={labelClass} htmlFor={`admin-event-location-${event.id}`}>
                      Location
                      <input
                        id={`admin-event-location-${event.id}`}
                        className={fieldClass}
                        value={form.location}
                        onChange={(e) => updateForm("location", e.target.value)}
                        disabled={submitting}
                      />
                    </label>
                    <label className={labelClass} htmlFor={`admin-event-date-${event.id}`}>
                      Start date
                      <input
                        id={`admin-event-date-${event.id}`}
                        type="date"
                        className={fieldClass}
                        value={form.date}
                        onChange={(e) => updateForm("date", e.target.value)}
                        disabled={submitting}
                      />
                    </label>
                    <label className={labelClass} htmlFor={`admin-event-end-date-${event.id}`}>
                      End date
                      <input
                        id={`admin-event-end-date-${event.id}`}
                        type="date"
                        className={fieldClass}
                        value={form.endDate}
                        onChange={(e) => updateForm("endDate", e.target.value)}
                        disabled={submitting}
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 font-label text-xs">
                    <input
                      type="checkbox"
                      checked={form.isPublished}
                      onChange={(e) => updateForm("isPublished", e.target.checked)}
                      disabled={submitting}
                    />
                    Publish immediately (visible to attendees)
                  </label>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {submitting ? "Saving…" : "Save changes"}
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelEdit} disabled={submitting}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {deletingId === event.id && (
                <div className="mt-4 ooo-border border-destructive bg-white p-4 space-y-3">
                  {deleteImpact === "loading" && (
                    <p className="normal-case font-sans text-sm text-muted-foreground">
                      Checking what's tied to this event…
                    </p>
                  )}
                  {deleteImpact === "error" && (
                    <p className="normal-case font-sans text-sm text-destructive" role="alert">
                      Couldn't load the impact counts. Deleting will still permanently remove every
                      match, message and meeting tied to "{event.name}". This cannot be undone.
                    </p>
                  )}
                  {deleteImpact && typeof deleteImpact === "object" && (
                    <p className="normal-case font-sans text-sm text-destructive" role="alert">
                      This will permanently delete{" "}
                      {countLabel(deleteImpact.matches, "match", "matches")},{" "}
                      {countLabel(deleteImpact.messages, "message", "messages")}, and{" "}
                      {countLabel(deleteImpact.meetings, "meeting", "meetings")} tied to "{event.name}".
                      This cannot be undone.
                    </p>
                  )}
                  <label className={labelClass} htmlFor={`admin-delete-confirm-${event.id}`}>
                    Type the event name to confirm
                    <input
                      id={`admin-delete-confirm-${event.id}`}
                      className={fieldClass}
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={cancelDelete}
                      disabled={rowBusyId === event.id}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => confirmDelete(event)}
                      disabled={deleteConfirmText !== event.name || rowBusyId === event.id}
                    >
                      {rowBusyId === event.id ? "Deleting…" : "Delete permanently"}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
