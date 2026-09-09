import { describe, expect, it } from "vitest";
import { buildMatchDetails, calculateMatchScore, type Profile } from "./scorer.ts";
import { buildStoredMatchValues, canonicalOrientation, swapStoredMatchDirection } from "./canonical.ts";

function profile(overrides: Partial<Profile> & { id: string }): Profile {
  return {
    full_name: overrides.id, location: null, role_type: null, secondary_role_types: [], company: null, title: null,
    who_to_meet: [], desired_outcomes: [], areas_of_expertise: [], matching_goal: null, primary_goal: null,
    secondary_goals: [], role_details: {}, industry_focus: [], needs: [], offers: [], connection_preference: [],
    interests: [], communities: [], hobbies: [], music_interests: [], favorite_conferences: [],
    ...overrides,
  };
}

// A deliberately one-way pair (mirrors scorer.test.ts's oneWayPair) so the
// directional scores, evidence and reciprocity label all genuinely differ.
// UUID-shaped ids, founder < investor, so founder is the canonical user_a.
const founder = profile({
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  role_type: "Founder / Co-founder", primary_goal: "Meet Investors", who_to_meet: ["Investors"],
  needs: ["Raising Capital"], offers: ["Product Feedback"], expertise_sought: ["Financial Strategy"],
  areas_of_expertise: ["Product Expertise"], connection_preference: ["Scheduled Meeting"],
});
const investor = profile({
  id: "ffffffff-0000-0000-0000-000000000002",
  role_type: "Investor", primary_goal: "Build Community", who_to_meet: ["Community Builders"],
  needs: ["Social Connection / Friendship"], offers: ["Investment Capital", "Financial Strategy"],
  areas_of_expertise: ["Financial Strategy"], connection_preference: ["Scheduled Meeting"],
});

describe("canonicalOrientation", () => {
  it("puts the lexicographically-smaller UUID in user_a_id", () => {
    expect(canonicalOrientation(founder.id, investor.id)).toEqual({
      userAId: founder.id, userBId: investor.id, orientedAsCalculated: true,
    });
    expect(canonicalOrientation(investor.id, founder.id)).toEqual({
      userAId: founder.id, userBId: investor.id, orientedAsCalculated: false,
    });
  });
});

describe("buildStoredMatchValues", () => {
  const result = calculateMatchScore(founder, investor);
  const details = buildMatchDetails(founder, investor);
  const asCalc = buildStoredMatchValues(result, details, "2026-09-08T00:00:00Z", true);
  const flipped = buildStoredMatchValues(result, details, "2026-09-08T00:00:00Z", false);

  it("keeps every directional field as-calculated when already canonical", () => {
    expect(asCalc.a_to_b_score).toBe(result.aToBScore);
    expect(asCalc.b_to_a_score).toBe(result.bToAScore);
    expect(asCalc.a_to_b_confidence).toBe(result.aToBConfidence);
    expect(asCalc.reciprocity_label).toBe(result.reciprocityLabel);
    expect(asCalc.match_score).toBe(result.aToBScore);
    expect(asCalc.match_reason).toBe(result.aToBReasons.join(" "));
    expect((asCalc.match_evidence as { aToB: unknown }).aToB).toEqual(result.matchEvidence.aToB);
  });

  it("swaps the directional fields, not just the IDs, when the calc orientation is reversed", () => {
    expect(founder.id < investor.id).toBe(true); // sanity: founder is canonical user_a
    // scores + confidences flip
    expect(flipped.a_to_b_score).toBe(result.bToAScore);
    expect(flipped.b_to_a_score).toBe(result.aToBScore);
    expect(flipped.a_to_b_confidence).toBe(result.bToAConfidence);
    expect(flipped.b_to_a_confidence).toBe(result.aToBConfidence);
    // the two directional scores genuinely differ for this pair
    expect(result.aToBScore).not.toBe(result.bToAScore);
    // transitional shared fields follow the new a->b direction
    expect(flipped.match_score).toBe(result.bToAScore);
    expect(flipped.match_reason).toBe(result.bToAReasons.join(" "));
    expect(flipped.match_reason).not.toBe(result.aToBReasons.join(" "));
    // reciprocity label flips direction
    const expectedLabel = result.reciprocityLabel === "They Can Help You"
      ? "You Can Help Them"
      : result.reciprocityLabel === "You Can Help Them"
        ? "They Can Help You"
        : result.reciprocityLabel;
    expect(flipped.reciprocity_label).toBe(expectedLabel);
    // jsonb aToB/bToA keys swap
    expect((flipped.match_evidence as { aToB: unknown }).aToB).toEqual(result.matchEvidence.bToA);
    expect((flipped.score_breakdown as { aToB: unknown }).aToB).toEqual(result.scoreBreakdown.bToA);
    // match_details sub-fields swap
    expect((flipped.match_details as { needsOffersAToB: unknown }).needsOffersAToB).toEqual(details.needsOffersBToA);
    expect((flipped.match_details as { needsOffersBToA: unknown }).needsOffersBToA).toEqual(details.needsOffersAToB);
  });
});

describe("swapStoredMatchDirection (cleanup-migration reference)", () => {
  const result = calculateMatchScore(founder, investor);
  const details = buildMatchDetails(founder, investor);
  // A row stored non-canonically: user_a is the higher UUID (investor), so the
  // stored a->b direction is investor->founder.
  const nonCanonicalRow = {
    id: "row-1",
    user_a_id: investor.id,
    user_b_id: founder.id,
    ...buildStoredMatchValues(result, details, "2026-09-08T00:00:00Z", false),
  };

  it("re-orients a stored non-canonical row to match a fresh canonical build", () => {
    const canonical = buildStoredMatchValues(result, details, "2026-09-08T00:00:00Z", true);
    const swapped = swapStoredMatchDirection(nonCanonicalRow);

    expect(swapped.a_to_b_score).toBe(canonical.a_to_b_score);
    expect(swapped.b_to_a_score).toBe(canonical.b_to_a_score);
    expect(swapped.a_to_b_confidence).toBe(canonical.a_to_b_confidence);
    expect(swapped.b_to_a_confidence).toBe(canonical.b_to_a_confidence);
    expect(swapped.match_score).toBe(canonical.match_score);
    expect(swapped.reciprocity_label).toBe(canonical.reciprocity_label);
    expect(swapped.match_reason).toBe(canonical.match_reason);
    expect(swapped.match_evidence).toEqual(canonical.match_evidence);
    expect(swapped.score_breakdown).toEqual(canonical.score_breakdown);
    expect(swapped.match_details).toEqual(canonical.match_details);
  });

  it("swaps direction-dependent fields, not just the numbers", () => {
    const swapped = swapStoredMatchDirection(nonCanonicalRow);
    // aToB evidence in the swapped row is the OLD bToA evidence
    expect((swapped.match_evidence as { aToB: unknown }).aToB).toEqual(
      (nonCanonicalRow.match_evidence as { bToA: unknown }).bToA,
    );
    // match_reason is rebuilt from that swapped-in evidence, not carried over verbatim
    expect(swapped.match_reason).not.toBe(nonCanonicalRow.match_reason);
  });

  it("leaves symmetric reciprocity labels untouched", () => {
    expect(swapStoredMatchDirection({ ...nonCanonicalRow, reciprocity_label: "Mutual Value" }).reciprocity_label)
      .toBe("Mutual Value");
    expect(swapStoredMatchDirection({ ...nonCanonicalRow, reciprocity_label: "Potential Connection" }).reciprocity_label)
      .toBe("Potential Connection");
  });
});
