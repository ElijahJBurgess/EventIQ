import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FullProfileView from "./FullProfileView";

const mocks = vi.hoisted(() => ({
  fetchMatchDetail: vi.fn(),
  sendConnectRequest: vi.fn(),
}));

vi.mock("@/lib/matchDetail", () => ({
  fetchMatchDetail: mocks.fetchMatchDetail,
}));
vi.mock("@/lib/connectRequest", () => ({
  sendConnectRequest: mocks.sendConnectRequest,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            }),
          }),
        }),
      }),
    }),
    rpc: vi.fn(async () => ({ error: null })),
  },
}));

function matchDetail() {
  return {
    match: {
      id: "match-id",
      eventId: "event-id",
      eventName: "Test Event",
      score: 87,
      confidence: 91,
      reciprocityLabel: "They Can Help You",
      directionalEvidence: [],
      reverseEvidence: [],
      scoreBreakdown: null,
      matchDetails: null,
      reason: null,
      sharedGoals: [],
      sharedInterests: [],
      sharedIndustries: [],
      sharedCommunities: [],
      generatedAt: null,
    },
    currentUser: {
      id: "current-user", full_name: "Current User", avatar_url: null, title: null, company: null, location: null,
      role_type: null, secondary_role_types: [], primary_goal: null, secondary_goals: [], needs: [], offers: [], areas_of_expertise: [],
    },
    otherPerson: {
      id: "other-user", full_name: "Priya Person", avatar_url: null, title: "Investor", company: "Fund", location: "LA",
      role_type: "Investor", secondary_role_types: [], primary_goal: null, secondary_goals: [], needs: [], offers: [], areas_of_expertise: [],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMatchDetail.mockResolvedValue(null);
  mocks.sendConnectRequest.mockResolvedValue({ status: "sent" });
});
afterEach(cleanup);

describe("FullProfileView back navigation", () => {
  it("uses the My Day label and callback when opened from My Day", async () => {
    const onBack = vi.fn();
    render(<FullProfileView matchId="match-id" currentUserId="current-user" onBack={onBack} backLabel="Back to My Day" />);

    const back = await screen.findByRole("button", { name: "← Back to My Day" });
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing Matches back label by default", async () => {
    render(<FullProfileView matchId="match-id" currentUserId="current-user" onBack={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "← Back to Matches" })).toBeInTheDocument();
  });
});

describe("FullProfileView V2 presentation", () => {
  it("shows directional score, confidence, stored reciprocity, band, and evidence", async () => {
    mocks.fetchMatchDetail.mockResolvedValue({
      ...matchDetail(),
      match: {
        ...matchDetail().match,
        directionalEvidence: [{
          component: "needToOfferFit",
          score: 100,
          viewerField: "needs",
          viewerValue: "Raising Capital",
          candidateField: "offers",
          candidateValue: "Investment Capital",
          mapping: "exact approved mapping",
        }],
      },
      otherPerson: { ...matchDetail().otherPerson, offers: ["Investment Capital"] },
    });

    render(<FullProfileView matchId="match-id" currentUserId="current-user" onBack={vi.fn()} />);
    expect(await screen.findByText("87%")).toBeInTheDocument();
    expect(screen.getByText("Confidence 91%")).toBeInTheDocument();
    expect(screen.getByText("Don't Leave Without Meeting")).toBeInTheDocument();
    expect(screen.getByText("They Can Help You")).toBeInTheDocument();
    expect(screen.getAllByText(/Investment Capital/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Mutual Value")).not.toBeInTheDocument();
  });
});

describe("FullProfileView — Make the Intro composer", () => {
  beforeEach(() => {
    mocks.fetchMatchDetail.mockResolvedValue(matchDetail());
  });

  it("opens the composer instead of sending immediately", async () => {
    render(<FullProfileView matchId="match-id" currentUserId="current-user" onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Make the Intro" }));

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("Hi! I'd love to connect.");
    expect(screen.getByText("This one's just a starting point")).toBeInTheDocument();
    expect(mocks.sendConnectRequest).not.toHaveBeenCalled();
  });

  it("sends the edited content, not the hardcoded default", async () => {
    render(<FullProfileView matchId="match-id" currentUserId="current-user" onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Make the Intro" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Priya — would love your read on our seed raise." } });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(mocks.sendConnectRequest).toHaveBeenCalledWith(expect.objectContaining({
      matchId: "match-id",
      eventId: "event-id",
      senderId: "current-user",
      recipientId: "other-user",
      content: "Priya — would love your read on our seed raise.",
    })));
    expect(mocks.sendConnectRequest).not.toHaveBeenCalledWith(expect.objectContaining({ content: "Hi! I'd love to connect." }));
    expect(await screen.findByText("Intro Sent")).toBeInTheDocument();
  });

  it("closes the composer on Cancel without sending", async () => {
    render(<FullProfileView matchId="match-id" currentUserId="current-user" onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Make the Intro" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make the Intro" })).toBeInTheDocument();
    expect(mocks.sendConnectRequest).not.toHaveBeenCalled();
  });
});
