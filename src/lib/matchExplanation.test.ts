import { describe, expect, it } from "vitest";
import {
  buildFullProfileExplanation,
  buildWhatTheyCanOfferYou,
  buildWhatYouCanOfferThem,
  buildWhyItClicks,
  buildWhyThisMakesSense,
} from "./matchExplanation";
import type { MatchDetailProfile, MatchDetailResult } from "./matchDetail";

function profile(overrides: Partial<MatchDetailProfile> & { id: string; full_name: string }): MatchDetailProfile {
  return {
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
    role_details: null,
    ...overrides,
  };
}

function matchResult(overrides: {
  matchDetails: unknown;
  currentUser: MatchDetailProfile;
  otherPerson: MatchDetailProfile;
}): MatchDetailResult {
  return {
    match: {
      id: "match-1",
      eventId: "event-1",
      score: 0,
      scoreBreakdown: null,
      matchDetails: overrides.matchDetails as MatchDetailResult["match"]["matchDetails"],
      reason: null,
      sharedGoals: [],
      sharedInterests: [],
      sharedIndustries: [],
      sharedCommunities: [],
      generatedAt: null,
    },
    currentUser: overrides.currentUser,
    otherPerson: overrides.otherPerson,
  };
}

describe("matchExplanation", () => {
  // Scenario 1: rich match -- real complementary goal, a real
  // founder-investor-aligned role pair, and needs/offers overlap in both
  // directions with distinguishable values (Investor Introductions vs
  // Product Feedback) so a direction swap would be obvious if it happened.
  const richFounder = profile({
    id: "founder",
    full_name: "Jordan Founder",
    role_type: "Founder / Co-founder",
    primary_goal: "Meet Investors",
    needs: ["Investor Introductions", "Strategic Advice"],
    offers: ["Product Feedback"],
    areas_of_expertise: ["Fundraising", "Product"],
  });
  const richInvestor = profile({
    id: "investor",
    full_name: "Priya Investor",
    role_type: "Investor",
    primary_goal: "Meet Collaborators",
    needs: ["Product Feedback"],
    offers: ["Investor Introductions", "Mentorship"],
    areas_of_expertise: ["Venture Capital", "Product"],
  });
  const richDetails = {
    matchedGoals: [{ goalA: "Meet Investors", goalB: "Meet Collaborators", type: "complementary" }],
    matchedRoles: [{ roleA: "Founder / Co-founder", roleB: "Investor", pairType: "founder-investor-aligned" }],
    matchedInterests: ["Hiking", "YC Alumni"],
    needsOffersAToB: [{ need: "Investor Introductions", offer: "Investor Introductions", matchType: "exact" }],
    needsOffersBToA: [{ need: "Product Feedback", offer: "Product Feedback", matchType: "exact" }],
  };
  const richMatch = matchResult({ matchDetails: richDetails, currentUser: richFounder, otherPerson: richInvestor });

  it("scenario 1: rich match produces accurate output across all 4 functions", () => {
    const explanation = buildFullProfileExplanation(richMatch);

    expect(explanation.whyThisMakesSense).toBe(
      'You each have something the other is looking for -- Priya can offer Investor Introductions, and you can offer Product Feedback. Your goal of "Meet Investors" complements Priya\'s goal of "Meet Collaborators". Founder / Co-founder and Investor tend to be a strong pairing at events like this.',
    );

    expect(explanation.whyItClicks).toEqual([
      { labelA: "Meet Investors", labelB: "Meet Collaborators" },
      { labelA: "Founder / Co-founder", labelB: "Investor" },
      { labelA: "Investor Introductions", labelB: "Investor Introductions" },
      { labelA: "Product Feedback", labelB: "Product Feedback" },
    ]);

    // Scenario 4 (mirrored direction): the founder's own offer (Product
    // Feedback) must land in "what you can offer them", and the investor's
    // offer (Investor Introductions) must land in "what they can offer
    // you" -- not swapped.
    expect(explanation.whatYouCanOfferThem).toEqual(["Product Feedback"]);
    expect(explanation.whatTheyCanOfferYou).toEqual(["Investor Introductions"]);
  });

  it("scenario 4 (direct): buildWhatYouCanOfferThem/buildWhatTheyCanOfferYou never swap direction", () => {
    expect(buildWhatYouCanOfferThem(richMatch)).toEqual(["Product Feedback"]);
    expect(buildWhatTheyCanOfferYou(richMatch)).toEqual(["Investor Introductions"]);
  });

  // Scenario 2: a weak/unspecified role pairing (the real Founder-Student
  // case from Piece 3's verification) alongside a real shared goal --
  // confirm the role pairing is omitted from "why it clicks" but the real
  // goal overlap still surfaces, in both the pairs list and the summary.
  it("scenario 2: unspecified role pairing is filtered out, real goal overlap still shows", () => {
    const founder = profile({
      id: "founder",
      full_name: "Jordan Founder",
      role_type: "Founder / Co-founder",
      primary_goal: "Make Social Connections",
    });
    const student = profile({
      id: "student",
      full_name: "Sam Student",
      role_type: "Student / Recent Graduate",
      primary_goal: "Make Social Connections",
    });
    const details = {
      matchedGoals: [{ goalA: "Make Social Connections", goalB: "Make Social Connections", type: "shared" }],
      matchedRoles: [{ roleA: "Founder / Co-founder", roleB: "Student / Recent Graduate", pairType: "unspecified" }],
      matchedInterests: ["Skiing"],
      needsOffersAToB: [],
      needsOffersBToA: [],
    };
    const match = matchResult({ matchDetails: details, currentUser: founder, otherPerson: student });

    const pairs = buildWhyItClicks(match);
    expect(pairs).toEqual([{ labelA: "Make Social Connections", labelB: "Make Social Connections" }]);
    expect(pairs.some((p) => p.labelA.includes("Founder") || p.labelB.includes("Student"))).toBe(false);
    // matchedInterests is never surfaced in whyItClicks, regardless.
    expect(pairs.some((p) => p.labelA === "Skiing" || p.labelB === "Skiing")).toBe(false);

    expect(buildWhyThisMakesSense(match)).toBe('You\'re both focused on "Make Social Connections" right now.');
  });

  // Scenario 3: almost nothing in common -- confirm honest, minimal output
  // rather than an error or fabricated content.
  it("scenario 3: no overlap anywhere produces empty arrays and a neutral summary, not an error", () => {
    const a = profile({ id: "a", full_name: "No Overlap A" });
    const b = profile({ id: "b", full_name: "No Overlap B" });
    const details = {
      matchedGoals: [],
      matchedRoles: [],
      matchedInterests: [],
      needsOffersAToB: [],
      needsOffersBToA: [],
    };
    const match = matchResult({ matchDetails: details, currentUser: a, otherPerson: b });

    const explanation = buildFullProfileExplanation(match);
    expect(explanation.whyItClicks).toEqual([]);
    expect(explanation.whatYouCanOfferThem).toEqual([]);
    expect(explanation.whatTheyCanOfferYou).toEqual([]);
    expect(explanation.whyThisMakesSense).toBe(
      "There isn't a strong signal here yet based on what's been shared -- worth a conversation to find out more.",
    );
  });

  it("handles a null match_details (not yet generated) without throwing", () => {
    const a = profile({ id: "a", full_name: "A" });
    const b = profile({ id: "b", full_name: "B" });
    const match = matchResult({ matchDetails: null, currentUser: a, otherPerson: b });
    expect(() => buildFullProfileExplanation(match)).not.toThrow();
    expect(buildWhyItClicks(match)).toEqual([]);
  });

  // Orientation robustness: match_details' goalA/roleA reflect whoever
  // triggered match generation (matches.user_a_id), which is NOT
  // guaranteed to be the current viewer. Simulate the viewer being "B" at
  // generation time (their own goal/role stored second) and confirm the
  // output is still correctly oriented to the viewer's own side first.
  it("re-orients correctly when the current viewer was stored as the 'B' side at generation time", () => {
    const currentUser = profile({
      id: "viewer",
      full_name: "Viewer Person",
      role_type: "Investor",
      primary_goal: "Meet Investors", // matches goalB below, not goalA
      needs: ["Strategic Advice"], // matches needsOffersAToB's "need" -- also stored as if viewer were "B"
    });
    const otherPerson = profile({
      id: "other",
      full_name: "Other Person",
      role_type: "Founder / Co-founder",
      primary_goal: "Meet Collaborators", // matches goalA
      needs: [],
    });
    const details = {
      // goalA belongs to otherPerson, goalB belongs to currentUser --
      // opposite of the "A = viewer" assumption.
      matchedGoals: [{ goalA: "Meet Collaborators", goalB: "Meet Investors", type: "complementary" }],
      matchedRoles: [{ roleA: "Founder / Co-founder", roleB: "Investor", pairType: "founder-investor-aligned" }],
      matchedInterests: [],
      // "need" belongs to currentUser even though it's stored under AToB,
      // which by naming convention alone would suggest it's "A's need".
      needsOffersAToB: [{ need: "Strategic Advice", offer: "Founder Advice", matchType: "near" }],
      needsOffersBToA: [],
    };
    const match = matchResult({ matchDetails: details, currentUser, otherPerson });

    const pairs = buildWhyItClicks(match);
    expect(pairs).toEqual([
      { labelA: "Meet Investors", labelB: "Meet Collaborators" }, // viewer's own goal first
      { labelA: "Investor", labelB: "Founder / Co-founder" }, // viewer's own role first
      { labelA: "Strategic Advice", labelB: "Founder Advice" },
    ]);

    // The offer (Founder Advice) satisfies the viewer's own need, so it
    // must land in "what THEY can offer YOU", not "what you can offer them".
    expect(buildWhatTheyCanOfferYou(match)).toEqual(["Founder Advice"]);
    expect(buildWhatYouCanOfferThem(match)).toEqual([]);

    // The role-pairing sentence inside buildWhyThisMakesSense must use the
    // same viewer-first orientation as buildWhyItClicks -- "Investor" (the
    // viewer's own role) first, not "Founder / Co-founder" (stored as
    // roleA, but actually the other person's role) first.
    expect(buildWhyThisMakesSense(match)).toBe(
      'Other can offer Founder Advice, which is exactly what you\'re looking for. Your goal of "Meet Investors" complements Other\'s goal of "Meet Collaborators". Investor and Founder / Co-founder tend to be a strong pairing at events like this.',
    );
  });
});
