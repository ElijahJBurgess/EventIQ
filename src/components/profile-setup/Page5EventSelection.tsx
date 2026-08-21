import { useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EventChoice {
  id: string;
  name: string;
  date: string | null;
}

interface Page5EventSelectionProps {
  profileId: string;
  onContinue: () => void;
}

function formatEventDate(date: string | null) {
  if (!date) return "Date to be announced";
  return new Date(`${date}T00:00:00`).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Page5EventSelection({ profileId, onContinue }: Page5EventSelectionProps) {
  const [events, setEvents] = useState<EventChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("events")
      .select("id, name, date")
      .eq("is_published", true)
      .order("date", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        setEvents((data as EventChoice[] | null) ?? []);
        setLoadError(Boolean(error));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const joinEvent = async (eventId: string) => {
    setJoinError("");
    setJoiningEventId(eventId);

    const { error } = await supabase.from("event_registrations").insert({
      event_id: eventId,
      profile_id: profileId,
      registration_type: "attendee",
      status: "registered",
    });

    setJoiningEventId(null);

    if (error) {
      setJoinError("We couldn't join this event. Please try again.");
      return;
    }

    try {
      const { error: matchingError } = await supabase.functions.invoke("match-engine", {
        body: { eventId },
      });
      if (matchingError) console.error("match-engine invoke failed after event registration:", matchingError);
    } catch (matchingError) {
      console.error("match-engine invoke failed after event registration:", matchingError);
    }

    onContinue();
  };

  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-black">Which event are you at?</h1>
      <p className="text-sm text-muted-foreground normal-case font-sans mt-2 mb-8">
        Choose an event to continue, or skip if you are not attending one right now.
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground normal-case font-sans">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading events…
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => joinEvent(event.id)}
              disabled={joiningEventId !== null}
              className="w-full ooo-card bg-warm p-5 text-left hover-lift disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="block font-black normal-case font-sans">{event.name}</span>
              <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground normal-case font-sans">
                {joiningEventId === event.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarDays className="h-4 w-4" />
                )}
                {joiningEventId === event.id ? "Joining…" : formatEventDate(event.date)}
              </span>
            </button>
          ))}

          {joinError && (
            <p className="text-center text-sm text-destructive normal-case font-sans">{joinError}</p>
          )}

          {!loadError && events.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground normal-case font-sans">
              No published events are available right now.
            </p>
          )}

          {loadError && (
            <p className="py-6 text-center text-sm text-destructive normal-case font-sans">
              We could not load events right now. You can still skip and continue.
            </p>
          )}
        </div>
      )}

      <div className="mt-8 border-t-2 border-primary pt-6 text-center">
        <button
          type="button"
          onClick={onContinue}
          disabled={joiningEventId !== null}
          className="text-sm text-muted-foreground underline underline-offset-4 normal-case font-sans hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
