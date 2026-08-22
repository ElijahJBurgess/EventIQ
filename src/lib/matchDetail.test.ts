import { describe, expect, it } from "vitest";
import { orientStoredMatch } from "./matchDetail";

const stored = {
  user_a_id: "user-a",
  user_b_id: "user-b",
  a_to_b_score: 88,
  b_to_a_score: 72,
  a_to_b_confidence: 91,
  b_to_a_confidence: 76,
  reciprocity_label: "They Can Help You",
  score_breakdown: { aToB: { side: "a" }, bToA: { side: "b" } },
  match_evidence: {
    aToB: [{ component: "needToOfferFit", score: 100, viewerField: "needs", viewerValue: "Capital", candidateField: "offers", candidateValue: "Investment", mapping: "exact" }],
    bToA: [{ component: "expertiseFit", score: 90, viewerField: "expertise_sought", viewerValue: "Product", candidateField: "expertise_offered", candidateValue: "Product", mapping: "exact" }],
  },
};

describe("orientStoredMatch", () => {
  it("orients A→B score, confidence, breakdown, and evidence for user A", () => {
    const result = orientStoredMatch(stored, "user-a");
    expect(result?.score).toBe(88);
    expect(result?.confidence).toBe(91);
    expect(result?.reciprocityLabel).toBe("They Can Help You");
    expect(result?.directionalEvidence[0].viewerValue).toBe("Capital");
    expect(result?.reverseEvidence[0].viewerValue).toBe("Product");
    expect(result?.scoreBreakdown).toEqual({ side: "a" });
  });

  it("orients B→A values and directional reciprocity wording for user B", () => {
    const result = orientStoredMatch(stored, "user-b");
    expect(result?.score).toBe(72);
    expect(result?.confidence).toBe(76);
    expect(result?.reciprocityLabel).toBe("You Can Help Them");
    expect(result?.directionalEvidence[0].viewerValue).toBe("Product");
    expect(result?.reverseEvidence[0].viewerValue).toBe("Capital");
    expect(result?.scoreBreakdown).toEqual({ side: "b" });
  });
});
