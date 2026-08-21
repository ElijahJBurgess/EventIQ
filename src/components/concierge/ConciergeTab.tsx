import type { ConciergeMessage } from "./useConciergeSession";

interface ConciergeTabProps {
  messages: ConciergeMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  selectedEventId?: string;
  loading: boolean;
  inlineError: string | null;
  onSubmit: () => void;
  onRetry: (requestId: string) => void;
  onViewProfile: (matchId: string) => void;
  onViewMyDay: () => void;
}

const CONCIERGE_SUGGESTED_QUESTIONS = [
  "Who should I meet right now?",
  "Who can help with what I’m looking for?",
  "Why were my top matches recommended?",
  "Who am I meeting today?",
] as const;

export default function ConciergeTab({
  messages,
  draft,
  onDraftChange,
  selectedEventId,
  loading,
  inlineError,
  onSubmit,
  onRetry,
  onViewProfile,
  onViewMyDay,
}: ConciergeTabProps) {
  return (
    <section
      className="mx-auto max-w-3xl"
      aria-labelledby="concierge-heading"
      data-selected-event-id={selectedEventId}
    >
      <header className="border-b border-black pb-6">
        <p className="mb-2 font-label text-[10px] uppercase tracking-[0.24em] text-black/50">
          Your Room guide
        </p>
        <h1 id="concierge-heading" className="font-display text-4xl leading-none tracking-tight sm:text-5xl">
          OFFRIP Concierge
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-black/60">
          Concierge helps you find the right people in your current Room using your OFFRIP matches and schedule.
        </p>
      </header>

      <div
        className="mt-6 min-h-[260px] border border-black bg-offrip-light-gray p-5 sm:min-h-[320px] sm:p-6"
        role="log"
        aria-live="polite"
        aria-label="Concierge conversation"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center sm:min-h-[272px]">
            <p className="font-display text-2xl tracking-tight">Ask about your current Room.</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-black/50">
              Choose a suggested question or write your own to connect Concierge to your OFFRIP context.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[85%]" : "max-w-[85%]"}>
                <div
                  className={`border border-black px-4 py-3 text-sm ${
                    message.role === "user"
                      ? "bg-black text-white"
                      : message.tone === "error"
                        ? "border-offrip-orange bg-white text-black"
                        : message.tone === "temporary"
                          ? "bg-offrip-aqua text-black"
                          : "bg-white text-black"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
                {message.people && message.people.length > 0 && (
                  <div className="mt-2 space-y-2" aria-label="Referenced people">
                    {message.people.map((person) => (
                      <button
                        key={person.matchId}
                        type="button"
                        onClick={() => onViewProfile(person.matchId)}
                        className="block w-full border border-black bg-white p-4 text-left transition-colors hover:bg-offrip-aqua focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        aria-label={`View ${person.name}'s profile`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-display text-lg leading-none">{person.name}</p>
                            <p className="mt-1 text-xs text-black/55">
                              {[person.title, person.company].filter(Boolean).join(" · ") || "OFFRIP attendee"}
                            </p>
                          </div>
                          <span className="shrink-0 font-label text-[10px] uppercase tracking-[0.14em]">{person.matchScore}% match</span>
                        </div>
                        {person.reason && <p className="mt-3 text-xs leading-relaxed text-black/60">{person.reason}</p>}
                        <p className="mt-3 font-label text-[10px] uppercase tracking-[0.16em]">View profile →</p>
                      </button>
                    ))}
                  </div>
                )}
                {message.meetings && message.meetings.length > 0 && (
                  <div className="mt-2 space-y-2" aria-label="Referenced meetings">
                    {message.meetings.map((meeting) => (
                      <div key={meeting.meetingId} className="border border-black bg-white p-4">
                        <p className="font-display text-lg leading-none">Meeting with {meeting.otherName}</p>
                        <p className="mt-2 text-xs text-black/60">
                          {meeting.scheduledAt
                            ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(meeting.scheduledAt))
                            : "Time to be confirmed"}
                          {meeting.duration ? ` · ${meeting.duration} min` : ""}
                        </p>
                        <p className="mt-1 text-xs text-black/50">{meeting.location ?? "Location to be confirmed"}</p>
                        <button
                          type="button"
                          onClick={onViewMyDay}
                          className="mt-3 border border-black bg-black px-3 py-2 font-label text-[10px] uppercase tracking-[0.16em] text-white hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        >
                          View My Day →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {message.retryable && message.requestId && (
                  <button
                    type="button"
                    onClick={() => onRetry(message.requestId!)}
                    disabled={loading}
                    className="mt-2 border border-black bg-white px-3 py-1.5 font-label text-[10px] uppercase tracking-[0.16em] hover:bg-black hover:text-white disabled:opacity-50"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div className="max-w-[85%] border border-black bg-white px-4 py-3 text-sm text-black/55" role="status">
                Preparing secure Room context…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-black/50">Try asking</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CONCIERGE_SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onDraftChange(question)}
              className="border border-black bg-white px-3 py-2 text-left text-xs leading-snug transition-colors hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      <form className="mt-5" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <label htmlFor="concierge-question" className="sr-only">
          Ask OFFRIP Concierge
        </label>
        <div className="flex border border-black bg-white focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
          <input
            id="concierge-question"
            type="text"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Ask about people in your Room…"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-black/35"
          />
          <button
            type="submit"
            disabled={loading}
            className="border-l border-black bg-black px-5 font-label text-[10px] uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:bg-black/35"
          >
            Send
          </button>
        </div>
        {inlineError ? (
          <p className="mt-2 text-xs text-offrip-orange" role="alert">{inlineError}</p>
        ) : (
          <p className="mt-2 text-xs text-black/45">Concierge answers only from your selected Room, matches, connections, and meetings.</p>
        )}
      </form>
    </section>
  );
}
