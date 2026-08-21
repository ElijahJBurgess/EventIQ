export const MAX_QUESTION_LENGTH = 1_000;
export const MAX_HISTORY_MESSAGES = 8;
export const MAX_HISTORY_MESSAGE_LENGTH = 1_000;
export const MAX_HISTORY_TOTAL_LENGTH = 6_000;
export const MAX_TIMEZONE_LENGTH = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_BODY_KEYS = new Set(["question", "eventId", "requestId", "history", "timezone"]);

export interface ConciergeHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConciergeRequestBody {
  question: string;
  eventId: string;
  requestId: string;
  history: ConciergeHistoryMessage[];
  timezone?: string;
}

interface AuthenticatedUser {
  id: string;
}

interface RegistrationQuery {
  select(columns: string): RegistrationQuery;
  eq(column: string, value: string): RegistrationQuery;
  maybeSingle(): Promise<{ data: { id: string } | null; error: unknown | null }>;
}

export interface ConciergeSupabaseClient {
  auth: {
    getUser(token: string): Promise<{
      data: { user: AuthenticatedUser | null };
      error: unknown | null;
    }>;
  };
  from(table: "event_registrations"): RegistrationQuery;
}

export interface ConciergeHandlerOptions {
  createClient: (authorizationHeader: string) => ConciergeSupabaseClient;
  allowedOrigins: ReadonlySet<string>;
  gatherContext: (
    client: ConciergeSupabaseClient,
    authenticatedUserId: string,
    eventId: string,
  ) => Promise<ConciergeContext>;
  answerQuestion: (
    context: ConciergeContext,
    question: string,
    history: ConciergeHistoryMessage[],
    timezone?: string,
  ) => Promise<ConciergeAnswer>;
  logSearch: (entry: ConciergeTelemetryEntry) => Promise<unknown>;
}

function responseHeaders(origin: string | null, allowedOrigins: ReadonlySet<string>) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  allowedOrigins: ReadonlySet<string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin, allowedOrigins),
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidTimezone(value: string) {
  if (!value || value.length > MAX_TIMEZONE_LENGTH) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function validateConciergeRequest(value: unknown):
  | { valid: true; body: ConciergeRequestBody }
  | { valid: false } {
  if (!isPlainObject(value)) return { valid: false };
  if (Object.keys(value).some((key) => !ALLOWED_BODY_KEYS.has(key))) return { valid: false };

  const question = typeof value.question === "string" ? value.question.trim() : "";
  if (!question || question.length > MAX_QUESTION_LENGTH) return { valid: false };
  if (typeof value.eventId !== "string" || !UUID_PATTERN.test(value.eventId)) return { valid: false };
  if (typeof value.requestId !== "string" || !UUID_PATTERN.test(value.requestId)) return { valid: false };

  const rawHistory = value.history ?? [];
  if (!Array.isArray(rawHistory) || rawHistory.length > MAX_HISTORY_MESSAGES) return { valid: false };

  let historyLength = 0;
  const history: ConciergeHistoryMessage[] = [];
  for (const entry of rawHistory) {
    if (!isPlainObject(entry) || Object.keys(entry).some((key) => key !== "role" && key !== "content")) {
      return { valid: false };
    }
    if (entry.role !== "user" && entry.role !== "assistant") return { valid: false };
    const content = typeof entry.content === "string" ? entry.content.trim() : "";
    if (!content || content.length > MAX_HISTORY_MESSAGE_LENGTH) return { valid: false };
    historyLength += content.length;
    if (historyLength > MAX_HISTORY_TOTAL_LENGTH) return { valid: false };
    history.push({ role: entry.role, content });
  }

  let timezone: string | undefined;
  if (value.timezone !== undefined) {
    if (typeof value.timezone !== "string" || !isValidTimezone(value.timezone)) return { valid: false };
    timezone = value.timezone;
  }

  return {
    valid: true,
    body: {
      question,
      eventId: value.eventId,
      requestId: value.requestId,
      history,
      ...(timezone ? { timezone } : {}),
    },
  };
}

export function createConciergeHandler({
  createClient,
  allowedOrigins,
  gatherContext,
  answerQuestion,
  logSearch,
}: ConciergeHandlerOptions) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    if (origin && !allowedOrigins.has(origin)) {
      return jsonResponse({ success: false, error: "Origin not allowed." }, 403, origin, allowedOrigins);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseHeaders(origin, allowedOrigins) });
    }
    if (request.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed." }, 405, origin, allowedOrigins);
    }

    const authorizationHeader = request.headers.get("authorization") ?? "";
    const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorizationHeader);
    if (!bearerMatch?.[1]) {
      return jsonResponse({ success: false, error: "Unauthorized." }, 401, origin, allowedOrigins);
    }

    let supabase: ConciergeSupabaseClient;
    let authenticatedUser: AuthenticatedUser | null = null;
    try {
      supabase = createClient(authorizationHeader);
      const { data, error } = await supabase.auth.getUser(bearerMatch[1]);
      if (error || !data.user?.id) {
        return jsonResponse({ success: false, error: "Unauthorized." }, 401, origin, allowedOrigins);
      }
      authenticatedUser = data.user;
    } catch {
      return jsonResponse({ success: false, error: "Unauthorized." }, 401, origin, allowedOrigins);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid request." }, 400, origin, allowedOrigins);
    }

    const validation = validateConciergeRequest(rawBody);
    if (!validation.valid) {
      return jsonResponse({ success: false, error: "Invalid request." }, 400, origin, allowedOrigins);
    }

    const { eventId, requestId, question, history, timezone } = validation.body;
    try {
      const { data: registration, error } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("profile_id", authenticatedUser.id)
        .eq("status", "registered")
        .maybeSingle();

      if (error) {
        console.error("Concierge registration authorization failed");
        return jsonResponse({ success: false, error: "Unable to process request." }, 500, origin, allowedOrigins);
      }
      if (!registration) {
        return jsonResponse({ success: false, error: "Access denied." }, 403, origin, allowedOrigins);
      }
    } catch {
      console.error("Concierge registration authorization failed");
      return jsonResponse({ success: false, error: "Unable to process request." }, 500, origin, allowedOrigins);
    }

    let context: ConciergeContext;
    try {
      context = await gatherContext(supabase, authenticatedUser.id, eventId);
    } catch {
      console.error("Concierge context gathering failed");
      return jsonResponse({ success: false, error: "Unable to process request." }, 500, origin, allowedOrigins);
    }

    const telemetryBase = { requestId, userId: authenticatedUser.id, eventId };
    if (context.status !== "ready") {
      try {
        await logSearch({ ...telemetryBase, status: "controlled_failure" });
      } catch {
        console.error("Concierge telemetry write failed");
      }
      return jsonResponse({
        success: true,
        requestId,
        eventId,
        context: summarizeConciergeContext(context),
        people: [],
        meetings: [],
      }, 200, origin, allowedOrigins);
    }

    let answer: ConciergeAnswer;
    try {
      answer = await answerQuestion(context, question, history, timezone);
    } catch (error) {
      console.error("Concierge provider request failed");
      try {
        const providerError = typeof error === "object" && error !== null
          ? error as { providerCode?: string; providerRequestId?: string }
          : {};
        await logSearch({
          ...telemetryBase,
          status: "provider_failure",
          ...(providerError.providerCode ? { providerErrorCode: providerError.providerCode } : {}),
          ...(providerError.providerRequestId ? { providerRequestId: providerError.providerRequestId } : {}),
        });
      } catch {
        console.error("Concierge telemetry write failed");
      }
      return jsonResponse({
        success: false,
        requestId,
        error: "Concierge is temporarily unavailable.",
      }, 502, origin, allowedOrigins);
    }

    try {
      await logSearch({
        ...telemetryBase,
        status: "success",
        recommendedMatchIds: answer.people.map((person) => person.matchId),
        providerRequestId: answer.providerRequestId,
      });
    } catch {
      console.error("Concierge telemetry write failed");
    }

    return jsonResponse({
      success: true,
      requestId,
      eventId,
      context: summarizeConciergeContext(context),
      answer: answer.answer,
      people: answer.people,
      meetings: answer.meetings,
    }, 200, origin, allowedOrigins);
  };
}
import { summarizeConciergeContext, type ConciergeContext } from "./context.ts";
import type { ConciergeAnswer } from "./openai.ts";
import type { ConciergeTelemetryEntry } from "./telemetry.ts";
