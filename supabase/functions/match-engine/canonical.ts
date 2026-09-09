// Canonical pair ordering for the `matches` table.
//
// A pair is stored with user_a_id = the lexicographically-smaller UUID and
// user_b_id = the larger one (which equals Postgres uuid ordering for the
// canonical lowercase UUIDs `gen_random_uuid()` produces, and the
// `user_a_id < user_b_id` CHECK constraint). Because every direction-dependent
// column (a_to_b_* / b_to_a_*, the aToB/bToA halves of score_breakdown and
// match_evidence, reciprocity_label, and the match_details sub-fields) is tied
// to that orientation, canonicalising a row means swapping all of them, not
// just the id columns.
//
// Import-clean (no Deno globals) so it runs under Vitest -- see canonical.test.ts.

import {
  matchReasonSummary,
  type MatchDetails,
  type MatchEvidenceItem,
  type MatchResult,
} from "./scorer.ts";

/**
 * The canonical orientation for a scored pair. `calculateMatchScore(requester,
 * other)` treats `requester` as "a"; `orientedAsCalculated` says whether that
 * already matches canonical (requester id < other id) order.
 */
export function canonicalOrientation(requesterId: string, otherId: string): {
  userAId: string;
  userBId: string;
  orientedAsCalculated: boolean;
} {
  return requesterId < otherId
    ? { userAId: requesterId, userBId: otherId, orientedAsCalculated: true }
    : { userAId: otherId, userBId: requesterId, orientedAsCalculated: false };
}

const RECIPROCITY_FLIP: Record<string, string> = {
  "They Can Help You": "You Can Help Them",
  "You Can Help Them": "They Can Help You",
};

/** Direction-dependent reciprocity labels flip; symmetric ones (Mutual Value, Potential Connection) don't. */
export function flipReciprocityLabel(label: string | null | undefined): string | null | undefined {
  if (label == null) return label;
  return RECIPROCITY_FLIP[label] ?? label;
}

/** Swap the `aToB` / `bToA` halves of a jsonb object, preserving any other keys. */
function swapAbBaKeys<T extends Record<string, unknown>>(obj: T | null | undefined): T | null | undefined {
  if (obj == null) return obj;
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key !== "aToB" && key !== "bToA") rest[key] = value;
  }
  return { ...rest, aToB: obj.bToA ?? null, bToA: obj.aToB ?? null } as T;
}

/**
 * The direction-dependent stored columns for a freshly-scored match, oriented
 * canonically. `orientedAsCalculated` is `canonicalOrientation(...).orientedAsCalculated`.
 * (Moved verbatim from match-engine/index.ts's inline `storedValues`.)
 */
export function buildStoredMatchValues(
  result: MatchResult,
  details: MatchDetails,
  generatedAtIso: string,
  orientedAsCalculated: boolean,
): Record<string, unknown> {
  const aToBScore = orientedAsCalculated ? result.aToBScore : result.bToAScore;
  const bToAScore = orientedAsCalculated ? result.bToAScore : result.aToBScore;
  const aToBConfidence = orientedAsCalculated ? result.aToBConfidence : result.bToAConfidence;
  const bToAConfidence = orientedAsCalculated ? result.bToAConfidence : result.aToBConfidence;
  const scoreBreakdown = orientedAsCalculated
    ? result.scoreBreakdown
    : { aToB: result.scoreBreakdown.bToA, bToA: result.scoreBreakdown.aToB };
  const matchEvidence = orientedAsCalculated
    ? result.matchEvidence
    : { aToB: result.matchEvidence.bToA, bToA: result.matchEvidence.aToB };
  const reasons = orientedAsCalculated ? result.aToBReasons : result.bToAReasons;
  const reciprocityLabel = orientedAsCalculated
    ? result.reciprocityLabel
    : flipReciprocityLabel(result.reciprocityLabel);
  return {
    a_to_b_score: aToBScore,
    b_to_a_score: bToAScore,
    a_to_b_confidence: aToBConfidence,
    b_to_a_confidence: bToAConfidence,
    reciprocity_label: reciprocityLabel,
    score_version: result.scoreVersion,
    score_breakdown: scoreBreakdown,
    match_evidence: matchEvidence,
    match_details: orientedAsCalculated
      ? details
      : {
          ...details,
          matchedGoals: details.matchedGoals.map(({ goalA, goalB, ...rest }) => ({ goalA: goalB, goalB: goalA, ...rest })),
          matchedRoles: details.matchedRoles.map(({ roleA, roleB, ...rest }) => ({ roleA: roleB, roleB: roleA, ...rest })),
          needsOffersAToB: details.needsOffersBToA,
          needsOffersBToA: details.needsOffersAToB,
        },
    // Transitional shared values remain populated for the unchanged UI.
    match_score: aToBScore,
    match_reason: reasons.join(" "),
    generated_at: generatedAtIso,
  };
}

interface StoredMatchRow {
  a_to_b_score: number | null;
  b_to_a_score: number | null;
  a_to_b_confidence: number | null;
  b_to_a_confidence: number | null;
  reciprocity_label: string | null;
  match_score: number | null;
  match_reason: string | null;
  score_breakdown: Record<string, unknown> | null;
  match_evidence: Record<string, unknown>;
  match_details: {
    matchedGoals?: Array<{ goalA: string; goalB: string; [k: string]: unknown }>;
    matchedRoles?: Array<{ roleA: string; roleB: string; [k: string]: unknown }>;
    needsOffersAToB?: unknown;
    needsOffersBToA?: unknown;
    [k: string]: unknown;
  } | null;
}

/**
 * Re-orient a STORED match row's direction-dependent columns (does not touch
 * user_a_id / user_b_id — the caller swaps those). The tested reference for the
 * one-time cleanup migration, which performs the identical swap in SQL.
 */
export function swapStoredMatchDirection<T extends StoredMatchRow>(row: T): T {
  const bToAEvidence = (row.match_evidence?.bToA ?? []) as MatchEvidenceItem[];
  const details = row.match_details;
  return {
    ...row,
    a_to_b_score: row.b_to_a_score,
    b_to_a_score: row.a_to_b_score,
    a_to_b_confidence: row.b_to_a_confidence,
    b_to_a_confidence: row.a_to_b_confidence,
    match_score: row.b_to_a_score,
    reciprocity_label: flipReciprocityLabel(row.reciprocity_label) ?? null,
    match_reason: matchReasonSummary(bToAEvidence),
    score_breakdown: swapAbBaKeys(row.score_breakdown) ?? null,
    match_evidence: swapAbBaKeys(row.match_evidence) as Record<string, unknown>,
    match_details: details == null ? null : {
      ...details,
      matchedGoals: (details.matchedGoals ?? []).map(({ goalA, goalB, ...rest }) => ({ goalA: goalB, goalB: goalA, ...rest })),
      matchedRoles: (details.matchedRoles ?? []).map(({ roleA, roleB, ...rest }) => ({ roleA: roleB, roleB: roleA, ...rest })),
      needsOffersAToB: details.needsOffersBToA ?? [],
      needsOffersBToA: details.needsOffersAToB ?? [],
    },
  };
}
