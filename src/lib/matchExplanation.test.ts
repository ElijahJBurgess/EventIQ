import { describe, expect, it } from "vitest";
import { buildFullProfileExplanation } from "./matchExplanation";
import type { DirectionalEvidenceItem, MatchDetailProfile, MatchDetailResult } from "./matchDetail";

const profile = (id: string, fullName: string): MatchDetailProfile => ({
  id,
  full_name: fullName,
  avatar_url: null,
  title: null,
  company: null,
  location: null,
  role_type: null,
  secondary_role_types: [],
  primary_goal: null,
  secondary_goals: [],
  needs: [],
  offers: [],
  areas_of_expertise: [],
});

const item = (overrides: Partial<DirectionalEvidenceItem>): DirectionalEvidenceItem => ({
  component: "needToOfferFit",
  score: 100,
  viewerField: "needs",
  viewerValue: "Raising Capital",
  candidateField: "offers",
  candidateValue: "Investment Capital",
  mapping: "exact approved mapping",
  ...overrides,
});

function detail(directionalEvidence: DirectionalEvidenceItem[], reverseEvidence: DirectionalEvidenceItem[] = []): MatchDetailResult {
  return {
    match: {
      id: "match-1",
      eventId: "event-1",
      score: 82,
      confidence: 88,
      reciprocityLabel: "They Can Help You",
      directionalEvidence,
      reverseEvidence,
      scoreBreakdown: null,
      matchDetails: { matchedGoals: [{ goalA: "legacy", goalB: "must not appear", type: "shared" }] },
      reason: "Legacy explanation must not appear",
      sharedGoals: [],
      sharedInterests: [],
      sharedIndustries: [],
      sharedCommunities: [],
      generatedAt: null,
    },
    currentUser: profile("viewer", "Viewer Person"),
    otherPerson: profile("candidate", "Priya Candidate"),
  };
}

describe("V2 match explanations", () => {
  it("builds viewer-facing explanations only from viewer directional evidence", () => {
    const result = buildFullProfileExplanation(detail([
      item({}),
      item({ component: "goalToValueFit", viewerField: "primary_goal", viewerValue: "Meet Investors", candidateField: "role_type", candidateValue: "Investor", mapping: "direct primary-goal fulfillment" }),
    ]));
    expect(result.whyThisMakesSense).toContain("Priya's Investor supports your goal of Meet Investors");
    expect(result.whyThisMakesSense).toContain("Priya can offer Investment Capital");
    expect(result.whyThisMakesSense).not.toContain("legacy");
    expect(result.whyItClicks).toEqual([
      { labelA: "Meet Investors", labelB: "Investor" },
      { labelA: "Raising Capital", labelB: "Investment Capital" },
    ]);
    expect(result.whatTheyCanOfferYou).toEqual(["Investment Capital"]);
  });

  it("uses reverse evidence only for what the viewer can offer", () => {
    const result = buildFullProfileExplanation(detail(
      [item({ candidateValue: "Investment Capital" })],
      [item({ viewerValue: "Product Feedback", candidateValue: "Product Expertise" })],
    ));
    expect(result.whatTheyCanOfferYou).toEqual(["Investment Capital"]);
    expect(result.whatYouCanOfferThem).toEqual(["Product Expertise"]);
    expect(result.whyThisMakesSense).not.toContain("Product Expertise");
  });

  it("does not fabricate an explanation when evidence is missing", () => {
    const result = buildFullProfileExplanation(detail([]));
    expect(result.whyThisMakesSense).toBe("No scored directional evidence is available for this recommendation yet.");
    expect(result.whyItClicks).toEqual([]);
    expect(result.whatTheyCanOfferYou).toEqual([]);
  });

  it("deduplicates repeated evidence pairs and offer values", () => {
    const duplicate = item({});
    const result = buildFullProfileExplanation(detail([duplicate, duplicate]));
    expect(result.whyItClicks).toEqual([{ labelA: "Raising Capital", labelB: "Investment Capital" }]);
    expect(result.whatTheyCanOfferYou).toEqual(["Investment Capital"]);
  });
});
