import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FullProfileView from "./FullProfileView";

const mocks = vi.hoisted(() => ({ fetchMatchDetail: vi.fn() }));

vi.mock("@/lib/matchDetail", () => ({
  fetchMatchDetail: mocks.fetchMatchDetail,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMatchDetail.mockResolvedValue(null);
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

  it("preserves the existing People back label by default", async () => {
    render(<FullProfileView matchId="match-id" currentUserId="current-user" onBack={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "← Back to Matches" })).toBeInTheDocument();
  });
});

describe("FullProfileView V2 presentation", () => {
  it("shows directional score, confidence, stored reciprocity, band, and evidence", async () => {
    mocks.fetchMatchDetail.mockResolvedValue({
      match: {
        id: "match-id",
        eventId: "event-id",
        score: 87,
        confidence: 91,
        reciprocityLabel: "They Can Help You",
        directionalEvidence: [{
          component: "needToOfferFit",
          score: 100,
          viewerField: "needs",
          viewerValue: "Raising Capital",
          candidateField: "offers",
          candidateValue: "Investment Capital",
          mapping: "exact approved mapping",
        }],
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
        role_type: "Investor", secondary_role_types: [], primary_goal: null, secondary_goals: [], needs: [], offers: ["Investment Capital"], areas_of_expertise: [],
      },
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
