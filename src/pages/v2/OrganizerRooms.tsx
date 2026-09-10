import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/v2/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  buildRoomInsert,
  DEFAULT_EVENT_TYPE,
  VALID_EVENT_TYPES,
  type RoomFormInput,
} from "@/lib/roomForm";

interface OrganizerRoom {
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

const ROOM_COLUMNS = "id,name,venue,location,date,end_date,event_type,is_published";

const CREATE_ERRORS: Record<string, string> = {
  name_required: "Event name is required.",
  invalid_event_type: "That event type isn't allowed.",
  invalid_date: "Dates must look like 2026-09-09.",
};

const emptyForm: RoomFormInput = {
  name: "",
  venue: "",
  location: "",
  date: "",
  endDate: "",
  eventType: DEFAULT_EVENT_TYPE,
  isPublished: false,
};

function roomToForm(room: OrganizerRoom): RoomFormInput {
  return {
    name: room.name ?? "",
    venue: room.venue ?? "",
    location: room.location ?? "",
    date: room.date ?? "",
    endDate: room.end_date ?? "",
    eventType: room.event_type ?? DEFAULT_EVENT_TYPE,
    isPublished: room.is_published === true,
  };
}

function countLabel(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export default function OrganizerRooms() {
  const { user } = useAuth();
  const [access, setAccess] = useState<"loading" | "organizer" | "denied">("loading");
  const [rooms, setRooms] = useState<OrganizerRoom[]>([]);
  const [form, setForm] = useState<RoomFormInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Per-row action state. Only one row can be mid-hide/mid-delete at a time.
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | "loading" | "error" | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const fieldClass = "mt-2 w-full ooo-border bg-card px-4 py-3 normal-case font-sans";
  const labelClass = "block font-label text-xs";

  const loadRooms = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("events")
      .select(ROOM_COLUMNS)
      .eq("organizer_id", user.id)
      .order("created_at", { ascending: false });
    setRooms((data as OrganizerRoom[] | null) ?? []);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from("profiles")
      .select("is_organizer")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const isOrganizer = (data as { is_organizer?: boolean } | null)?.is_organizer === true;
        setAccess(isOrganizer ? "organizer" : "denied");
        if (isOrganizer) void loadRooms();
      });
    return () => {
      active = false;
    };
  }, [user, loadRooms]);

  const update = <K extends keyof RoomFormInput>(key: K, value: RoomFormInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
  };

  const startEdit = (room: OrganizerRoom) => {
    setDeletingId(null);
    setDeleteImpact(null);
    setEditingId(room.id);
    setForm(roomToForm(room));
    setMessage(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !user) return;
    setMessage(null);

    // Same validation + row shaping as creation — no second code path.
    const built = buildRoomInsert(form);
    if (!built.ok || !built.row) {
      setMessage({
        kind: "error",
        text: CREATE_ERRORS[built.error ?? ""] ?? "Couldn't save the event.",
      });
      return;
    }

    setSubmitting(true);

    if (editingId) {
      const { data, error } = await supabase
        .from("events")
        .update(built.row)
        .eq("id", editingId)
        .select(ROOM_COLUMNS)
        .single();
      setSubmitting(false);

      if (error || !data) {
        setMessage({ kind: "error", text: "Couldn't save the event. Try again." });
        return;
      }

      const updated = data as OrganizerRoom;
      setRooms((prev) => prev.map((room) => (room.id === updated.id ? updated : room)));
      setEditingId(null);
      setForm(emptyForm);
      setMessage({ kind: "success", text: `Updated "${updated.name}".` });
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .insert({ ...built.row, organizer_id: user.id })
      .select(ROOM_COLUMNS)
      .single();
    setSubmitting(false);

    if (error || !data) {
      setMessage({
        kind: "error",
        text: "Couldn't create the event. Your account may not have organizer access.",
      });
      return;
    }

    setRooms((prev) => [data as OrganizerRoom, ...prev]);
    setForm(emptyForm);
    setMessage({ kind: "success", text: `Created "${(data as OrganizerRoom).name}".` });
  };

  const toggleHide = async (room: OrganizerRoom) => {
    if (rowBusyId) return;
    setMessage(null);
    setRowBusyId(room.id);
    const nextPublished = !room.is_published;
    const { data, error } = await supabase
      .from("events")
      .update({ is_published: nextPublished })
      .eq("id", room.id)
      .select(ROOM_COLUMNS)
      .single();
    setRowBusyId(null);

    if (error || !data) {
      setMessage({ kind: "error", text: "Couldn't update visibility. Try again." });
      return;
    }

    const updated = data as OrganizerRoom;
    setRooms((prev) => prev.map((current) => (current.id === updated.id ? updated : current)));
    setMessage({
      kind: "success",
      text: nextPublished ? `"${updated.name}" is visible again.` : `"${updated.name}" is hidden.`,
    });
  };

  const startDelete = async (room: OrganizerRoom) => {
    setEditingId(null);
    setMessage(null);
    setDeleteConfirmText("");
    setDeletingId(room.id);
    setDeleteImpact("loading");

    // event_deletion_impact isn't in the generated types.ts yet (known drift —
    // see README); cast like the other post-drift RPC calls in this codebase.
    const { data, error } = await supabase.rpc(
      "event_deletion_impact" as never,
      { p_event_id: room.id } as never,
    );
    const rows = (data as Array<Record<string, unknown>> | null) ?? [];
    const row = rows[0];
    if (error || !row) {
      setDeleteImpact("error");
      return;
    }
    setDeleteImpact({
      matches: Number(row.match_count ?? 0),
      messages: Number(row.message_count ?? 0),
      meetings: Number(row.meeting_count ?? 0),
    });
  };

  const cancelDelete = () => {
    setDeletingId(null);
    setDeleteImpact(null);
    setDeleteConfirmText("");
  };

  const confirmDelete = async (room: OrganizerRoom) => {
    if (rowBusyId || deleteConfirmText !== room.name) return;
    setRowBusyId(room.id);
    const { error } = await supabase.from("events").delete().eq("id", room.id);
    setRowBusyId(null);

    if (error) {
      setMessage({ kind: "error", text: "Couldn't delete the event. Try again." });
      return;
    }

    setRooms((prev) => prev.filter((current) => current.id !== room.id));
    cancelDelete();
    setMessage({ kind: "success", text: `Deleted "${room.name}".` });
  };

  if (access === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-label text-xl">
        Loading…
      </div>
    );
  }
  if (access === "denied") return <Navigate to="/v2" replace />;

  const editing = editingId !== null;

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-black">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-display text-xl tracking-tight leading-none normal-case">OFFRIP</span>
          <Link to="/v2" className="text-[10px] tracking-widest border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors">
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-3xl">Your events</h1>
        <p className="normal-case font-offrip-body text-sm text-muted-foreground mt-1">
          Events you organize. You only see and manage your own — not other organizers' events or the
          owner analytics dashboard.
        </p>

        <section className="ooo-border bg-card mt-6 p-5 sm:p-6">
          <h2 className="text-xl">{editing ? "Edit event" : "Create an event"}</h2>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className={labelClass} htmlFor="room-name">
              Event name <span className="text-destructive">*</span>
              <input
                id="room-name"
                className={fieldClass}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                disabled={submitting}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass} htmlFor="room-venue">
                Venue
                <input
                  id="room-venue"
                  className={fieldClass}
                  value={form.venue}
                  onChange={(e) => update("venue", e.target.value)}
                  disabled={submitting}
                />
              </label>
              <label className={labelClass} htmlFor="room-location">
                Location
                <input
                  id="room-location"
                  className={fieldClass}
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  disabled={submitting}
                />
              </label>
              <label className={labelClass} htmlFor="room-date">
                Start date
                <input
                  id="room-date"
                  type="date"
                  className={fieldClass}
                  value={form.date}
                  onChange={(e) => update("date", e.target.value)}
                  disabled={submitting}
                />
              </label>
              <label className={labelClass} htmlFor="room-end-date">
                End date
                <input
                  id="room-end-date"
                  type="date"
                  className={fieldClass}
                  value={form.endDate}
                  onChange={(e) => update("endDate", e.target.value)}
                  disabled={submitting}
                />
              </label>
              <label className={labelClass} htmlFor="room-type">
                Event type
                <select
                  id="room-type"
                  className={fieldClass}
                  value={form.eventType}
                  onChange={(e) => update("eventType", e.target.value)}
                  disabled={submitting}
                >
                  {VALID_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 font-label text-xs">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => update("isPublished", e.target.checked)}
                disabled={submitting}
              />
              Publish immediately (visible to attendees)
            </label>
            {message && (
              <p
                className={`normal-case font-sans text-sm ${message.kind === "error" ? "text-destructive" : "text-emerald-600"}`}
                role={message.kind === "error" ? "alert" : "status"}
              >
                {message.text}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing
                  ? submitting ? "Saving…" : "Save changes"
                  : submitting ? "Creating…" : "Create event"}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={startCreate} disabled={submitting}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="text-xl">Events you organize</h2>
          {rooms.length === 0 ? (
            <p className="normal-case font-offrip-body text-sm text-muted-foreground mt-3">
              You haven't created any events yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {rooms.map((room) => (
                <li key={room.id} className="ooo-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-label text-sm">{room.name}</span>
                    <span className="font-label text-[10px] tracking-widest text-muted-foreground">
                      {room.is_published ? "PUBLISHED" : "DRAFT"}
                    </span>
                  </div>
                  <p className="normal-case font-sans text-sm text-muted-foreground mt-1">
                    {[room.event_type, room.venue, room.location, room.date]
                      .filter(Boolean)
                      .join(" · ") || "No details yet"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(room)}
                      disabled={rowBusyId !== null}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleHide(room)}
                      disabled={rowBusyId !== null}
                    >
                      {rowBusyId === room.id ? "Saving…" : room.is_published ? "Hide" : "Unhide"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startDelete(room)}
                      disabled={rowBusyId !== null}
                    >
                      Delete
                    </Button>
                  </div>

                  {deletingId === room.id && (
                    <div className="mt-3 ooo-border border-destructive bg-white p-4 space-y-3">
                      {deleteImpact === "loading" && (
                        <p className="normal-case font-sans text-sm text-muted-foreground">
                          Checking what's tied to this event…
                        </p>
                      )}
                      {deleteImpact === "error" && (
                        <p className="normal-case font-sans text-sm text-destructive" role="alert">
                          Couldn't load the impact counts. Deleting will still permanently remove every
                          match, message and meeting tied to "{room.name}". This cannot be undone.
                        </p>
                      )}
                      {deleteImpact && typeof deleteImpact === "object" && (
                        <p className="normal-case font-sans text-sm text-destructive" role="alert">
                          This will permanently delete{" "}
                          {countLabel(deleteImpact.matches, "match", "matches")},{" "}
                          {countLabel(deleteImpact.messages, "message", "messages")}, and{" "}
                          {countLabel(deleteImpact.meetings, "meeting", "meetings")} tied to "
                          {room.name}". This cannot be undone.
                        </p>
                      )}
                      <label className={labelClass} htmlFor={`delete-confirm-${room.id}`}>
                        Type the event name to confirm
                        <input
                          id={`delete-confirm-${room.id}`}
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
                          disabled={rowBusyId === room.id}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => confirmDelete(room)}
                          disabled={deleteConfirmText !== room.name || rowBusyId === room.id}
                        >
                          {rowBusyId === room.id ? "Deleting…" : "Delete permanently"}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
