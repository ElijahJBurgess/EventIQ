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
  company: string | null;
  title: string | null;
  who_to_meet: string[] | null;
  desired_outcomes: string[] | null;
  areas_of_expertise: string[] | null;
  matching_goal: string | null;
  role_details: Record<string, unknown> | null;
  industry_focus: string[] | null;
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

function roleDetailString(profile: Profile, key: string): string | null {
  const value = profile.role_details?.[key];
  return typeof value === "string" ? value : null;
}

function roleDetailArray(profile: Profile, key: string): string[] {
  const value = profile.role_details?.[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// ---------------------------------------------------------------------------
// 1. Event Goal Alignment (30 points max)
// ---------------------------------------------------------------------------

// Pairs are checked symmetrically (order doesn't matter).
// Two of these pairs reference "Career Opportunities" and "Business
// Development", which are `desired_outcomes` values, not valid
// `matching_goal` values (matching_goal has no such options). Comparing
// matching_goal-to-matching_goal alone would make those two pairs dead code
// that can never fire. We treat them as a deliberate cross-field rule
// instead: one profile's matching_goal against the other profile's
// desired_outcomes. This is flagged in the report — it's an interpretation
// of an inconsistency in the spec, not a literal reading.
const COMPLEMENTARY_GOAL_PAIRS: [string, string][] = [
  ["Meet Investors", "Meet Customers"],
  ["Find Talent", "Career Opportunities"], // cross-field: matching_goal <-> desired_outcomes
  ["Meet Investors", "Meet Collaborators"],
  ["Build Community", "General Networking"],
  ["Meet Customers", "Business Development"], // cross-field: matching_goal <-> desired_outcomes
  ["Find Talent", "Learn From Industry Leaders"],
];

const CROSS_FIELD_GOAL_VALUES = new Set(["Career Opportunities", "Business Development"]);

function calculateEventGoalAlignment(a: Profile, b: Profile): number {
  const goalA = a.matching_goal;
  const goalB = b.matching_goal;
  if (!goalA || !goalB) return 0;

  if (norm(goalA) === norm(goalB)) return 15; // same goal, half points

  for (const [x, y] of COMPLEMENTARY_GOAL_PAIRS) {
    const isCrossField = CROSS_FIELD_GOAL_VALUES.has(x) || CROSS_FIELD_GOAL_VALUES.has(y);

    const straight = norm(goalA) === norm(x) && norm(goalB) === norm(y);
    const reversed = norm(goalA) === norm(y) && norm(goalB) === norm(x);
    if (straight || reversed) return 30;

    if (isCrossField) {
      // one side's matching_goal against the other side's desired_outcomes
      const aGoalMatchesX = norm(goalA) === norm(x) && (b.desired_outcomes ?? []).some((o) => norm(o) === norm(y));
      const bGoalMatchesX = norm(goalB) === norm(x) && (a.desired_outcomes ?? []).some((o) => norm(o) === norm(y));
      const aGoalMatchesY = norm(goalA) === norm(y) && (b.desired_outcomes ?? []).some((o) => norm(o) === norm(x));
      const bGoalMatchesY = norm(goalB) === norm(y) && (a.desired_outcomes ?? []).some((o) => norm(o) === norm(x));
      if (aGoalMatchesX || bGoalMatchesX || aGoalMatchesY || bGoalMatchesY) return 30;
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------
// 2. Who They Want To Meet Alignment (20 points max)
// ---------------------------------------------------------------------------

// `who_to_meet` values (from Page2MatchingPrefs) are plural role-ish labels
// ("Founders", "Investors"), while `role_type` (from Page1BasicInfo) is
// singular ("Founder", "Investor"). Comparing them directly would never
// match. Map role_type -> its who_to_meet label so alignment actually works.
// "Sponsor" and "Other" have no corresponding who_to_meet option at all, so
// they can never be "wanted" through this field -- a real gap in the current
// data model, called out in the report rather than silently worked around.
const ROLE_TYPE_TO_WHO_TO_MEET_LABEL: Record<string, string> = {
  founder: "founders",
  investor: "investors",
  recruiter: "recruiters",
  "hiring manager": "hiring managers",
  creator: "creators",
  professional: "professionals",
  "brand partner": "brand partners",
  "community builder": "community builders",
  student: "students",
};

function wantsRole(whoToMeet: string[] | null | undefined, roleType: string | null): boolean {
  if (!roleType) return false;
  const label = ROLE_TYPE_TO_WHO_TO_MEET_LABEL[norm(roleType)];
  if (!label) return false; // Sponsor / Other: no matching who_to_meet option exists
  return (whoToMeet ?? []).some((r) => norm(r) === label);
}

function calculateWhoToMeetAlignment(a: Profile, b: Profile): number {
  const aWantsB = wantsRole(a.who_to_meet, b.role_type);
  const bWantsA = wantsRole(b.who_to_meet, a.role_type);
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
    ["Founder", "Investor"],
    ["Recruiter", "Professional"],
    ["Hiring Manager", "Professional"],
    ["Creator", "Brand Partner"],
    ["Founder", "Recruiter"],
  ] as [string, string][]).map(([x, y]) => pairKey(x, y)),
);

const MODERATE_SAME_ROLE_PAIRS = new Set(
  (["Founder", "Professional", "Investor", "Creator"] as string[]).map((r) => pairKey(r, r)),
);

const WEAK_PAIRS = new Set(
  ([
    ["Recruiter", "Investor"],
    ["Brand Partner", "Investor"],
    ["Student", "Investor"],
  ] as [string, string][]).map(([x, y]) => pairKey(x, y)),
);

function calculateRoleComplementarity(a: Profile, b: Profile): number {
  const roleA = a.role_type;
  const roleB = b.role_type;
  if (!roleA || !roleB) return 0;

  const key = pairKey(roleA, roleB);

  // Founder + Investor gets its own depth check instead of the flat 20.
  const isFounderInvestor = key === pairKey("Founder", "Investor");
  if (isFounderInvestor) {
    const founder = norm(roleA) === "founder" ? a : b;
    const investor = norm(roleA) === "investor" ? a : b;
    const isRaising = roleDetailString(founder, "lookingForInvestors") === "Yes";
    const focusOverlap = overlap(founder.industry_focus, roleDetailArray(investor, "investmentFocusAreas"));
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

  // No explicit rule for this combination (e.g. Founder+Creator,
  // Investor+Professional, anything involving Sponsor/Student/Other outside
  // the listed pairs). Default to moderate rather than penalizing pairings
  // the product owner didn't rule on either way.
  return 10;
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

  // Founder <-> Investor fundraising story, if that's actually the pairing.
  const roleA = a.role_type ? norm(a.role_type) : "";
  const roleB = b.role_type ? norm(b.role_type) : "";
  if ((roleA === "founder" && roleB === "investor") || (roleA === "investor" && roleB === "founder")) {
    const founder = roleA === "founder" ? a : b;
    const investor = roleA === "investor" ? a : b;
    const founderName = firstName(founder);
    const investorName = firstName(investor);
    const isRaising = roleDetailString(founder, "lookingForInvestors") === "Yes";
    const stage = roleDetailString(founder, "companyStage");
    const focus = roleDetailArray(investor, "investmentFocusAreas");
    if (isRaising) {
      const stagePart = stage ? ` (${stage})` : "";
      const focusPart = focus.length ? ` in ${focus.slice(0, 2).join(" and ")}` : "";
      reasons.push(`${founderName} is actively fundraising${stagePart} and ${investorName} invests${focusPart}.`);
    }
  }

  // Event goal alignment
  if (breakdown.eventGoalAlignment >= 30) {
    reasons.push(`${nameA}'s goal of "${a.matching_goal}" complements ${nameB}'s goal of "${b.matching_goal}".`);
  } else if (breakdown.eventGoalAlignment === 15) {
    reasons.push(`Both are focused on "${a.matching_goal}" at the event.`);
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
  const scoreBreakdown: ScoreBreakdown = {
    eventGoalAlignment: calculateEventGoalAlignment(profileA, profileB),
    whoToMeetAlignment: calculateWhoToMeetAlignment(profileA, profileB),
    roleComplementarity: calculateRoleComplementarity(profileA, profileB),
    expertiseAlignment: calculateExpertiseAlignment(profileA, profileB),
    sharedInterests: calculateSharedInterests(profileA, profileB),
    locationRelevance: calculateLocationRelevance(profileA, profileB),
  };

  const score = Math.min(
    100,
    scoreBreakdown.eventGoalAlignment +
      scoreBreakdown.whoToMeetAlignment +
      scoreBreakdown.roleComplementarity +
      scoreBreakdown.expertiseAlignment +
      scoreBreakdown.sharedInterests +
      scoreBreakdown.locationRelevance,
  );

  return {
    score,
    label: getMatchLabel(score),
    scoreBreakdown,
    matchReasons: generateMatchReasons(profileA, profileB, scoreBreakdown),
  };
}
