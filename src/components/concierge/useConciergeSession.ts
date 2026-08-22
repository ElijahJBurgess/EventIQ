import { useCallback, useEffect, useMemo, useState } from "react";
import {
  invokeConciergeEdge,
  type ConciergeContextStatus,
  type ConciergeHistoryItem,
  type ConciergeInvokeResult,
  type ConciergeMeetingResult,
  type ConciergePersonResult,
  type ConciergeRequestPayload,
} from "@/lib/conciergeClient";

export interface ConciergeMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  tone?: "temporary" | "controlled" | "error";
  requestId?: string;
  eventId?: string;
  history?: ConciergeHistoryItem[];
  timezone?: string;
  requestStatus?: "pending" | "succeeded" | "failed";
  retryable?: boolean;
  people?: ConciergePersonResult[];
  meetings?: ConciergeMeetingResult[];
}

interface UseConciergeSessionOptions {
  selectedEventId?: string;
  invoke?: (payload: ConciergeRequestPayload) => Promise<ConciergeInvokeResult>;
  requestIdFactory?: () => string;
  timezoneFactory?: () => string | undefined;
}

const MAX_QUESTION_LENGTH = 1_000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_TOTAL_LENGTH = 6_000;

function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function fallbackUuid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function defaultRequestId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : fallbackUuid();
}

function controlledStatusMessage(status: Exclude<ConciergeContextStatus, "ready">) {
  switch (status) {
    case "profile_completion_required":
      return "Complete your OFFRIP profile before using Concierge.";
    case "no_matches":
      return "No persisted matches are ready for this Room yet.";
    case "no_people_checked_in":
      return "No checked-in matches are available in this Room yet.";
  }
}

type ConciergeFailureKind = Extract<ConciergeInvokeResult, { ok: false }>["kind"];

function failureMessage(kind: ConciergeFailureKind) {
  switch (kind) {
    case "auth":
      return "Your session has expired. Sign in again to use Concierge.";
    case "room_access":
      return "You no longer have access to this Room. Choose another Room and try again.";
    case "rate_limit":
      return "Concierge is receiving too many requests. Please wait a moment and retry.";
    case "timeout":
      return "Concierge took too long to respond. Please retry this question.";
    case "network":
      return "Concierge couldn't connect. Check your connection and retry.";
    case "server":
      return "Concierge is temporarily unavailable. Please retry this question.";
  }
}

function buildHistory(messages: ConciergeMessage[]): ConciergeHistoryItem[] {
  const candidates = messages
    .filter((message) => (
      (message.role === "user" || message.role === "assistant")
      && message.requestStatus !== "failed"
    ))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({ role: message.role as "user" | "assistant", content: message.text.slice(0, 1_000) }));
  const bounded: ConciergeHistoryItem[] = [];
  let totalLength = 0;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (totalLength + candidate.content.length > MAX_HISTORY_TOTAL_LENGTH) continue;
    bounded.unshift(candidate);
    totalLength += candidate.content.length;
  }
  return bounded;
}

export function useConciergeSession({
  selectedEventId,
  invoke = invokeConciergeEdge,
  requestIdFactory = defaultRequestId,
  timezoneFactory = defaultTimezone,
}: UseConciergeSessionOptions) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedEventId) setInlineError(null);
  }, [selectedEventId]);

  const updateDraft = useCallback((value: string) => {
    setDraft(value);
    setInlineError(null);
  }, []);

  const execute = useCallback(async (payload: ConciergeRequestPayload) => {
    setPendingRequestId(payload.requestId);
    setInlineError(null);
    setMessages((current) => current
      .filter((message) => message.id !== `${payload.requestId}:response`)
      .map((message) => message.requestId === payload.requestId
        ? { ...message, requestStatus: "pending" as const, retryable: false }
        : message));

    const result = await invoke(payload);
    if (result.ok === true) {
      const status = result.response.context.status;
      const isReady = status === "ready";
      setMessages((current) => [
        ...current.map((message) => message.requestId === payload.requestId
          ? { ...message, requestStatus: "succeeded" as const }
          : message),
        {
          id: `${payload.requestId}:response`,
          role: isReady ? "assistant" : "system",
          text: isReady ? result.response.answer! : controlledStatusMessage(status),
          tone: isReady ? undefined : "controlled",
          requestId: payload.requestId,
          requestStatus: "succeeded",
          people: result.response.people,
          meetings: result.response.meetings,
        },
      ]);
    } else {
      setMessages((current) => [
        ...current.map((message) => message.requestId === payload.requestId
          ? { ...message, requestStatus: "failed" as const }
          : message),
        {
          id: `${payload.requestId}:response`,
          role: "system",
          text: failureMessage(result.kind),
          tone: "error",
          requestId: payload.requestId,
          requestStatus: "failed",
          retryable: true,
        },
      ]);
    }
    setPendingRequestId((current) => current === payload.requestId ? null : current);
  }, [invoke]);

  const submit = useCallback(() => {
    if (pendingRequestId) return;
    const question = draft.trim();
    if (!selectedEventId) {
      setInlineError("Select a Room before asking Concierge a question.");
      return;
    }
    if (!question) {
      setInlineError("Enter a question for Concierge.");
      return;
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      setInlineError("Keep your question under 1,000 characters.");
      return;
    }

    const requestId = requestIdFactory();
    const history = buildHistory(messages);
    const timezone = timezoneFactory();
    const payload: ConciergeRequestPayload = {
      question,
      eventId: selectedEventId,
      requestId,
      history,
      ...(timezone ? { timezone } : {}),
    };
    setMessages((current) => [...current, {
      id: requestId,
      role: "user",
      text: question,
      requestId,
      eventId: selectedEventId,
      history,
      timezone,
      requestStatus: "pending",
    }]);
    setDraft("");
    void execute(payload);
  }, [draft, execute, messages, pendingRequestId, requestIdFactory, selectedEventId, timezoneFactory]);

  const retry = useCallback((requestId: string) => {
    if (pendingRequestId) return;
    const original = messages.find((message) => message.role === "user" && message.requestId === requestId);
    if (!original?.eventId || original.requestStatus !== "failed") return;
    void execute({
      question: original.text,
      eventId: original.eventId,
      requestId,
      history: original.history ?? [],
      ...(original.timezone ? { timezone: original.timezone } : {}),
    });
  }, [execute, messages, pendingRequestId]);

  return useMemo(() => ({
    draft,
    setDraft: updateDraft,
    messages,
    loading: pendingRequestId !== null,
    inlineError,
    submit,
    retry,
  }), [draft, inlineError, messages, pendingRequestId, retry, submit, updateDraft]);
}
