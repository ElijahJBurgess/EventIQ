// Presentation layer for Full Profile View: turns Piece 4's MatchDetailResult
// into the 4 explanation sections, as honest rule-based sentences/labels
// built from real structured data. This is the exact seam a later AI pass
// replaces -- it should only ever touch HOW these read, never the data
// these functions pull from.
//
// Important: match.matchDetails (from Piece 2/3's buildMatchDetails) labels
// its pairs "A"/"B" based on whichever profile triggered match generation
// (matches.user_a_id), NOT based on who is currently viewing the page.
// Piece 4 already re-orients the two PROFILE objects into currentUser /
// otherPerson correctly, but the raw matchDetails JSON itself still uses
// the original generation-time A/B labels. Every function here re-derives
// "does this goal/role belong to the current viewer or the other person"
// by checking the value against the two profiles' own live data, rather
// than trusting goalA/roleA to mean "the current viewer's side" -- getting
// this wrong would silently swap "what you can offer them" with "what they
// can offer you" whenever the viewer happens to be user_b on the row.

import type { MatchDetailProfile, MatchDetailResult } from "@/lib/matchDetail";
import type { Json } from "@/integrations/supabase/types";

export interface ClickPair {
  labelA: string;
  labelB: string;
}

export interface FullProfileExplanation {
  whyThisMakesSense: string;
  whyItClicks: ClickPair[];
  whatYouCanOfferThem: string[];
  whatTheyCanOfferYou: string[];
}

interface MatchedGoalPair {
  goalA: string;
  goalB: string;
  type: "complementary" | "shared";
}

interface MatchedRolePair {
  roleA: string;
  roleB: string;
  pairType: string;
}

interface NeedsOffersPair {
  need: string;
  offer: string;
  matchType: "exact" | "near";
}

interface ParsedMatchDetails {
  matchedGoals: MatchedGoalPair[];
  matchedRoles: MatchedRolePair[];
  matchedInterests: string[];
  needsOffersAToB: NeedsOffersPair[];
  needsOffersBToA: NeedsOffersPair[];
}

const EMPTY_DETAILS: ParsedMatchDetails = {
  matchedGoals: [],
  matchedRoles: [],
  matchedInterests: [],
  needsOffersAToB: [],
  needsOffersBToA: [],
};

/** Defensive against null match_details (not yet generated) or an unexpected shape -- never throws, falls back to empty. */
function parseMatchDetails(json: Json | null): ParsedMatchDetails {
  if (!json || typeof json !== "object" || Array.isArray(json)) return EMPTY_DETAILS;
  const obj = json as Record<string, unknown>;
  return {
    matchedGoals: Array.isArray(obj.matchedGoals) ? (obj.matchedGoals as MatchedGoalPair[]) : [],
    matchedRoles: Array.isArray(obj.matchedRoles) ? (obj.matchedRoles as MatchedRolePair[]) : [],
    matchedInterests: Array.isArray(obj.matchedInterests) ? (obj.matchedInterests as string[]) : [],
    needsOffersAToB: Array.isArray(obj.needsOffersAToB) ? (obj.needsOffersAToB as NeedsOffersPair[]) : [],
    needsOffersBToA: Array.isArray(obj.needsOffersBToA) ? (obj.needsOffersBToA as NeedsOffersPair[]) : [],
  };
}

// ---------------------------------------------------------------------------
// Meaningful vs weak/unspecified role pairings.
//
// classifyRolePairComplementarity (scorer.ts) can produce these pairTypes:
//   "founder-investor-aligned"  (score 20 -- confirmed real alignment)
//   "strong"                    (score 20 -- STRONG_PAIRS)
//   "founder-investor-moderate" (score 10 -- founder/investor pair, but the
//                                 depth check did NOT confirm real alignment)
//   "community-builder"         (score 10 -- blanket "anyone + community
//                                 builder" rule, not identity-specific)
//   "same-role"                 (score 10 -- MODERATE_SAME_ROLE_PAIRS, peer match)
//   "unspecified"               (score 10 -- no rule at all, default fallback)
//   "weak"                      (score 0  -- WEAK_PAIRS)
//
// Only "founder-investor-aligned", "strong", and "same-role" are treated as
// genuine highlights here, matching the two categories called out in scope
// ("a real strong pair or shared-role match"). "founder-investor-moderate"
// and "community-builder" both have the same score (10) as "same-role" and
// "unspecified", but neither represents a specific, verified identity match
// the way "strong"/"aligned"/"same-role" do -- so they're excluded too,
// alongside "weak" and "unspecified". Flagged in the report for review.
// ---------------------------------------------------------------------------
const MEANINGFUL_ROLE_PAIR_TYPES = new Set(["founder-investor-aligned", "strong", "same-role"]);

function meaningfulRolePairs(roles: MatchedRolePair[]): MatchedRolePair[] {
  return roles.filter((role) => MEANINGFUL_ROLE_PAIR_TYPES.has(role.pairType));
}

const normalize = (value: string) => value.trim().toLowerCase();

function ownGoals(profile: MatchDetailProfile): string[] {
  return [profile.primary_goal, ...profile.secondary_goals].filter((goal): goal is string => Boolean(goal));
}

function ownRoles(profile: MatchDetailProfile): string[] {
  return [profile.role_type, ...profile.secondary_role_types].filter((role): role is string => Boolean(role));
}

/** True only if `value` matches something in currentValues; ambiguous/stale values default to "not the viewer's" rather than risk mislabeling. */
function ownedByCurrentUser(value: string, currentValues: string[]): boolean {
  const key = normalize(value);
  return currentValues.some((candidate) => normalize(candidate) === key);
}

function orientToCurrentUserFirst(a: string, b: string, currentValues: string[]): ClickPair {
  return ownedByCurrentUser(a, currentValues) ? { labelA: a, labelB: b } : { labelA: b, labelB: a };
}

/** Every needs/offers match, pooled from both stored directions and re-classified by which live profile's need it actually satisfies -- independent of which raw direction (AToB/BToA) it was stored under. */
function classifyNeedsOffersByOwnership(
  matchDetail: MatchDetailResult,
  details: ParsedMatchDetails,
): { toCurrentUser: NeedsOffersPair[]; toOtherPerson: NeedsOffersPair[] } {
  const pooled = [...details.needsOffersAToB, ...details.needsOffersBToA];
  const currentNeeds = matchDetail.currentUser.needs;
  const otherNeeds = matchDetail.otherPerson.needs;

  const toCurrentUser: NeedsOffersPair[] = []; // other person's offer satisfies the current user's need
  const toOtherPerson: NeedsOffersPair[] = []; // current user's offer satisfies the other person's need

  for (const match of pooled) {
    const key = normalize(match.need);
    if (currentNeeds.some((need) => normalize(need) === key)) {
      toCurrentUser.push(match);
    } else if (otherNeeds.some((need) => normalize(need) === key)) {
      toOtherPerson.push(match);
    }
    // else: the need no longer appears on either live profile (e.g. edited
    // since match generation) -- silently dropped rather than guessed at.
  }

  return { toCurrentUser, toOtherPerson };
}

function sharedExpertise(matchDetail: MatchDetailResult): string[] {
  const otherSet = new Set(matchDetail.otherPerson.areas_of_expertise.map(normalize));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of matchDetail.currentUser.areas_of_expertise) {
    const key = normalize(item);
    if (otherSet.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function firstName(fullName: string | null): string {
  const trimmed = (fullName ?? "").trim();
  return trimmed.split(/\s+/)[0] || "This person";
}

function listify(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * High-level summary, one sentence per signal tier in the formula's actual
 * weighting order: needs/offers (weight 30) -> goals (weight 20) ->
 * role/expertise (weight 15/15, tied -- role shown when a meaningful pairing
 * exists, otherwise shared expertise). Only tiers with real data contribute
 * a sentence; nothing is padded to fill space.
 */
export function buildWhyThisMakesSense(matchDetail: MatchDetailResult): string {
  const details = parseMatchDetails(matchDetail.match.matchDetails);
  const otherName = firstName(matchDetail.otherPerson.full_name);
  const sentences: string[] = [];

  const { toCurrentUser, toOtherPerson } = classifyNeedsOffersByOwnership(matchDetail, details);
  if (toCurrentUser.length > 0 && toOtherPerson.length > 0) {
    sentences.push(
      `You each have something the other is looking for -- ${otherName} can offer ${listify(toCurrentUser.map((m) => m.offer))}, and you can offer ${listify(toOtherPerson.map((m) => m.offer))}.`,
    );
  } else if (toCurrentUser.length > 0) {
    sentences.push(`${otherName} can offer ${listify(toCurrentUser.map((m) => m.offer))}, which is exactly what you're looking for.`);
  } else if (toOtherPerson.length > 0) {
    sentences.push(`You can offer ${listify(toOtherPerson.map((m) => m.offer))}, which is exactly what ${otherName} is looking for.`);
  }

  const currentGoals = ownGoals(matchDetail.currentUser);
  const complementaryGoal = details.matchedGoals.find((goal) => goal.type === "complementary");
  const sharedGoal = details.matchedGoals.find((goal) => goal.type === "shared");
  if (complementaryGoal) {
    const oriented = orientToCurrentUserFirst(complementaryGoal.goalA, complementaryGoal.goalB, currentGoals);
    sentences.push(`Your goal of "${oriented.labelA}" complements ${otherName}'s goal of "${oriented.labelB}".`);
  } else if (sharedGoal) {
    sentences.push(`You're both focused on "${sharedGoal.goalA}" right now.`);
  }

  const strongRoles = meaningfulRolePairs(details.matchedRoles);
  if (strongRoles.length > 0) {
    const pair = strongRoles[0];
    sentences.push(`${pair.roleA} and ${pair.roleB} tend to be a strong pairing at events like this.`);
  } else {
    const expertise = sharedExpertise(matchDetail);
    if (expertise.length > 0) {
      sentences.push(`You both have expertise in ${listify(expertise)}.`);
    }
  }

  if (sentences.length === 0) {
    return "There isn't a strong signal here yet based on what's been shared -- worth a conversation to find out more.";
  }
  return sentences.join(" ");
}

/**
 * The structured pairs themselves (not prose), for the paired-pill UI:
 * complementary/shared goal pairs, meaningful role pairs only (weak/
 * unspecified pairings are omitted -- see MEANINGFUL_ROLE_PAIR_TYPES above),
 * and every needs<->offers match in both directions. Shared interests are
 * deliberately excluded per scope.
 */
export function buildWhyItClicks(matchDetail: MatchDetailResult): ClickPair[] {
  const details = parseMatchDetails(matchDetail.match.matchDetails);
  const currentGoals = ownGoals(matchDetail.currentUser);
  const currentRoles = ownRoles(matchDetail.currentUser);

  const pairs: ClickPair[] = [];

  for (const goal of details.matchedGoals) {
    pairs.push(orientToCurrentUserFirst(goal.goalA, goal.goalB, currentGoals));
  }

  for (const role of meaningfulRolePairs(details.matchedRoles)) {
    pairs.push(orientToCurrentUserFirst(role.roleA, role.roleB, currentRoles));
  }

  for (const match of [...details.needsOffersAToB, ...details.needsOffersBToA]) {
    pairs.push({ labelA: match.need, labelB: match.offer });
  }

  return pairs;
}

/** The current user's offers that satisfied the other person's needs. */
export function buildWhatYouCanOfferThem(matchDetail: MatchDetailResult): string[] {
  const details = parseMatchDetails(matchDetail.match.matchDetails);
  const { toOtherPerson } = classifyNeedsOffersByOwnership(matchDetail, details);
  return toOtherPerson.map((match) => match.offer);
}

/** The other person's offers that satisfied the current user's needs. */
export function buildWhatTheyCanOfferYou(matchDetail: MatchDetailResult): string[] {
  const details = parseMatchDetails(matchDetail.match.matchDetails);
  const { toCurrentUser } = classifyNeedsOffersByOwnership(matchDetail, details);
  return toCurrentUser.map((match) => match.offer);
}

export function buildFullProfileExplanation(matchDetail: MatchDetailResult): FullProfileExplanation {
  return {
    whyThisMakesSense: buildWhyThisMakesSense(matchDetail),
    whyItClicks: buildWhyItClicks(matchDetail),
    whatYouCanOfferThem: buildWhatYouCanOfferThem(matchDetail),
    whatTheyCanOfferYou: buildWhatTheyCanOfferYou(matchDetail),
  };
}
