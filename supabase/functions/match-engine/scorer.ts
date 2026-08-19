// Core scoring function for the OOO Intelligence matching engine.
//
// Self-contained on purpose: this will eventually run inside a Supabase Edge
// Function (Deno runtime), which can't import from the Vite `src/` app tree.
// The Profile shape below is a trimmed, scoring-relevant subset of the real
// `profiles` table columns (see src/integrations/supabase/types.ts).

export interface Profile {
  id: string;
  full_name: string | null;
  location: string | null;
  role_type: string | null;
  secondary_role_types: string[];
  company: string | null;
  title: string | null;
  who_to_meet: string[] | null;
  desired_outcomes: string[] | null;
  areas_of_expertise: string[] | null;
  matching_goal: string | null;
  primary_goal: string | null;
  secondary_goals: string[] | null;
  role_details: Record<string, unknown> | null;
  industry_focus: string[] | null;
  needs: string[] | null;
  offers: string[] | null;
  connection_preference?: string[] | null;
  interests: string[] | null;
  communities: string[] | null;
  hobbies: string[] | null;
  music_interests: string[] | null;
  favorite_conferences: string[] | null;
}

export interface ScoreBreakdown {
  eventGoalAlignment: number;
  whoToMeetAlignment: number;
  roleComplementarity: number;
  expertiseAlignment: number;
  sharedInterests: number;
  locationRelevance: number;
  needsOffersAToB: number;
  needsOffersBToA: number;
  needsOffersReciprocal: number;
  opportunityCompatibility: number | null;
  timingConnectionCompatibility: number | null;
}

export interface MatchResult {
  score: number;
  label: string;
  scoreBreakdown: ScoreBreakdown;
  matchReasons: string[];
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

const norm = (value: string) => value.trim().toLowerCase();

/** Items present in both arrays (case-insensitive), de-duplicated. */
function overlap(a?: string[] | null, b?: string[] | null): string[] {
  if (!a?.length || !b?.length) return [];
  const bSet = new Set(b.map(norm));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of a) {
    const key = norm(item);
    if (bSet.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

const firstName = (profile: Profile) => (profile.full_name ?? "This attendee").split(" ")[0];

function roleDetailString(profile: Profile, role: string, key: string): string | null {
  const namespace = profile.role_details?.[role];
  const value =
    namespace !== null && typeof namespace === "object" && !Array.isArray(namespace)
      ? (namespace as Record<string, unknown>)[key]
      : undefined;
  return typeof value === "string" ? value : null;
}

function roleDetailArray(profile: Profile, role: string, key: string): string[] {
  const namespace = profile.role_details?.[role];
  const value =
    namespace !== null && typeof namespace === "object" && !Array.isArray(namespace)
      ? (namespace as Record<string, unknown>)[key]
      : undefined;
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// ---------------------------------------------------------------------------
// 1. Event Goal Alignment (30 points max)
// ---------------------------------------------------------------------------

// Pairs use only the current Page 2 goal vocabulary and are symmetric.
const COMPLEMENTARY_GOAL_PAIRS: [string, string][] = [
  ["Find Customers or Clients", "Take On New Clients"],
  ["Build Business Partnerships", "Meet Collaborators"],
  ["Meet Investors", "Raise Capital"],
  ["Meet Investors", "Explore Investment Opportunities"],
  ["Raise Capital", "Explore Investment Opportunities"],
  ["Hire Talent", "Explore Career Opportunities"],
  ["Find Brand Partners", "Gain Visibility"],
  ["Find Sponsorship Opportunities", "Gain Visibility"],
  ["Meet Investors", "Meet Collaborators"],
  ["Meet Collaborators", "Collaborate on Products"],
  ["Meet Collaborators", "Collaborate on Content"],
  ["Find a Mentor", "Mentor Others"],
  ["Mentor Others", "Learn From Experts"],
  ["Build Community", "Make Social Connections"],
  ["Build Community", "Meet Great People Without a Specific Ask"],
  ["Find Media / Press Opportunities", "Collaborate on Content"],
  ["Meet People in My City", "Meet People in a New City"],
  ["Explore Opportunities Generally", "Meet Great People Without a Specific Ask"],
];

function selectedGoals(profile: Profile): string[] {
  const modernGoals = [profile.primary_goal, ...(profile.secondary_goals ?? [])].filter(
    (goal): goal is string => Boolean(goal),
  );
  const source = modernGoals.length > 0 ? modernGoals : profile.matching_goal ? [profile.matching_goal] : [];
  const seen = new Set<string>();
  return source.filter((goal) => {
    const key = norm(goal);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function complementaryGoalPair(a: Profile, b: Profile): [string, string] | null {
  const goalsA = selectedGoals(a);
  const goalsB = selectedGoals(b);

  for (const goalA of goalsA) {
    for (const goalB of goalsB) {
      const isComplementary = COMPLEMENTARY_GOAL_PAIRS.some(
        ([left, right]) =>
          (norm(goalA) === norm(left) && norm(goalB) === norm(right)) ||
          (norm(goalA) === norm(right) && norm(goalB) === norm(left)),
      );
      if (isComplementary) return [goalA, goalB];
    }
  }

  return null;
}

function calculateEventGoalAlignment(a: Profile, b: Profile): number {
  if (complementaryGoalPair(a, b)) return 30;
  return overlap(selectedGoals(a), selectedGoals(b)).length > 0 ? 15 : 0;
}

// ---------------------------------------------------------------------------
// 2. Who They Want To Meet Alignment (20 points max)
// ---------------------------------------------------------------------------

// `who_to_meet` uses broad plural categories while `role_type` uses the full
// 16-value identity vocabulary. Map each identity to its intended category.
// "Other" is deliberately unmapped because it has no meaningful category.
const ROLE_TYPE_TO_WHO_TO_MEET_LABEL: Record<string, string> = {
  "founder / co-founder": "founders",
  investor: "investors",
  recruiter: "recruiters",
  "hiring manager": "hiring managers",
  "corporate professional": "professionals",
  "entrepreneur / small business owner": "founders",
  "creator / influencer": "creators",
  "consultant / service provider": "service providers",
  "brand / partnership leader": "brand partners",
  "community builder": "community builders",
  "nonprofit leader": "community builders",
  executive: "professionals",
  "student / recent graduate": "students",
  "press / media": "press / media",
  "speaker / thought leader": "speakers",
};

function wantsRole(
  whoToMeet: string[] | null | undefined,
  roleType: string | null,
  secondaryRoleTypes: string[],
): boolean {
  const wantedRoles = new Set((whoToMeet ?? []).map(norm));
  return [roleType, ...secondaryRoleTypes].some((role) => {
    if (!role) return false;
    const label = ROLE_TYPE_TO_WHO_TO_MEET_LABEL[norm(role)];
    return label ? wantedRoles.has(label) : false;
  });
}

function calculateWhoToMeetAlignment(a: Profile, b: Profile): number {
  const aWantsB = wantsRole(a.who_to_meet, b.role_type, b.secondary_role_types);
  const bWantsA = wantsRole(b.who_to_meet, a.role_type, a.secondary_role_types);
  if (aWantsB && bWantsA) return 20;
  if (aWantsB || bWantsA) return 10;
  return 0;
}

// ---------------------------------------------------------------------------
// 3. Role Complementarity (20 points max)
// ---------------------------------------------------------------------------

const pairKey = (roleA: string, roleB: string) => [norm(roleA), norm(roleB)].sort().join("|");

const STRONG_PAIRS = new Set(
  ([
    ["Founder / Co-founder", "Investor"],
    ["Recruiter", "Corporate Professional"],
    ["Hiring Manager", "Corporate Professional"],
    ["Creator / Influencer", "Brand / Partnership Leader"],
    ["Founder / Co-founder", "Recruiter"],
  ] as [string, string][]).map(([x, y]) => pairKey(x, y)),
);

const MODERATE_SAME_ROLE_PAIRS = new Set(
  (["Founder / Co-founder", "Corporate Professional", "Investor", "Creator / Influencer"] as string[]).map(
    (r) => pairKey(r, r),
  ),
);

const WEAK_PAIRS = new Set(
  ([
    ["Recruiter", "Investor"],
    ["Brand / Partnership Leader", "Investor"],
    ["Student / Recent Graduate", "Investor"],
  ] as [string, string][]).map(([x, y]) => pairKey(x, y)),
);

function calculateRolePairComplementarity(a: Profile, b: Profile, roleA: string, roleB: string): number {
  const key = pairKey(roleA, roleB);

  // Founder + Investor gets its own depth check instead of the flat 20.
  const isFounderInvestor = key === pairKey("Founder / Co-founder", "Investor");
  if (isFounderInvestor) {
    const founder = norm(roleA) === "founder / co-founder" ? a : b;
    const investor = norm(roleA) === "investor" ? a : b;
    const isRaising = roleDetailString(founder, "Founder", "lookingForInvestors") === "Yes";
    const focusOverlap = overlap(
      founder.industry_focus,
      roleDetailArray(investor, "Investor", "investmentFocusAreas"),
    );
    // Spec: "add 5 bonus points (cap total component at 20)" when aligned,
    // otherwise "treat as moderate (10) instead of strong". Base strong is
    // already 20, so a passing depth check just confirms the full 20 rather
    // than literally exceeding it -- the practical effect is a binary
    // 20-if-aligned / 10-if-not outcome, implemented directly below.
    return isRaising && focusOverlap.length > 0 ? 20 : 10;
  }

  if (STRONG_PAIRS.has(key)) return 20;
  if (WEAK_PAIRS.has(key)) return 0;
  if (norm(roleA) === "community builder" || norm(roleB) === "community builder") return 10;
  if (MODERATE_SAME_ROLE_PAIRS.has(key)) return 10;

  // No explicit rule for this combination. Default to moderate rather than
  // penalizing pairings the product owner didn't rule on either way.
  return 10;
}

function calculateRoleComplementarity(a: Profile, b: Profile): number {
  const rolesA = [a.role_type, ...a.secondary_role_types].filter((role): role is string => Boolean(role));
  const rolesB = [b.role_type, ...b.secondary_role_types].filter((role): role is string => Boolean(role));
  if (rolesA.length === 0 || rolesB.length === 0) return 0;

  const pairingScores = rolesA.flatMap((roleA) =>
    rolesB.map((roleB) => calculateRolePairComplementarity(a, b, roleA, roleB)),
  );

  return Math.max(...pairingScores);
}

// ---------------------------------------------------------------------------
// 4. Areas of Expertise Alignment (15 points max)
// ---------------------------------------------------------------------------

function calculateExpertiseAlignment(a: Profile, b: Profile): number {
  const shared = overlap(a.areas_of_expertise, b.areas_of_expertise).length;
  if (shared >= 3) return 15;
  if (shared === 2) return 10;
  if (shared === 1) return 5;
  return 0;
}

// ---------------------------------------------------------------------------
// 5. Shared Interests and Communities (10 points max)
// ---------------------------------------------------------------------------

function calculateSharedInterests(a: Profile, b: Profile): number {
  const total =
    overlap(a.interests, b.interests).length +
    overlap(a.communities, b.communities).length +
    overlap(a.hobbies, b.hobbies).length +
    overlap(a.music_interests, b.music_interests).length +
    overlap(a.favorite_conferences, b.favorite_conferences).length;

  if (total >= 3) return 10;
  if (total === 2) return 7;
  if (total === 1) return 3;
  return 0;
}

// ---------------------------------------------------------------------------
// 6. Location Relevance (5 points max)
// ---------------------------------------------------------------------------

function calculateLocationRelevance(a: Profile, b: Profile): number {
  if (!a.location || !b.location) return 0;
  return norm(a.location) === norm(b.location) ? 5 : 0;
}

// ---------------------------------------------------------------------------
// Standalone needs/offers compatibility (not yet part of calculateMatchScore)
// ---------------------------------------------------------------------------

// Mirrors the approved near-match rows in needs_offers_compatibility. Exact
// need/offer text matches are handled directly and always take precedence.
const EXACT_NEEDS_OFFERS_MATCHES = new Set(
  [
    "Investor Introductions",
    "Customer Introductions",
    "Partnership Introductions",
    "Talent Referrals",
    "Job Referrals",
    "Brand Opportunities",
    "Sponsorship Opportunities",
    "Media / Press Opportunities",
    "Speaking Opportunities",
    "Mentorship",
    "Strategic Advice",
    "Product Feedback",
    "Community Building",
    "Content Creation",
    "Creative Direction",
    "Financial Strategy",
    "Legal / Compliance Guidance",
    "Event / Experience Strategy",
    "Local City Knowledge",
    "Accountability / Peer Support",
    "Social Connection / Friendship",
  ].map(norm),
);

const NEAR_NEEDS_OFFERS_MATCHES: Record<string, Set<string>> = {
  "finding customers": new Set([
    "customer introductions",
    "sales expertise",
    "business development expertise",
  ]),
  "raising capital": new Set(["investment capital", "fundraising advice"]),
  "hiring talent": new Set(["hiring opportunities", "talent referrals"]),
  "finding a new role": new Set(["hiring opportunities", "career advice"]),
  "career growth": new Set(["career advice", "mentorship", "founder advice"]),
  "building partnerships": new Set(["partnership introductions", "business development expertise"]),
  "finding brand partners": new Set(["brand opportunities", "brand expertise"]),
  "brand strategy": new Set(["brand expertise"]),
  marketing: new Set(["marketing expertise"]),
  "sales / business development": new Set(["sales expertise", "business development expertise"]),
  "product development": new Set(["product expertise"]),
  "technology / engineering": new Set(["technical expertise", "engineering expertise"]),
  operations: new Set(["operations expertise"]),
  recruiting: new Set(["hiring opportunities", "talent referrals"]),
  "fundraising strategy": new Set(["fundraising advice", "investment capital"]),
  "social media": new Set(["social media expertise"]),
  design: new Set(["design expertise"]),
  "data / analytics": new Set(["data / analytics expertise"]),
  "entering a new industry": new Set(["industry knowledge"]),
  "entering a new market": new Set(["industry knowledge", "strategic advice"]),
  "meeting people locally": new Set(["local city knowledge", "community connections"]),
};

/**
 * Scores how well one person's offers satisfy another person's needs.
 * Directional by design: reciprocal scoring belongs in the future formula.
 */
export function calculateNeedsOffersScore(personANeeds: string[], personBOffers: string[]): number {
  if (personANeeds.length === 0 || personBOffers.length === 0) return 0;

  const normalizedOffers = new Set(personBOffers.map(norm));
  const totalCredit = personANeeds.reduce((sum, need) => {
    const normalizedNeed = norm(need);

    if (EXACT_NEEDS_OFFERS_MATCHES.has(normalizedNeed) && normalizedOffers.has(normalizedNeed)) {
      return sum + 1;
    }

    const compatibleOffers = NEAR_NEEDS_OFFERS_MATCHES[normalizedNeed];
    const hasNearMatch = compatibleOffers
      ? [...normalizedOffers].some((offer) => compatibleOffers.has(offer))
      : false;

    return sum + (hasNearMatch ? 0.7 : 0);
  }, 0);

  return (totalCredit / personANeeds.length) * 100;
}

// ---------------------------------------------------------------------------
// Standalone opportunity/stage compatibility (not in calculateMatchScore)
// ---------------------------------------------------------------------------

type CompatibilityTier = 0 | 1 | 2;

const COMPANY_STAGE_TIERS: Record<string, CompatibilityTier> = {
  "idea stage": 0,
  "pre-seed": 0,
  seed: 1,
  "series a": 1,
  "series b+": 2,
  bootstrapped: 2,
  "acquired / exited": 2,
  "acquired-exited": 2,
};

const CHECK_SIZE_TIERS: Record<string, CompatibilityTier> = {
  "under $25k": 0,
  "$25k-$100k": 0,
  "$100k-$500k": 1,
  "$500k+": 2,
};

function normalizedTierKey(value: string): string {
  return norm(value).replaceAll("–", "-").replaceAll("—", "-");
}

function identityIncludes(profile: Profile, identity: string): boolean {
  return [profile.role_type, ...profile.secondary_role_types].some(
    (role) => typeof role === "string" && norm(role) === norm(identity),
  );
}

function tierCompatibility(tierA: CompatibilityTier, tierB: CompatibilityTier): number {
  const difference = Math.abs(tierA - tierB);
  if (difference === 0) return 100;
  if (difference === 1) return 50;
  return 10;
}

/**
 * Scores the stage fit for a Founder / Co-founder and Investor pair.
 * Returns null when the pairing or required stage/check-size data is absent.
 */
export function calculateOpportunityCompatibility(personA: Profile, personB: Profile): number | null {
  const founderAInvestorB =
    identityIncludes(personA, "Founder / Co-founder") && identityIncludes(personB, "Investor");
  const founderBInvestorA =
    identityIncludes(personB, "Founder / Co-founder") && identityIncludes(personA, "Investor");
  const founder = founderAInvestorB ? personA : founderBInvestorA ? personB : null;
  const investor = founderAInvestorB ? personB : founderBInvestorA ? personA : null;

  if (!founder || !investor) return null;

  const companyStage = roleDetailString(founder, "Founder", "companyStage");
  const checkSize = roleDetailString(investor, "Investor", "checkSize");
  if (!companyStage || !checkSize) return null;

  const stageTier = COMPANY_STAGE_TIERS[normalizedTierKey(companyStage)];
  const checkSizeTier = CHECK_SIZE_TIERS[normalizedTierKey(checkSize)];
  if (stageTier === undefined || checkSizeTier === undefined) return null;

  return tierCompatibility(stageTier, checkSizeTier);
}

// ---------------------------------------------------------------------------
// Standalone timing/connection compatibility (not in calculateMatchScore)
// ---------------------------------------------------------------------------

const TIMING_URGENCY_TIERS: Record<string, CompatibilityTier> = {
  "exploring for the future": 0,
  "open to building investor relationships": 0,
  "building a future talent pipeline": 0,
  "not currently searching": 0,
  "preparing to raise within 6 months": 1,
  "hiring within 3-6 months": 1,
  "open to the right opportunity": 1,
  "planning to explore within 6 months": 1,
  "actively raising": 2,
  "actively hiring": 2,
  "actively searching": 2,
};

function connectionPreferenceOverlap(a: Profile, b: Profile): number | null {
  const preferencesA = new Set((a.connection_preference ?? []).map(norm));
  const preferencesB = new Set((b.connection_preference ?? []).map(norm));
  if (preferencesA.size === 0 || preferencesB.size === 0) return null;

  const allPreferences = new Set([...preferencesA, ...preferencesB]);
  const sharedCount = [...preferencesA].filter((preference) => preferencesB.has(preference)).length;
  return (sharedCount / allPreferences.size) * 100;
}

function timingUrgency(profile: Profile): CompatibilityTier | null {
  const timingValues = [
    roleDetailString(profile, "Founder", "fundraisingTimeline"),
    roleDetailString(profile, "Recruiter", "hiringTimeline"),
    roleDetailString(profile, "Hiring Manager", "hiringTimeline"),
    roleDetailString(profile, "CareerSeeker", "searchStatus"),
  ];
  const tiers = timingValues
    .filter((value): value is string => Boolean(value))
    .map((value) => TIMING_URGENCY_TIERS[norm(value)])
    .filter((tier): tier is CompatibilityTier => tier !== undefined);

  return tiers.length > 0 ? (Math.max(...tiers) as CompatibilityTier) : null;
}

function timingUrgencyAlignment(a: Profile, b: Profile): number | null {
  const urgencyA = timingUrgency(a);
  const urgencyB = timingUrgency(b);
  return urgencyA === null || urgencyB === null ? null : tierCompatibility(urgencyA, urgencyB);
}

/**
 * Averages the compatibility signals that both people actually supplied.
 * Missing data is ignored; null means neither comparable signal is available.
 */
export function calculateTimingConnectionCompatibility(personA: Profile, personB: Profile): number | null {
  const scores = [connectionPreferenceOverlap(personA, personB), timingUrgencyAlignment(personA, personB)].filter(
    (score): score is number => score !== null,
  );

  return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}

// ---------------------------------------------------------------------------
// final weighted formula helpers
// ---------------------------------------------------------------------------

interface WeightedCategory {
  value: number | null;
  weight: number;
}

function reciprocalNeedsOffers(aToB: number, bToA: number): number {
  if (aToB <= 0 || bToA <= 0) return 0;
  return (2 * aToB * bToA) / (aToB + bToA);
}

function normalizeIngredient(value: number, maximum: number): number {
  return (value / maximum) * 100;
}

function weightedScoreWithRedistribution(categories: WeightedCategory[]): number {
  const applicable = categories.filter(
    (category): category is { value: number; weight: number } => category.value !== null,
  );
  const applicableWeight = applicable.reduce((sum, category) => sum + category.weight, 0);
  if (applicableWeight === 0) return 0;

  return applicable.reduce((sum, category) => sum + category.value * category.weight, 0) / applicableWeight;
}

// ---------------------------------------------------------------------------
// match label
// ---------------------------------------------------------------------------

function getMatchLabel(score: number): string {
  if (score >= 75) return "Strong Match";
  if (score >= 50) return "Good Match";
  if (score >= 25) return "Potential Match";
  return "No Match";
}

// ---------------------------------------------------------------------------
// match reasons
// ---------------------------------------------------------------------------

function generateMatchReasons(a: Profile, b: Profile, breakdown: ScoreBreakdown): string[] {
  const reasons: string[] = [];
  const nameA = firstName(a);
  const nameB = firstName(b);

  // Founder / Co-founder <-> Investor fundraising story, if that's actually the pairing.
  const roleA = a.role_type ? norm(a.role_type) : "";
  const roleB = b.role_type ? norm(b.role_type) : "";
  if (
    (roleA === "founder / co-founder" && roleB === "investor") ||
    (roleA === "investor" && roleB === "founder / co-founder")
  ) {
    const founder = roleA === "founder / co-founder" ? a : b;
    const investor = roleA === "investor" ? a : b;
    const founderName = firstName(founder);
    const investorName = firstName(investor);
    const isRaising = roleDetailString(founder, "Founder", "lookingForInvestors") === "Yes";
    const stage = roleDetailString(founder, "Founder", "companyStage");
    const focus = roleDetailArray(investor, "Investor", "investmentFocusAreas");
    if (isRaising) {
      const stagePart = stage ? ` (${stage})` : "";
      const focusPart = focus.length ? ` in ${focus.slice(0, 2).join(" and ")}` : "";
      reasons.push(`${founderName} is actively fundraising${stagePart} and ${investorName} invests${focusPart}.`);
    }
  }

  // Event goal alignment
  if (breakdown.eventGoalAlignment >= 30) {
    const pair = complementaryGoalPair(a, b);
    if (pair) reasons.push(`${nameA}'s goal of "${pair[0]}" complements ${nameB}'s goal of "${pair[1]}".`);
  } else if (breakdown.eventGoalAlignment === 15) {
    const sharedGoal = overlap(selectedGoals(a), selectedGoals(b))[0];
    if (sharedGoal) reasons.push(`Both are focused on "${sharedGoal}" at the event.`);
  }

  // Who to meet mutual interest
  if (breakdown.whoToMeetAlignment === 20) {
    reasons.push(`${nameA} wants to meet ${b.role_type ?? "this role"}s and ${nameB} wants to meet ${a.role_type ?? "this role"}s.`);
  }

  // Expertise overlap
  const sharedExpertise = overlap(a.areas_of_expertise, b.areas_of_expertise);
  if (sharedExpertise.length >= 1) {
    reasons.push(`Shared expertise in ${sharedExpertise.slice(0, 3).join(" and ")}.`);
  }

  // Shared interests/communities
  const sharedInterestPool = [
    ...overlap(a.interests, b.interests),
    ...overlap(a.communities, b.communities),
    ...overlap(a.hobbies, b.hobbies),
    ...overlap(a.music_interests, b.music_interests),
    ...overlap(a.favorite_conferences, b.favorite_conferences),
  ];
  if (sharedInterestPool.length >= 1) {
    reasons.push(`Both share an interest in ${sharedInterestPool.slice(0, 2).join(" and ")}.`);
  }

  // Location
  if (breakdown.locationRelevance === 5) {
    reasons.push(`Both are based in ${a.location}.`);
  }

  // Role complementarity fallback story (only if nothing more specific fired)
  if (reasons.length === 0 && breakdown.roleComplementarity >= 10) {
    reasons.push(`${a.role_type ?? "This attendee"} and ${b.role_type ?? "this attendee"} are a natural pairing at this event.`);
  }

  if (reasons.length === 0) {
    reasons.push("Attending the same event with some overlap in goals and background.");
  }

  return reasons.slice(0, 3);
}

// ---------------------------------------------------------------------------
// main export
// ---------------------------------------------------------------------------

export function calculateMatchScore(profileA: Profile, profileB: Profile): MatchResult {
  const needsOffersAToB = calculateNeedsOffersScore(profileA.needs ?? [], profileB.offers ?? []);
  const needsOffersBToA = calculateNeedsOffersScore(profileB.needs ?? [], profileA.offers ?? []);
  const opportunityCompatibility = calculateOpportunityCompatibility(profileA, profileB);
  const timingConnectionCompatibility = calculateTimingConnectionCompatibility(profileA, profileB);

  const scoreBreakdown: ScoreBreakdown = {
    eventGoalAlignment: calculateEventGoalAlignment(profileA, profileB),
    whoToMeetAlignment: calculateWhoToMeetAlignment(profileA, profileB),
    roleComplementarity: calculateRoleComplementarity(profileA, profileB),
    expertiseAlignment: calculateExpertiseAlignment(profileA, profileB),
    sharedInterests: calculateSharedInterests(profileA, profileB),
    locationRelevance: calculateLocationRelevance(profileA, profileB),
    needsOffersAToB,
    needsOffersBToA,
    needsOffersReciprocal: reciprocalNeedsOffers(needsOffersAToB, needsOffersBToA),
    opportunityCompatibility,
    timingConnectionCompatibility,
  };

  const targetPersonRole =
    (normalizeIngredient(scoreBreakdown.whoToMeetAlignment, 20) +
      normalizeIngredient(scoreBreakdown.roleComplementarity, 20)) /
    2;
  const context =
    (normalizeIngredient(scoreBreakdown.sharedInterests, 10) +
      normalizeIngredient(scoreBreakdown.locationRelevance, 5)) /
    2;

  const weightedScore = weightedScoreWithRedistribution([
    { value: scoreBreakdown.needsOffersReciprocal, weight: 30 },
    { value: normalizeIngredient(scoreBreakdown.eventGoalAlignment, 30), weight: 20 },
    { value: targetPersonRole, weight: 15 },
    { value: normalizeIngredient(scoreBreakdown.expertiseAlignment, 15), weight: 15 },
    { value: scoreBreakdown.opportunityCompatibility, weight: 10 },
    { value: scoreBreakdown.timingConnectionCompatibility, weight: 5 },
    { value: context, weight: 5 },
  ]);
  const score = Math.round(Math.min(100, Math.max(0, weightedScore)));

  return {
    score,
    label: getMatchLabel(score),
    scoreBreakdown,
    matchReasons: generateMatchReasons(profileA, profileB, scoreBreakdown),
  };
}
