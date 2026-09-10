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

export default function OrganizerRooms() {
  const { user } = useAuth();
  const [access, setAccess] = useState<"loading" | "organizer" | "denied">("loading");
  const [rooms, setRooms] = useState<OrganizerRoom[]>([]);
  const [form, setForm] = useState<RoomFormInput>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !user) return;
    setMessage(null);

    const built = buildRoomInsert(form);
    if (!built.ok || !built.row) {
      setMessage({
        kind: "error",
        text: CREATE_ERRORS[built.error ?? ""] ?? "Couldn't create the event.",
      });
      return;
    }

    setSubmitting(true);
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

  if (access === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-label text-xl">
        Loading…
      </div>
    );
  }
  if (access === "denied") return <Navigate to="/v2" replace />;

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
          <h2 className="text-xl">Create an event</h2>
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
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Creating…" : "Create event"}
            </Button>
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
