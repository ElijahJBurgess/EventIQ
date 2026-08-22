import { describe, expect, it } from "vitest";
import {
  SCORE_VERSION,
  buildMatchDetails,
  calculateMatchScore,
  calculateNeedsOffersScore,
  calculateOpportunityCompatibility,
  calculateTimingConnectionCompatibility,
  getReciprocityLabel,
  type Profile,
} from "./scorer.ts";

function profile(overrides: Partial<Profile> & { id: string }): Profile {
  return {
    full_name: overrides.id,
    location: null,
    role_type: null,
    secondary_role_types: [],
    company: null,
    title: null,
    who_to_meet: [],
    desired_outcomes: [],
    areas_of_expertise: [],
    matching_goal: null,
    primary_goal: null,
    secondary_goals: [],
    role_details: {},
    industry_focus: [],
    needs: [],
    offers: [],
    connection_preference: [],
    interests: [],
    communities: [],
    hobbies: [],
    music_interests: [],
    favorite_conferences: [],
    ...overrides,
  };
}

const recent = new Date().toISOString();

function oneWayPair() {
  const founder = profile({
    id: "founder",
    role_type: "Founder / Co-founder",
    primary_goal: "Meet Investors",
    who_to_meet: ["Investors"],
    needs: ["Raising Capital"],
    offers: ["Product Feedback"],
    expertise_sought: ["Financial Strategy"],
    areas_of_expertise: ["Product Expertise"],
    connection_preference: ["Scheduled Meeting"],
    role_details: { Founder: { companyStage: "Seed", fundraisingTimeline: "Actively Raising" } },
    profile_completed: true,
    linkedin_url: "https://linkedin.example/founder",
    updated_at: recent,
  });
  const investor = profile({
    id: "investor",
    role_type: "Investor",
    primary_goal: "Build Community",
    who_to_meet: ["Community Builders"],
    needs: ["Social Connection / Friendship"],
    offers: ["Investment Capital", "Financial Strategy"],
    areas_of_expertise: ["Financial Strategy"],
    connection_preference: ["Scheduled Meeting"],
    role_details: { Investor: { checkSize: "$100K-$500K", investmentFocusAreas: ["Fintech"] } },
    profile_completed: true,
    linkedin_url: "https://linkedin.example/investor",
    updated_at: recent,
  });
  return { founder, investor };
}

describe("Matching Rubric V2", () => {
  it("calculates two independent directional scores and credits one-way value", () => {
    const { founder, investor } = oneWayPair();
    const result = calculateMatchScore(founder, investor);

    expect(result.scoreVersion).toBe(SCORE_VERSION);
    expect(result.aToBScore).toBeGreaterThanOrEqual(70);
    expect(result.bToAScore).toBeLessThan(60);
    expect(result.aToBScore).not.toBe(result.bToAScore);
    expect(result.reciprocityLabel).toBe("They Can Help You");
    expect(result.scoreBreakdown.aToB.needToOfferFit.score).toBe(100);
    expect(result.scoreBreakdown.bToA.needToOfferFit.score).toBe(0);
  });

  it("uses the exact 35/20/15/10/10/5/5 component weights", () => {
    const result = calculateMatchScore(...Object.values(oneWayPair()) as [Profile, Profile]);
    expect(Object.fromEntries(Object.entries(result.scoreBreakdown.aToB).filter(([, value]) => typeof value === "object").map(([key, value]) => [key, (value as { weight: number }).weight]))).toEqual({
      goalToValueFit: 35,
      targetPersonFit: 20,
      needToOfferFit: 15,
      expertiseFit: 10,
      opportunityCompatibility: 10,
      timingConnectionFit: 5,
      contextFit: 5,
    });
  });

  it("stores unavailable components as null and removes their weights from the denominator", () => {
    const result = calculateMatchScore(profile({ id: "empty-a" }), profile({ id: "empty-b" }));
    expect(result.scoreBreakdown.aToB.goalToValueFit.score).toBeNull();
    expect(result.scoreBreakdown.aToB.targetPersonFit.score).toBeNull();
    expect(result.scoreBreakdown.aToB.needToOfferFit.score).toBeNull();
    expect(result.scoreBreakdown.aToB.expertiseFit.score).toBeNull();
    expect(result.scoreBreakdown.aToB.opportunityCompatibility.score).toBeNull();
    expect(result.scoreBreakdown.aToB.timingConnectionFit.score).toBeNull();
    expect(result.scoreBreakdown.aToB.contextFit.score).toBeNull();
    expect(result.scoreBreakdown.aToB.applicableWeight).toBe(0);
    expect(result.aToBScore).toBe(0);
  });

  it("does not award expertise points for merely shared expertise", () => {
    const viewer = profile({ id: "viewer", primary_goal: "Build Community", who_to_meet: ["Investors"], needs: ["Marketing"], offers: ["Marketing Expertise"], areas_of_expertise: ["Marketing Expertise"] });
    const candidate = profile({ id: "candidate", role_type: "Founder / Co-founder", primary_goal: "Raise Capital", who_to_meet: ["Founders"], needs: ["Raising Capital"], offers: ["Marketing Expertise"], areas_of_expertise: ["Marketing Expertise"] });
    const result = calculateMatchScore(viewer, candidate);
    expect(result.scoreBreakdown.aToB.expertiseFit.score).toBe(90); // derived from viewer need, not shared expertise

    const noSeek = calculateMatchScore(
      profile({ id: "no-seek", areas_of_expertise: ["Marketing Expertise"] }),
      profile({ id: "same-expertise", areas_of_expertise: ["Marketing Expertise"] }),
    );
    expect(noSeek.scoreBreakdown.aToB.expertiseFit.score).toBeNull();
  });

  it("keeps confidence separate from compatibility", () => {
    const { founder, investor } = oneWayPair();
    const result = calculateMatchScore(founder, investor);
    expect(result.aToBConfidence).toBeGreaterThanOrEqual(70);
    expect(result.aToBConfidence).not.toBe(result.aToBScore);
  });

  it("implements the selected reciprocity thresholds", () => {
    expect(getReciprocityLabel(70, 70)).toBe("You Can Help Each Other");
    expect(getReciprocityLabel(100, 70)).toBe("You Can Help Each Other");
    expect(getReciprocityLabel(70, 69)).toBe("They Can Help You");
    expect(getReciprocityLabel(69, 70)).toBe("You Can Help Them");
    expect(getReciprocityLabel(69, 69)).toBe("Potential Connection");
    expect(getReciprocityLabel(60, 60)).toBe("Potential Connection");
  });

  it("uses approved need/offer credits without a harmonic mean", () => {
    expect(calculateNeedsOffersScore(["Raising Capital"], ["Investment Capital"])).toBe(100);
    expect(calculateNeedsOffersScore(["Finding Customers"], ["Sales Expertise"])).toBe(80);
    expect(calculateNeedsOffersScore(["Finding Customers", "Marketing"], ["Sales Expertise"])).toBe(40);
  });

  it("distinguishes missing opportunity data from explicit incompatibility", () => {
    const founder = profile({ id: "f", role_type: "Founder / Co-founder", role_details: { Founder: { companyStage: "Idea Stage" } } });
    const missing = profile({ id: "i-missing", role_type: "Investor" });
    const incompatible = profile({ id: "i-incompatible", role_type: "Investor", role_details: { Investor: { checkSize: "$500K+" } } });
    expect(calculateOpportunityCompatibility(founder, missing)).toBeNull();
    expect(calculateOpportunityCompatibility(founder, incompatible)).toBe(0);
  });

  it("scores compatible connection formats and preserves structured explanation details", () => {
    const a = profile({ id: "a", connection_preference: ["Quick Introduction"], needs: ["Raising Capital"] });
    const b = profile({ id: "b", connection_preference: ["One-on-One Conversation"], offers: ["Investment Capital"] });
    expect(calculateTimingConnectionCompatibility(a, b)).toBe(75);
    expect(buildMatchDetails(a, b).needsOffersAToB).toEqual([{ need: "Raising Capital", offer: "Investment Capital", matchType: "near" }]);
  });

  it("records only point-contributing evidence", () => {
    const { founder, investor } = oneWayPair();
    const result = calculateMatchScore(founder, investor);
    expect(result.matchEvidence.aToB.length).toBeGreaterThan(0);
    expect(result.matchEvidence.aToB.every((item) => item.score > 0)).toBe(true);
    expect(result.matchEvidence.aToB.every((item) => result.scoreBreakdown.aToB[item.component].score !== null)).toBe(true);
  });
});
