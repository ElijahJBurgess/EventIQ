import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MatchesTab from "./MatchesTab";

const mocks = vi.hoisted(() => ({
  queriedMatchEvents: [] as string[],
  invoke: vi.fn(async () => ({ data: { matchesSaved: 0 }, error: null })),
}));

vi.mock("@/integrations/supabase/client", () => {
  const registrations = [{ event_id: "room-a" }, { event_id: "room-b" }];
  const events = [
    { id: "room-a", name: "Room A", date: "2026-08-20" },
    { id: "room-b", name: "Room B", date: "2026-08-21" },
  ];
  const profiles = [
    { id: "person-a", full_name: "Checked Person A", title: "Founder", company: "A Co" },
    { id: "absent-a", full_name: "Absent Person", title: "Investor", company: "Away Co" },
    { id: "person-b", full_name: "Checked Person B", title: "Creator", company: "B Co" },
  ];

  const makeBuilder = (table: string) => {
    let columns = "";
    let eventId: string | undefined;
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn((value: string) => {
      columns = value;
      return builder;
    });
    builder.eq = vi.fn((column: string, value: unknown) => {
      if (column === "event_id") eventId = String(value);
      return builder;
    });
    for (const method of ["in", "or", "order", "not"]) builder[method] = vi.fn(() => builder);
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      let data: unknown[] = [];
      if (table === "event_registrations" && columns === "event_id") data = registrations;
      if (table === "events") data = events;
      if (table === "matched_event_attendance" && columns === "profile_id") {
        data = eventId === "room-a" ? [{ profile_id: "person-a" }] : [{ profile_id: "person-b" }];
      }
      if (table === "matches") {
        if (eventId) mocks.queriedMatchEvents.push(eventId);
        data = eventId === "room-a"
          ? [
              { id: "match-absent", event_id: "room-a", user_a_id: "current-user", user_b_id: "absent-a", a_to_b_score: 99, b_to_a_score: 65, a_to_b_confidence: 99, b_to_a_confidence: 75, reciprocity_label: "You Can Help Each Other" },
              { id: "match-a", event_id: "room-a", user_a_id: "current-user", user_b_id: "person-a", a_to_b_score: 86, b_to_a_score: 72, a_to_b_confidence: 80, b_to_a_confidence: 75, reciprocity_label: "You Can Help Each Other" },
            ]
          : [{ id: "match-b", event_id: "room-b", user_a_id: "person-b", user_b_id: "current-user", a_to_b_score: 61, b_to_a_score: 74, a_to_b_confidence: 71, b_to_a_confidence: 78, reciprocity_label: "You Can Help Each Other" }];
      }
      if (table === "attendee_profiles") data = profiles;
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return builder;
  };

  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      functions: { invoke: mocks.invoke },
    },
  };
});

function ControlledPeople() {
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>("room-a");
  return (
    <>
      <output aria-label="Dashboard selected Room">{selectedEventId}</output>
      <MatchesTab
        userId="current-user"
        selectedEventId={selectedEventId}
        onSelectedEventChange={setSelectedEventId}
        onViewFullProfile={vi.fn()}
      />
    </>
  );
}

beforeEach(() => {
  mocks.queriedMatchEvents.length = 0;
  mocks.invoke.mockClear();
});
afterEach(cleanup);

describe("MatchesTab controlled Room state", () => {
  it("uses Dashboard selection, reports Room changes, and preserves checked-in filtering", async () => {
    render(<ControlledPeople />);

    expect(await screen.findByText("Checked Person A")).toBeInTheDocument();
    expect(screen.getByText("86%")).toBeInTheDocument();
    expect(screen.getByText("Don't Leave Without Meeting")).toBeInTheDocument();
    expect(screen.queryByText("Absent Person")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Dashboard selected Room")).toHaveTextContent("room-a");

    fireEvent.change(screen.getByLabelText("Event"), { target: { value: "room-b" } });

    await waitFor(() => expect(screen.getByLabelText("Dashboard selected Room")).toHaveTextContent("room-b"));
    expect(await screen.findByText("Checked Person B")).toBeInTheDocument();
    expect(screen.getByText("74%")).toBeInTheDocument();
    expect(screen.getByText("Confidence 78%")).toBeInTheDocument();
    expect(screen.getByText("Strong Match")).toBeInTheDocument();
    expect(screen.getByText("You Can Help Each Other")).toBeInTheDocument();
    expect(mocks.queriedMatchEvents).toContain("room-a");
    expect(mocks.queriedMatchEvents).toContain("room-b");

    fireEvent.click(screen.getByRole("button", { name: "Run Matching" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("match-engine", {
      body: { eventId: "room-b" },
    }));
  });
});
