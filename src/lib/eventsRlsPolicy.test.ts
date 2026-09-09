import { describe, expect, it } from "vitest";
import {
  canDeleteEvent,
  canInsertEvent,
  canSelectEvent,
  canUpdateEvent,
  type AuthContext,
  type EventRow,
} from "./eventsRlsPolicy";

// Simulated auth contexts — a real signed-in JWT reduces to exactly these two
// facts for the events policies: who am I (auth.uid()) and is my profile
// is_organizer.
const organizerA: AuthContext = { uid: "user-a", isOrganizer: true };
const organizerB: AuthContext = { uid: "user-b", isOrganizer: true };
const plainC: AuthContext = { uid: "user-c", isOrganizer: false };
const anon: AuthContext = { uid: null, isOrganizer: false };

const draftA: EventRow = { organizer_id: "user-a", is_published: false };
const publishedA: EventRow = { organizer_id: "user-a", is_published: true };
const draftB: EventRow = { organizer_id: "user-b", is_published: false };

describe("events RLS — INSERT", () => {
  it("an organizer can create a room they own", () => {
    expect(canInsertEvent(organizerA, { organizer_id: "user-a", is_published: false })).toBe(true);
  });

  it("an organizer cannot create a room owned by someone else (WITH CHECK)", () => {
    expect(canInsertEvent(organizerA, { organizer_id: "user-b", is_published: false })).toBe(false);
  });

  it("an organizer cannot create a room with a null organizer_id", () => {
    expect(canInsertEvent(organizerA, { organizer_id: null, is_published: false })).toBe(false);
  });

  it("a signed-in non-organizer cannot create a room at all", () => {
    expect(canInsertEvent(plainC, { organizer_id: "user-c", is_published: false })).toBe(false);
  });

  it("an anonymous visitor cannot create a room", () => {
    expect(canInsertEvent(anon, { organizer_id: null, is_published: true })).toBe(false);
  });
});

describe("events RLS — SELECT", () => {
  it("anyone can see a published room", () => {
    expect(canSelectEvent(anon, publishedA)).toBe(true);
    expect(canSelectEvent(plainC, publishedA)).toBe(true);
    expect(canSelectEvent(organizerB, publishedA)).toBe(true);
  });

  it("an organizer sees their own unpublished draft", () => {
    expect(canSelectEvent(organizerA, draftA)).toBe(true);
  });

  it("an organizer cannot see another organizer's unpublished draft", () => {
    expect(canSelectEvent(organizerA, draftB)).toBe(false);
    expect(canSelectEvent(organizerB, draftA)).toBe(false);
  });

  it("a non-organizer cannot see anyone's unpublished draft", () => {
    expect(canSelectEvent(plainC, draftA)).toBe(false);
    expect(canSelectEvent(anon, draftA)).toBe(false);
  });
});

describe("events RLS — UPDATE / DELETE", () => {
  it("an organizer can update their own room", () => {
    expect(canUpdateEvent(organizerA, draftA, { organizer_id: "user-a", is_published: true })).toBe(true);
  });

  it("an organizer cannot hand their room to another owner", () => {
    expect(canUpdateEvent(organizerA, draftA, { organizer_id: "user-b", is_published: false })).toBe(false);
  });

  it("an organizer cannot update another organizer's room", () => {
    expect(canUpdateEvent(organizerA, draftB, draftB)).toBe(false);
  });

  it("a non-organizer cannot update or delete even a row they own", () => {
    const ownedByC: EventRow = { organizer_id: "user-c", is_published: false };
    expect(canUpdateEvent(plainC, ownedByC, ownedByC)).toBe(false);
    expect(canDeleteEvent(plainC, ownedByC)).toBe(false);
  });

  it("an organizer can delete their own room but not another's", () => {
    expect(canDeleteEvent(organizerA, draftA)).toBe(true);
    expect(canDeleteEvent(organizerA, draftB)).toBe(false);
  });
});
