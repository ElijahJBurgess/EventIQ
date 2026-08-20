import { describe, expect, it } from "vitest";
import {
  buildConnectionSummary,
  type ConnectionMeetingFact,
  type ConnectionMessageFact,
} from "./connectionSummary";

const USER = "avery";
const OTHER = "marcus";

function message(overrides: Partial<ConnectionMessageFact> = {}): ConnectionMessageFact {
  return {
    id: "message-1",
    match_id: "match-1",
    event_id: "event-1",
    sender_id: USER,
    recipient_id: OTHER,
    message_type: "connect_request",
    created_at: "2026-08-19T10:00:00Z",
    ...overrides,
  };
}

function meeting(overrides: Partial<ConnectionMeetingFact> = {}): ConnectionMeetingFact {
  return {
    id: "meeting-1",
    event_id: "event-1",
    requester_id: USER,
    recipient_id: OTHER,
    status: "requested",
    requested_at: "2026-08-19T11:00:00Z",
    completed_at: null,
    ...overrides,
  };
}

describe("buildConnectionSummary", () => {
  it("counts a request-only message as one conversation and one in-motion person, not someone met", () => {
    const summary = buildConnectionSummary(USER, [message()], []);
    expect(summary).toMatchObject({ conversationCount: 1, peopleMetCount: 0, inMotionCount: 1 });
    expect(summary.people[0].status).toBe("Connection request sent");
  });

  it("recognizes a reciprocal reply without changing the distinct conversation count", () => {
    const summary = buildConnectionSummary(USER, [
      message(),
      message({ id: "message-2", sender_id: OTHER, recipient_id: USER, message_type: "text", created_at: "2026-08-19T10:05:00Z" }),
    ], []);
    expect(summary).toMatchObject({ conversationCount: 1, peopleMetCount: 0, inMotionCount: 1 });
    expect(summary.people[0].status).toBe("Conversation started");
  });

  it.each([
    ["requested", "Meeting requested"],
    ["accepted", "Planning a meeting"],
    ["scheduled", "Meeting confirmed"],
  ])("keeps the conversation and person in motion when a meeting is %s", (status, label) => {
    const summary = buildConnectionSummary(USER, [message()], [meeting({ status })]);
    expect(summary).toMatchObject({ conversationCount: 1, peopleMetCount: 0, inMotionCount: 1 });
    expect(summary.people[0].status).toBe(label);
  });

  it("counts a completed meeting as a person met but not in motion, while retaining the conversation", () => {
    const summary = buildConnectionSummary(USER, [message()], [meeting({
      status: "completed",
      completed_at: "2026-08-19T12:00:00Z",
    })]);
    expect(summary).toMatchObject({ conversationCount: 1, peopleMetCount: 1, inMotionCount: 0 });
    expect(summary.people[0].status).toBe("Meeting completed");
  });

  it("counts distinct match threads, including multiple conversations with the same person", () => {
    const summary = buildConnectionSummary(USER, [
      message(),
      message({ id: "message-2", match_id: "match-2", event_id: "event-2" }),
      message({ id: "message-3", match_id: "match-3", sender_id: "nia", recipient_id: USER }),
    ], []);
    expect(summary.conversationCount).toBe(3);
    expect(summary.inMotionCount).toBe(2);
  });

  it("uses the newest meeting attempt deterministically while preserving any earlier completed-meeting fact", () => {
    const summary = buildConnectionSummary(USER, [message()], [
      meeting({ id: "old-completed", status: "completed", requested_at: "2026-08-18T09:00:00Z", completed_at: "2026-08-18T10:00:00Z" }),
      meeting({ id: "new-request", status: "requested", requested_at: "2026-08-19T11:00:00Z" }),
    ]);
    expect(summary).toMatchObject({ conversationCount: 1, peopleMetCount: 1, inMotionCount: 1 });
    expect(summary.people[0].status).toBe("Meeting requested");
  });

  it("uses id as a stable tie-breaker when meeting request timestamps match", () => {
    const summary = buildConnectionSummary(USER, [], [
      meeting({ id: "a", status: "accepted" }),
      meeting({ id: "b", status: "scheduled" }),
    ]);
    expect(summary.people[0].status).toBe("Meeting confirmed");
  });
});
