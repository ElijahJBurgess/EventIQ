import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeTab from "./ConciergeTab";
import type { ConciergeMessage } from "./useConciergeSession";

function ConciergeHarness({ onSubmit = vi.fn() }: { onSubmit?: () => void }) {
  const [draft, setDraft] = useState("");
  const [messages] = useState<ConciergeMessage[]>([]);

  return (
    <ConciergeTab
      messages={messages}
      draft={draft}
      onDraftChange={setDraft}
      loading={false}
      inlineError={null}
      onSubmit={onSubmit}
      onRetry={vi.fn()}
      onViewProfile={vi.fn()}
      onViewMyDay={vi.fn()}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ConciergeTab", () => {
  it("populates the question input from a suggested question", () => {
    render(<ConciergeHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Who should I meet right now?" }));

    expect(screen.getByRole("textbox", { name: "Ask OFFRIP Concierge" })).toHaveValue(
      "Who should I meet right now?",
    );
  });

  it("submits normally without displaying a fake recommendation", () => {
    const onSubmit = vi.fn();
    render(<ConciergeHarness onSubmit={onSubmit} />);

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeEnabled();

    const form = sendButton.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.getByText("Ask about your current Room.")).toBeInTheDocument();
    expect(screen.queryByText(/you should meet/i)).not.toBeInTheDocument();
  });

  it("renders trusted people and meeting references with accessible actions", () => {
    const onViewProfile = vi.fn();
    const onViewMyDay = vi.fn();
    render(
      <ConciergeTab
        messages={[{
          id: "answer", role: "assistant", text: "Marcus is your strongest fit.",
          people: [{ profileId: "person-1", matchId: "match-1", name: "Marcus Lee", title: "Investor", company: "Northstar", matchScore: 94, reason: "Fundraising fit" }],
          meetings: [{ meetingId: "meeting-1", matchId: "match-1", otherProfileId: "person-1", otherName: "Marcus Lee", scheduledAt: "2026-08-20T18:00:00Z", duration: 30, location: "Lobby", status: "scheduled" }],
        }]}
        draft=""
        onDraftChange={vi.fn()}
        loading={false}
        inlineError={null}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onViewProfile={onViewProfile}
        onViewMyDay={onViewMyDay}
      />,
    );
    expect(screen.getByText("Marcus is your strongest fit.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Marcus Lee's profile" }));
    expect(onViewProfile).toHaveBeenCalledWith("match-1");
    fireEvent.click(screen.getByRole("button", { name: "View My Day →" }));
    expect(onViewMyDay).toHaveBeenCalledOnce();
  });
});
