import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConciergeContextStatus, ConciergeInvokeResult, ConciergeRequestPayload } from "@/lib/conciergeClient";
import { useConciergeSession } from "./useConciergeSession";

function success(status: ConciergeContextStatus = "ready"): ConciergeInvokeResult {
  return {
    ok: true,
    response: {
      success: true,
      requestId: "server-request",
      ...(status === "ready" ? { answer: "Meet Marcus. He aligns with your fundraising goal." } : {}),
      people: status === "ready" ? [{ profileId: "person-1", matchId: "match-1", name: "Marcus", title: "Investor", company: "Northstar", matchScore: 94, reason: "Fundraising fit" }] : [],
      meetings: [],
      context: {
        status,
        authenticatedUserId: "current-user",
        matchCount: 0,
        eventCount: 0,
        conversationCount: 0,
        activeMeetingCount: 0,
        allowedMatchIds: [],
        allowedProfileIds: [],
      },
    },
  };
}

const failure = (kind: Extract<ConciergeInvokeResult, { ok: false }>["kind"]): ConciergeInvokeResult => ({ ok: false, kind });

beforeEach(() => localStorage.clear());

describe("useConciergeSession", () => {
  it("sends the question, a UUID, bounded history, and timezone -- no eventId", async () => {
    const invoke = vi.fn<(payload: ConciergeRequestPayload) => Promise<ConciergeInvokeResult>>().mockResolvedValue(success());
    const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    const { result } = renderHook(() => useConciergeSession({
      invoke,
      requestIdFactory: () => ids.shift()!,
      timezoneFactory: () => "America/Los_Angeles",
    }));

    act(() => result.current.setDraft("  Who should I meet?  "));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(invoke.mock.calls[0][0]).toEqual({
      question: "Who should I meet?",
      requestId: "11111111-1111-4111-8111-111111111111",
      history: [],
      timezone: "America/Los_Angeles",
    });
    expect(invoke.mock.calls[0][0]).not.toHaveProperty("eventId");
    expect(result.current.messages.map((message) => message.text)).toContain("Meet Marcus. He aligns with your fundraising goal.");

    act(() => result.current.setDraft("And who else?"));
    act(() => result.current.submit());
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke.mock.calls[1][0]).toMatchObject({
      requestId: "22222222-2222-4222-8222-222222222222",
      history: [
        { role: "user", content: "Who should I meet?" },
        { role: "assistant", content: "Meet Marcus. He aligns with your fundraising goal." },
      ],
    });
    expect(invoke.mock.calls[1][0].requestId).not.toBe(invoke.mock.calls[0][0].requestId);
    expect(localStorage.length).toBe(0);
  });

  it("works with no options at all -- no room selection required", async () => {
    const { result } = renderHook(() => useConciergeSession());
    expect(result.current.inlineError).toBeNull();
    act(() => result.current.setDraft("Who should I meet?"));
    // submit should not require any eventId/room; it will attempt a real invoke,
    // which is fine -- we only assert it did not block on a missing room.
    act(() => result.current.submit());
    expect(result.current.inlineError).toBeNull();
    expect(result.current.messages.some((m) => m.role === "user" && m.text === "Who should I meet?")).toBe(true);
  });

  it("keeps the question visible and exposes loading while the secure request is pending", async () => {
    let resolveRequest!: (value: ConciergeInvokeResult) => void;
    const invoke = vi.fn(() => new Promise<ConciergeInvokeResult>((resolve) => { resolveRequest = resolve; }));
    const { result } = renderHook(() => useConciergeSession({
      invoke,
      requestIdFactory: () => "11111111-1111-4111-8111-111111111111",
    }));

    act(() => result.current.setDraft("Who should I meet?"));
    act(() => result.current.submit());
    expect(result.current.loading).toBe(true);
    expect(result.current.messages[0].text).toBe("Who should I meet?");

    await act(async () => resolveRequest(success()));
    expect(result.current.loading).toBe(false);
  });

  it("bounds session history to the backend message and total-length limits", async () => {
    const invoke = vi.fn<(payload: ConciergeRequestPayload) => Promise<ConciergeInvokeResult>>().mockResolvedValue(success());
    let requestNumber = 0;
    const { result } = renderHook(() => useConciergeSession({
      invoke,
      requestIdFactory: () => `request-${requestNumber += 1}`,
    }));

    for (let index = 0; index < 9; index += 1) {
      act(() => result.current.setDraft(`${index}${"x".repeat(999)}`));
      act(() => result.current.submit());
      await waitFor(() => expect(result.current.loading).toBe(false));
    }

    const finalHistory = invoke.mock.calls.at(-1)![0].history;
    expect(finalHistory.length).toBeLessThanOrEqual(8);
    expect(finalHistory.reduce((total, item) => total + item.content.length, 0)).toBeLessThanOrEqual(6_000);
  });

  it("reuses the original request ID when retrying the same failed message", async () => {
    const invoke = vi.fn<(payload: ConciergeRequestPayload) => Promise<ConciergeInvokeResult>>()
      .mockResolvedValueOnce(failure("network"))
      .mockResolvedValueOnce(success());
    const { result } = renderHook(() => useConciergeSession({
      invoke,
      requestIdFactory: () => "11111111-1111-4111-8111-111111111111",
      timezoneFactory: () => "America/Los_Angeles",
    }));
    act(() => result.current.setDraft("Who should I meet?"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.messages.some((message) => message.retryable)).toBe(true));

    act(() => result.current.retry("11111111-1111-4111-8111-111111111111"));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke.mock.calls[1][0].requestId).toBe(invoke.mock.calls[0][0].requestId);
    expect(invoke.mock.calls[1][0]).not.toHaveProperty("eventId");
  });

  it("prompts for a question when the draft is empty, without sending a request", () => {
    const invoke = vi.fn();
    const { result } = renderHook(() => useConciergeSession({ invoke }));
    act(() => result.current.setDraft("   "));
    act(() => result.current.submit());
    expect(invoke).not.toHaveBeenCalled();
    expect(result.current.inlineError).toBe("Enter a question for Concierge.");
  });

  it.each([
    ["profile_completion_required", "Complete your OFFRIP profile before using Concierge."],
    ["no_matches", "You don't have any OFFRIP matches yet. Once you're matched at an event, Concierge can help."],
  ] as const)("shows the %s controlled context state", async (status, copy) => {
    const { result } = renderHook(() => useConciergeSession({
      invoke: vi.fn().mockResolvedValue(success(status)),
      requestIdFactory: () => "11111111-1111-4111-8111-111111111111",
    }));
    act(() => result.current.setDraft("Question"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.messages.some((message) => message.text === copy)).toBe(true));
  });

  it.each([
    ["auth", "Your session has expired"],
    ["forbidden", "isn't available from here"],
    ["rate_limit", "too many requests"],
    ["timeout", "too long to respond"],
    ["network", "couldn't connect"],
    ["server", "temporarily unavailable"],
  ] as const)("shows an inline retryable %s failure", async (kind, copy) => {
    const { result } = renderHook(() => useConciergeSession({
      invoke: vi.fn().mockResolvedValue(failure(kind)),
      requestIdFactory: () => "11111111-1111-4111-8111-111111111111",
    }));
    act(() => result.current.setDraft("Question"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.messages.some((message) => message.text.includes(copy))).toBe(true));
    expect(result.current.messages.some((message) => message.retryable)).toBe(true);
  });

  it("displays only the trusted answer and references returned by the backend", async () => {
    const { result } = renderHook(() => useConciergeSession({
      invoke: vi.fn().mockResolvedValue(success()),
      requestIdFactory: () => "11111111-1111-4111-8111-111111111111",
    }));
    act(() => result.current.setDraft("Who should I meet?"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const transcript = result.current.messages.map((message) => message.text).join(" ");
    expect(transcript).toContain("Meet Marcus");
    expect(result.current.messages.at(-1)?.people?.[0].matchId).toBe("match-1");
  });
});
