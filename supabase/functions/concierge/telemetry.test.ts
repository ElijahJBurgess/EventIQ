import assert from "node:assert/strict";
import test from "node:test";
import { logConciergeSearch, type ConciergeTelemetryClient } from "./telemetry.ts";

test("logs redacted trusted metadata and validated matches", async () => {
  let row: Record<string, unknown> | undefined;
  const client: ConciergeTelemetryClient = { from: () => ({ insert: async (value) => { row = value; return { error: null }; } }) };
  const result = await logConciergeSearch(client, {
    requestId: "request-1", userId: "user-1", eventId: "event-1", status: "success",
    recommendedMatchIds: ["match-1", "match-1"], providerRequestId: "req_openai",
  });
  assert.equal(result, "inserted");
  assert.equal(row?.prompt, "[redacted]");
  assert.deepEqual(row?.recommended_matches, ["match-1"]);
  assert.deepEqual(row?.context, { source: "concierge_v1", request_id: "request-1", user_id: "user-1", event_id: "event-1", status: "success", openai_request_id: "req_openai" });
  assert.equal(JSON.stringify(row).includes("Who should I meet"), false);
});

test("treats the V1 unique request ID violation as a retry duplicate", async () => {
  const client: ConciergeTelemetryClient = { from: () => ({ insert: async () => ({ error: { code: "23505" } }) }) };
  assert.equal(await logConciergeSearch(client, { requestId: "same", userId: "user", eventId: "event", status: "provider_failure" }), "duplicate");
});

test("surfaces non-deduplication telemetry failures", async () => {
  const client: ConciergeTelemetryClient = { from: () => ({ insert: async () => ({ error: { code: "42501" } }) }) };
  await assert.rejects(() => logConciergeSearch(client, { requestId: "new", userId: "user", eventId: "event", status: "success" }));
});
