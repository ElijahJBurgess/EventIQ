export const MAX_MATCH_ENGINE_BODY_BYTES = 4_096;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// profileId is accepted temporarily for rolling-deployment compatibility with
// older clients, but it is never read or trusted. The canonical V1 contract is
// eventId only.
const ALLOWED_BODY_KEYS = new Set(["eventId", "profileId"]);

interface AuthenticatedUser {
  id: string;
}

interface RegistrationQuery {
  select(columns: string): RegistrationQuery;
  eq(column: string, value: string): RegistrationQuery;
  maybeSingle(): Promise<{ data: { id: string } | null; error: unknown | null }>;
}

export interface MatchEngineAuthClient {
  auth: {
    getUser(token: string): Promise<{
      data: { user: AuthenticatedUser | null };
      error: unknown | null;
    }>;
  };
  from(table: "event_registrations"): RegistrationQuery;
}

export interface MatchEngineResult {
  matchesGenerated: number;
  matchesSaved: number;
  matchesUpdated?: number;
  skippedDuplicates: number;
}

interface MatchEngineHandlerOptions {
  allowedOrigins: ReadonlySet<string>;
  createAuthClient: (authorizationHeader: string) => MatchEngineAuthClient;
  runMatching: (authenticatedUserId: string, eventId: string) => Promise<MatchEngineResult>;
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

function jsonResponse(body: unknown, status: number, origin: string | null, allowedOrigins: ReadonlySet<string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin, allowedOrigins),
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateMatchEngineRequest(value: unknown):
  | { valid: true; eventId: string }
  | { valid: false } {
  if (!isPlainObject(value)) return { valid: false };
  if (Object.keys(value).some((key) => !ALLOWED_BODY_KEYS.has(key))) return { valid: false };
  if (typeof value.eventId !== "string" || !UUID_PATTERN.test(value.eventId)) return { valid: false };
  return { valid: true, eventId: value.eventId };
}

export function createMatchEngineHandler({
  allowedOrigins,
  createAuthClient,
  runMatching,
}: MatchEngineHandlerOptions) {
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

    let authClient: MatchEngineAuthClient;
    let authenticatedUser: AuthenticatedUser | null = null;
    try {
      authClient = createAuthClient(authorizationHeader);
      const { data, error } = await authClient.auth.getUser(bearerMatch[1]);
      if (error || !data.user?.id) {
        return jsonResponse({ success: false, error: "Unauthorized." }, 401, origin, allowedOrigins);
      }
      authenticatedUser = data.user;
    } catch {
      return jsonResponse({ success: false, error: "Unauthorized." }, 401, origin, allowedOrigins);
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_MATCH_ENGINE_BODY_BYTES) {
      return jsonResponse({ success: false, error: "Request too large." }, 413, origin, allowedOrigins);
    }

    let rawText: string;
    try {
      rawText = await request.text();
    } catch {
      return jsonResponse({ success: false, error: "Invalid request." }, 400, origin, allowedOrigins);
    }
    if (new TextEncoder().encode(rawText).byteLength > MAX_MATCH_ENGINE_BODY_BYTES) {
      return jsonResponse({ success: false, error: "Request too large." }, 413, origin, allowedOrigins);
    }

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      return jsonResponse({ success: false, error: "Invalid request." }, 400, origin, allowedOrigins);
    }

    const validation = validateMatchEngineRequest(rawBody);
    if (!validation.valid) {
      return jsonResponse({ success: false, error: "Invalid request." }, 400, origin, allowedOrigins);
    }

    try {
      const { data: registration, error } = await authClient
        .from("event_registrations")
        .select("id")
        .eq("event_id", validation.eventId)
        .eq("profile_id", authenticatedUser.id)
        .maybeSingle();

      if (error) {
        console.error("Match-engine registration authorization failed");
        return jsonResponse({ success: false, error: "Unable to process request." }, 500, origin, allowedOrigins);
      }
      if (!registration) {
        return jsonResponse({ success: false, error: "Access denied." }, 403, origin, allowedOrigins);
      }
    } catch {
      console.error("Match-engine registration authorization failed");
      return jsonResponse({ success: false, error: "Unable to process request." }, 500, origin, allowedOrigins);
    }

    try {
      const result = await runMatching(authenticatedUser.id, validation.eventId);
      return jsonResponse({
        success: true,
        profileId: authenticatedUser.id,
        ...result,
      }, 200, origin, allowedOrigins);
    } catch {
      console.error("Match-engine processing failed");
      return jsonResponse({ success: false, error: "Unable to process request." }, 500, origin, allowedOrigins);
    }
  };
}
