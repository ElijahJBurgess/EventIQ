import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarPlus, CheckCircle, Download, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface OtherProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface MessageRow {
  id: string;
  sender_id: string | null;
  content: string;
  created_at: string | null;
}

interface MeetingRow {
  id: string;
  status: string;
  requester_id: string;
  recipient_id: string;
  requested_at: string;
  scheduled_at: string | null;
  location_note: string | null;
  duration_minutes: number | null;
  completed_at: string | null;
}

interface EventDateRange {
  date: string;
  end_date: string | null;
}

const ACTIVE_MEETING_STATUSES = ["requested", "accepted", "scheduled"];
const MEETING_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  const value = `${String(hours).padStart(2, "0")}:${minutes}`;
  const label = new Date(`2000-01-01T${value}:00`).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return { value, label };
});

function meetingStatusLabel(status: string, isRequester: boolean) {
  const labels: Record<string, string> = {
    requested: isRequester ? "Meeting requested — waiting on response" : "Meeting requested",
    accepted: "Meeting accepted — Ready to schedule",
    declined: "Meeting declined",
    scheduled: "Meeting scheduled",
    completed: "Meeting completed",
    cancelled: "Meeting cancelled",
  };
  return labels[status] ?? "Meeting updated";
}

const AVATAR_PALETTE = [
  "bg-aqua text-aqua-foreground",
  "bg-citron text-citron-foreground",
  "bg-vermillion text-vermillion-foreground",
  "bg-warm text-warm-foreground",
];

function avatarClasses(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatScheduledDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

interface MessageThreadProps {
  userId: string;
  matchId: string;
  eventId: string | null;
  eventName: string | null;
  other: OtherProfile;
  onBack: () => void;
  onMessagesRead: () => void | Promise<void>;
  embedded?: boolean;
}

export default function MessageThread({ userId, matchId, eventId, eventName, other, onBack, onMessagesRead, embedded = false }: MessageThreadProps) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [meeting, setMeeting] = useState<MeetingRow | null>(null);
  const [declinedRequesterIds, setDeclinedRequesterIds] = useState<string[]>([]);
  const [requestingMeeting, setRequestingMeeting] = useState(false);
  const [respondingToMeeting, setRespondingToMeeting] = useState<"accepted" | "declined" | null>(null);
  const [eventDateRange, setEventDateRange] = useState<EventDateRange | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleLocation, setScheduleLocation] = useState("");
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);
  const [completingMeeting, setCompletingMeeting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Couldn't load this conversation — try again.");
      setLoading(false);
      return false;
    }
    setMessages((data as MessageRow[]) ?? []);
    setLoading(false);
    return true;
  }, [matchId]);

  const loadMeeting = useCallback(async () => {
    const { data, error } = await supabase
      .from("meetings")
      .select("id, status, requester_id, recipient_id, requested_at, scheduled_at, location_note, duration_minutes, completed_at")
      .eq("match_id", matchId)
      .order("requested_at", { ascending: false });

    if (error) {
      toast.error("Couldn't load meeting status — try refreshing.");
      return;
    }
    const history = (data as MeetingRow[] | null) ?? [];
    setMeeting(history[0] ?? null);
    setDeclinedRequesterIds([
      ...new Set(history.filter((attempt) => attempt.status === "declined").map((attempt) => attempt.requester_id)),
    ]);
  }, [matchId]);

  const loadEventDateRange = useCallback(async () => {
    if (!eventId) {
      setEventDateRange(null);
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .select("date, end_date")
      .eq("id", eventId)
      .maybeSingle();

    if (error) {
      toast.error("Couldn't load this event's dates — try refreshing.");
      return;
    }
    setEventDateRange((data as EventDateRange | null) ?? null);
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    const loadThread = async () => {
      const loaded = await loadMessages();
      if (!loaded || cancelled) return;

      const { error } = await supabase.rpc("mark_message_thread_read", { p_match_id: matchId });
      if (error || cancelled) return;
      await onMessagesRead();
    };

    loadThread();
    loadMeeting();
    loadEventDateRange();
    return () => { cancelled = true; };
  }, [loadEventDateRange, loadMeeting, loadMessages, matchId, onMessagesRead]);

  useEffect(() => {
    if (meeting?.status !== "accepted" || !eventDateRange || scheduleDate) return;
    const today = localDateValue();
    const lastDate = eventDateRange.end_date ?? eventDateRange.date;
    setScheduleDate(today >= eventDateRange.date && today <= lastDate ? today : eventDateRange.date);
  }, [eventDateRange, meeting?.status, scheduleDate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      match_id: matchId,
      sender_id: userId,
      recipient_id: other.id,
      event_id: eventId,
      content,
    });

    setSending(false);
    if (error) {
      toast.error("Couldn't send — try again.");
      return;
    }
    setText("");
    await loadMessages();
  };

  const hasBackAndForth = messages.some((message) => message.sender_id === userId)
    && messages.some((message) => message.sender_id === other.id);
  const hasActiveMeeting = meeting ? ACTIVE_MEETING_STATUSES.includes(meeting.status) : false;
  const currentUserWasDeclined = declinedRequesterIds.includes(userId);
  const meetingRequestsClosed = declinedRequesterIds.includes(userId) && declinedRequesterIds.includes(other.id);
  const canRequestMeeting = (!meeting || ["declined", "cancelled"].includes(meeting.status))
    && !currentUserWasDeclined
    && !meetingRequestsClosed;

  const requestMeeting = async () => {
    if (!eventId || !hasBackAndForth || requestingMeeting) return;
    setRequestingMeeting(true);

    const { data: meetingHistory, error: existingError } = await supabase
      .from("meetings")
      .select("id, status, requester_id, recipient_id, requested_at, scheduled_at, location_note, duration_minutes, completed_at")
      .eq("match_id", matchId)
      .order("requested_at", { ascending: false });

    if (existingError) {
      setRequestingMeeting(false);
      toast.error("Couldn't request a meeting — try again.");
      return;
    }
    const existingMeeting = (meetingHistory as MeetingRow[] | null)?.find((attempt) => ACTIVE_MEETING_STATUSES.includes(attempt.status));
    if (existingMeeting) {
      setMeeting(existingMeeting as MeetingRow);
      setRequestingMeeting(false);
      toast.info("A meeting is already active for this conversation.");
      return;
    }
    if ((meetingHistory as MeetingRow[] | null)?.some((attempt) => attempt.status === "declined" && attempt.requester_id === userId)) {
      setRequestingMeeting(false);
      toast.info("You can't send another meeting request for this match.");
      await loadMeeting();
      return;
    }

    const { error } = await supabase.rpc("request_meeting", { p_match_id: matchId });

    setRequestingMeeting(false);
    if (error) {
      toast.error("Couldn't request a meeting — try again.");
      return;
    }

    await loadMeeting();
    toast.success(`Meeting request sent to ${other.full_name ?? "this member"}`);
  };

  const respondToMeeting = async (status: "accepted" | "declined") => {
    if (!meeting || meeting.status !== "requested" || meeting.recipient_id !== userId || respondingToMeeting) return;
    setRespondingToMeeting(status);

    const { error } = await supabase.rpc("respond_to_meeting", {
      p_meeting_id: meeting.id,
      p_response: status,
    });

    setRespondingToMeeting(null);
    if (error) {
      toast.error("Couldn't respond to this meeting — try again.");
      await loadMeeting();
      return;
    }

    await loadMeeting();
    if (status === "declined") {
      setDeclinedRequesterIds((current) => [...new Set([...current, meeting.requester_id])]);
    }
    toast.success(status === "accepted" ? "Meeting accepted — ready to schedule" : "Meeting declined");
  };

  const scheduleMeeting = async () => {
    const location = scheduleLocation.trim();
    if (!meeting || meeting.status !== "accepted" || !scheduleDate || !scheduleTime || !location || schedulingMeeting) return;

    if (eventDateRange) {
      const lastDate = eventDateRange.end_date ?? eventDateRange.date;
      if (scheduleDate < eventDateRange.date || scheduleDate > lastDate) {
        toast.error("Choose a date during the event.");
        return;
      }
    }

    const selectedDateTime = new Date(`${scheduleDate}T${scheduleTime}:00`);
    if (Number.isNaN(selectedDateTime.getTime())) {
      toast.error("Choose a valid date and time.");
      return;
    }

    setSchedulingMeeting(true);
    const { error } = await supabase.rpc("schedule_meeting", {
      p_meeting_id: meeting.id,
      p_scheduled_at: selectedDateTime.toISOString(),
      p_location_note: location,
    });

    setSchedulingMeeting(false);
    if (error) {
      toast.error("Couldn't schedule this meeting — it may already have been updated.");
      await loadMeeting();
      return;
    }

    await loadMeeting();
    toast.success("Meeting scheduled");
  };

  const addToCalendar = () => {
    if (!meeting?.scheduled_at) return;

    const startsAt = new Date(meeting.scheduled_at);
    const durationMinutes = meeting.duration_minutes ?? 30;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    const title = `Meeting with ${other.full_name ?? "OOO connection"} at ${eventName ?? "an event"}`;
    const description = "A meeting with an OOO Intelligence connection.";
    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//OOO Intelligence//Meeting Calendar Export//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${meeting.id}@ooo-intelligence`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startsAt)}`,
      `DTEND:${formatIcsDate(endsAt)}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText(meeting.location_note ?? "")}`,
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");

    const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeEventName = (eventName ?? "event").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    link.href = url;
    link.download = `ooo-meeting-${safeEventName || "event"}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const completeMeeting = async () => {
    if (!meeting || meeting.status !== "scheduled" || completingMeeting) return;
    setCompletingMeeting(true);

    const { error } = await supabase.rpc("complete_meeting", { p_meeting_id: meeting.id });

    setCompletingMeeting(false);
    if (error) {
      toast.error("Couldn't mark this meeting complete — it may already have been updated.");
      await loadMeeting();
      return;
    }

    await loadMeeting();
    toast.success("Meeting marked complete");
  };

  return (
    <div className={`${embedded ? "fixed inset-0 z-50 md:static md:z-auto" : "fixed inset-0 z-50"} bg-white flex h-full min-h-0 flex-col`}>
      <header className="bg-white border-b border-black flex items-center gap-3 px-4 py-3 shrink-0">
        <button onClick={onBack} className={`border border-black bg-white p-2 shrink-0 ${embedded ? "md:hidden" : ""}`} aria-label="Back to conversations">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar className="h-10 w-10 border-2 border-primary shrink-0">
          {other.avatar_url && <AvatarImage src={other.avatar_url} alt={other.full_name ?? "Profile photo"} />}
          <AvatarFallback className={`font-label text-xs ${avatarClasses(other.id)}`}>
            {initials(other.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-bold normal-case font-sans truncate">{other.full_name ?? "Member"}</p>
          <p className="text-[11px] text-muted-foreground normal-case font-sans truncate">
            {eventName ?? "General"}
          </p>
        </div>
      </header>

      {(meeting || (hasBackAndForth && eventId)) && (
        <div className="border-b border-black/10 bg-offrip-light-gray px-4 py-3 shrink-0">
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {meeting && (
                <span className="font-label text-xs ooo-border bg-card px-3 py-2">
                  {meetingStatusLabel(meeting.status, meeting.requester_id === userId)}
                </span>
              )}
              {meeting?.status === "requested" && meeting.recipient_id === userId && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => respondToMeeting("declined")}
                    disabled={respondingToMeeting !== null}
                    variant="outline"
                    size="sm"
                  >
                    {respondingToMeeting === "declined" ? "Declining…" : "Decline"}
                  </Button>
                  <Button
                    onClick={() => respondToMeeting("accepted")}
                    disabled={respondingToMeeting !== null}
                    size="sm"
                  >
                    {respondingToMeeting === "accepted" ? "Accepting…" : "Accept"}
                  </Button>
                </div>
              )}
              {!hasActiveMeeting && canRequestMeeting && hasBackAndForth && eventId && (
                <Button
                  onClick={requestMeeting}
                  disabled={requestingMeeting}
                  size="sm"
                >
                  {requestingMeeting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                  {requestingMeeting ? "Requesting…" : "Request a Meeting"}
                </Button>
              )}
              {meetingRequestsClosed && (
                <span className="text-sm text-muted-foreground normal-case font-sans">
                  No further meeting requests available for this match.
                </span>
              )}
            </div>

            {meeting?.status === "accepted" && (
              <div className="ooo-border bg-card p-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-label">
                  Date
                  <input
                    type="date"
                    className="mt-1 w-full ooo-border bg-card px-3 py-2 normal-case font-sans"
                    value={scheduleDate}
                    min={eventDateRange?.date}
                    max={eventDateRange?.end_date ?? eventDateRange?.date}
                    onChange={(event) => setScheduleDate(event.target.value)}
                  />
                </label>
                <label className="text-xs font-label">
                  Time
                  <select
                    className="mt-1 w-full ooo-border bg-card px-3 py-2 normal-case font-sans"
                    value={scheduleTime}
                    onChange={(event) => setScheduleTime(event.target.value)}
                  >
                    <option value="">Select a time</option>
                    {MEETING_TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-label sm:col-span-2">
                  Meeting spot
                  <input
                    type="text"
                    className="mt-1 w-full ooo-border bg-card px-3 py-2 normal-case font-sans"
                    placeholder="Main entrance or Booth 12"
                    value={scheduleLocation}
                    onChange={(event) => setScheduleLocation(event.target.value)}
                  />
                </label>
                <Button
                  className="sm:col-span-2"
                  onClick={scheduleMeeting}
                  disabled={schedulingMeeting || !scheduleDate || !scheduleTime || !scheduleLocation.trim()}
                >
                  {schedulingMeeting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {schedulingMeeting ? "Scheduling…" : "Schedule meeting"}
                </Button>
              </div>
            )}

            {meeting?.status === "scheduled" && meeting.scheduled_at && (
              <div className="ooo-border bg-card px-4 py-3 normal-case font-sans">
                <p className="font-bold">{formatScheduledDateTime(meeting.scheduled_at)}</p>
                <p className="text-sm text-muted-foreground mt-1">{meeting.location_note || "Location to be confirmed"}</p>
                <Button className="mt-3" onClick={addToCalendar} size="sm">
                  <Download className="h-4 w-4" />
                  Add to Calendar
                </Button>
                <Button className="mt-3 ml-2" onClick={completeMeeting} disabled={completingMeeting} size="sm">
                  {completingMeeting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {completingMeeting ? "Completing…" : "We Met"}
                </Button>
              </div>
            )}

            {meeting?.status === "completed" && meeting.completed_at && (
              <div className="ooo-border bg-card px-4 py-3 normal-case font-sans">
                <p className="font-bold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Meeting completed
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Marked complete {formatScheduledDateTime(meeting.completed_at)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl w-full mx-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground normal-case font-sans text-center mt-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground normal-case font-sans text-center mt-8">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === userId;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ooo-border px-4 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                  <p className="text-sm normal-case font-sans break-words">{m.content}</p>
                  <p className={`text-[10px] mt-1 normal-case font-sans ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-black bg-white p-3 shrink-0">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            className="flex-1 ooo-border bg-card px-4 py-3 normal-case font-sans"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !text.trim()} size="icon" aria-label="Send message">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
