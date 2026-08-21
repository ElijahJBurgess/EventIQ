import { describe, expect, it, vi } from "vitest";
import { invokeConciergeEdge, type ConciergeRequestPayload } from "./conciergeClient";

const payload: ConciergeRequestPayload = {
  question: "Who should I meet?",
  eventId: "room-a",
  requestId: "11111111-1111-4111-8111-111111111111",
  history: [],
  timezone: "America/Los_Angeles",
};

function client(result: { data: unknown; error: unknown }) {
  return { functions: { invoke: vi.fn().mockResolvedValue(result) } };
}

describe("invokeConciergeEdge", () => {
  it("invokes the authenticated Supabase function with the exact payload and timeout", async () => {
    const response = {
      success: true,
      requestId: payload.requestId,
      eventId: payload.eventId,
      answer: "Meet Marcus.",
      people: [],
      meetings: [],
      context: { status: "ready", authenticatedUserId: "user", event: { id: "room-a", name: "Room A" }, checkedInMatchCount: 0, conversationCount: 0, activeMeetingCount: 0, allowedMatchIds: [], allowedProfileIds: [] },
    };
    const mockClient = client({ data: response, error: null });
    await expect(invokeConciergeEdge(payload, mockClient)).resolves.toEqual({ ok: true, response });
    expect(mockClient.functions.invoke).toHaveBeenCalledWith("concierge", { body: payload, timeout: 20_000 });
  });

  it.each([
    [401, "auth"],
    [403, "room_access"],
    [429, "rate_limit"],
    [500, "server"],
  ] as const)("normalizes HTTP %s", async (status, kind) => {
    const mockClient = client({ data: null, error: { context: new Response("{}", { status }) } });
    await expect(invokeConciergeEdge(payload, mockClient)).resolves.toMatchObject({ ok: false, kind, status });
  });

  it("normalizes timeout and network failures", async () => {
    await expect(invokeConciergeEdge(payload, client({ data: null, error: { name: "AbortError", message: "timeout" } }))).resolves.toMatchObject({ ok: false, kind: "timeout" });
    await expect(invokeConciergeEdge(payload, client({ data: null, error: { name: "FunctionsFetchError", message: "Failed to fetch" } }))).resolves.toMatchObject({ ok: false, kind: "network" });
  });
});
