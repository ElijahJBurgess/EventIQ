import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  createMatchEngineHandler,
  MAX_MATCH_ENGINE_BODY_BYTES,
  type MatchEngineAuthClient,
} from "./handler.ts";

const USER_A = "8b392776-ee69-4337-92ce-f2fe8d59e5e6";
const USER_B = "c67efae2-3cb9-4c75-a3f2-5e30e1d65822";
const EVENT_A = "18e33aac-035d-4f4f-b295-c656b28d86ad";
const EVENT_B = "f89c8ee5-7e1f-47b9-8a43-45aa3649a86f";
const ORIGIN = "https://event-iq-six.vercel.app";

function createClient(options: { userId?: string; registeredEventId?: string; authError?: boolean } = {}) {
  const equalities = new Map<string, string>();
  const query = {
    select: () => query,
    eq: (column: string, value: string) => {
      equalities.set(column, value);
      return query;
    },
    maybeSingle: async () => ({
      data: equalities.get("profile_id") === options.userId &&
          equalities.get("event_id") === options.registeredEventId
        ? { id: "registration-id" }
        : null,
      error: null,
    }),
  };
  return {
    auth: {
      getUser: async () => ({
        data: { user: options.userId ? { id: options.userId } : null },
        error: options.authError ? new Error("invalid token") : null,
      }),
    },
    from: () => query,
  } as unknown as MatchEngineAuthClient;
}

function request(body: unknown, options: { token?: string; origin?: string; method?: string; contentLength?: number } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  if (options.origin) headers.set("origin", options.origin);
  if (options.contentLength) headers.set("content-length", String(options.contentLength));
  return new Request("https://example.supabase.co/functions/v1/match-engine", {
    method: options.method ?? "POST",
    headers,
    body: options.method === "OPTIONS" ? undefined : JSON.stringify(body),
  });
}

function handler(options: { userId?: string; registeredEventId?: string; authError?: boolean } = {}) {
  const calls: Array<{ userId: string; eventId: string }> = [];
  return {
    calls,
    handle: createMatchEngineHandler({
      allowedOrigins: new Set([ORIGIN]),
      createAuthClient: () => createClient(options),
      runMatching: async (userId, eventId) => {
        calls.push({ userId, eventId });
        return { matchesGenerated: 2, matchesSaved: 2, skippedDuplicates: 0 };
      },
    }),
  };
}

Deno.test("requires an Authorization bearer token", async () => {
  const { handle, calls } = handler({ userId: USER_A, registeredEventId: EVENT_A });
  const response = await handle(request({ eventId: EVENT_A }, { origin: ORIGIN }));
  assertEquals(response.status, 401);
  assertEquals(calls.length, 0);
});

Deno.test("rejects an invalid or expired JWT", async () => {
  const { handle, calls } = handler({ authError: true });
  const response = await handle(request({ eventId: EVENT_A }, { token: "invalid", origin: ORIGIN }));
  assertEquals(response.status, 401);
  assertEquals(calls.length, 0);
});

Deno.test("ignores a legacy client-supplied profileId and uses the verified identity", async () => {
  const { handle, calls } = handler({ userId: USER_A, registeredEventId: EVENT_A });
  const response = await handle(request({ eventId: EVENT_A, profileId: USER_B }, { token: "valid", origin: ORIGIN }));
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.profileId, USER_A);
  assertEquals(calls, [{ userId: USER_A, eventId: EVENT_A }]);
});

Deno.test("rejects malformed event IDs and oversized bodies", async () => {
  const first = handler({ userId: USER_A, registeredEventId: EVENT_A });
  assertEquals((await first.handle(request({ eventId: "not-a-uuid" }, { token: "valid", origin: ORIGIN }))).status, 400);

  const second = handler({ userId: USER_A, registeredEventId: EVENT_A });
  assertEquals((await second.handle(request(
    { eventId: EVENT_A },
    { token: "valid", origin: ORIGIN, contentLength: MAX_MATCH_ENGINE_BODY_BYTES + 1 },
  ))).status, 413);

  const third = handler({ userId: USER_A, registeredEventId: EVENT_A });
  assertEquals((await third.handle(request(
    { eventId: EVENT_A, padding: "x".repeat(MAX_MATCH_ENGINE_BODY_BYTES) },
    { token: "valid", origin: ORIGIN },
  ))).status, 413);
});

Deno.test("returns 403 when the authenticated user is not registered for the event", async () => {
  const { handle, calls } = handler({ userId: USER_A, registeredEventId: EVENT_A });
  const response = await handle(request({ eventId: EVENT_B }, { token: "valid", origin: ORIGIN }));
  assertEquals(response.status, 403);
  assertEquals(calls.length, 0);
});

Deno.test("runs matching only for the verified authenticated identity", async () => {
  const { handle, calls } = handler({ userId: USER_A, registeredEventId: EVENT_A });
  const response = await handle(request({ eventId: EVENT_A }, { token: "valid", origin: ORIGIN }));
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.profileId, USER_A);
  assertEquals(calls, [{ userId: USER_A, eventId: EVENT_A }]);
});

Deno.test("fails closed for unapproved browser origins", async () => {
  const { handle, calls } = handler({ userId: USER_A, registeredEventId: EVENT_A });
  const response = await handle(request({ eventId: EVENT_A }, { token: "valid", origin: "https://evil.example" }));
  assertEquals(response.status, 403);
  assertEquals(response.headers.get("access-control-allow-origin"), null);
  assertEquals(calls.length, 0);
});

Deno.test("does not return raw processing exception details", async () => {
  const handle = createMatchEngineHandler({
    allowedOrigins: new Set([ORIGIN]),
    createAuthClient: () => createClient({ userId: USER_A, registeredEventId: EVENT_A }),
    runMatching: () => Promise.reject(new Error("database password leaked in exception")),
  });
  const response = await handle(request({ eventId: EVENT_A }, { token: "valid", origin: ORIGIN }));
  const bodyText = await response.text();
  assertEquals(response.status, 500);
  assert(!bodyText.includes("database password"));
  assertEquals(bodyText, JSON.stringify({ success: false, error: "Unable to process request." }));
});
