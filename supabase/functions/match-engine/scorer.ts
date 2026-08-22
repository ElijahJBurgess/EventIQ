// OFFRIP Matching Rubric V2. Scores are directional: viewer -> candidate.

export const SCORE_VERSION = "v2";

export interface Profile {
  id: string;
  full_name: string | null;
  location: string | null;
  location_city?: string | null;
  location_state_code?: string | null;
  location_preference?: string | null;
  role_type: string | null;
  secondary_role_types: string[];
  company: string | null;
  title: string | null;
  primary_function?: string | null;
  additional_functions?: string[] | null;
  seniority?: string | null;
  career_level_preference?: string[] | null;
  who_to_meet: string[] | null;
  desired_outcomes: string[] | null;
  areas_of_expertise: string[] | null;
  expertise_sought?: string[] | null;
  matching_goal: string | null;
  primary_goal: string | null;
  secondary_goals: string[] | null;
  role_details: Record<string, unknown> | null;
  industry_focus: string[] | null;
  industries?: string[] | null;
  industry_preference?: string | null;
  needs: string[] | null;
  offers: string[] | null;
  connection_preference?: string[] | null;
  interests: string[] | null;
  communities: string[] | null;
  hobbies: string[] | null;
  music_interests: string[] | null;
  favorite_conferences: string[] | null;
  profile_completed?: boolean | null;
  profile_completion_score?: number | null;
  updated_at?: string | null;
  linkedin_url?: string | null;
}

export type ComponentName =
  | "goalToValueFit"
  | "targetPersonFit"
  | "needToOfferFit"
  | "expertiseFit"
  | "opportunityCompatibility"
  | "timingConnectionFit"
  | "contextFit";

export interface MatchEvidenceItem {
  component: ComponentName;
  score: number;
  viewerField: string;
  viewerValue: string;
  candidateField: string;
  candidateValue: string;
  mapping: string;
}

export interface ComponentBreakdown {
  score: number | null;
  weight: number;
  evidence: MatchEvidenceItem[];
}

export type DirectionalScoreBreakdown = Record<ComponentName, ComponentBreakdown> & {
  applicableWeight: number;
  weightedPoints: number;
};

export interface ScoreBreakdown {
  aToB: DirectionalScoreBreakdown;
  bToA: DirectionalScoreBreakdown;
}

export interface MatchEvidence {
  aToB: MatchEvidenceItem[];
  bToA: MatchEvidenceItem[];
}

export interface MatchResult {
  aToBScore: number;
  bToAScore: number;
  aToBConfidence: number;
  bToAConfidence: number;
  reciprocityLabel: "You Can Help Each Other" | "They Can Help You" | "You Can Help Them" | "Potential Connection";
  scoreVersion: typeof SCORE_VERSION;
  scoreBreakdown: ScoreBreakdown;
  matchEvidence: MatchEvidence;
  aToBReasons: string[];
  bToAReasons: string[];
  // Transitional aliases for backend callers that have not switched storage yet.
  score: number;
  label: string;
  matchReasons: string[];
}

const WEIGHTS: Record<ComponentName, number> = {
  goalToValueFit: 35,
  targetPersonFit: 20,
  needToOfferFit: 15,
  expertiseFit: 10,
  opportunityCompatibility: 10,
  timingConnectionFit: 5,
  contextFit: 5,
};

const norm = (value: string) => value.trim().toLowerCase();
const present = (values?: string[] | null) => (values ?? []).filter((value) => value.trim().length > 0);
const roles = (profile: Profile) => present([profile.role_type ?? "", ...profile.secondary_role_types]);
const functions = (profile: Profile) => present([profile.primary_function ?? "", ...(profile.additional_functions ?? [])]);
const industries = (profile: Profile) => present(profile.industries?.length ? profile.industries : profile.industry_focus);
const unique = (values: string[]) => [...new Map(values.map((value) => [norm(value), value])).values()];

function overlap(a?: string[] | null, b?: string[] | null): string[] {
  const bSet = new Set(present(b).map(norm));
  return unique(present(a).filter((item) => bSet.has(norm(item))));
}

function roleDetailString(profile: Profile, role: string, key: string): string | null {
  const value = profile.role_details?.[role];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field : null;
}

function roleDetailArray(profile: Profile, role: string, key: string): string[] {
  const value = profile.role_details?.[role];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const field = (value as Record<string, unknown>)[key];
  return Array.isArray(field) ? field.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function selectedGoals(profile: Profile): string[] {
  const modern = present([profile.primary_goal ?? "", ...(profile.secondary_goals ?? [])]);
  return unique(modern.length ? modern : present([profile.matching_goal ?? ""]));
}

function evidence(
  component: ComponentName,
  score: number,
  viewerField: string,
  viewerValue: string,
  candidateField: string,
  candidateValue: string,
  mapping: string,
): MatchEvidenceItem {
  return { component, score, viewerField, viewerValue, candidateField, candidateValue, mapping };
}

const ROLE_TYPE_TO_WHO: Record<string, string> = {
  "founder / co-founder": "founders",
  "entrepreneur / small business owner": "founders",
  investor: "investors",
  recruiter: "recruiters",
  "hiring manager": "hiring managers",
  "corporate professional": "professionals",
  executive: "professionals",
  "creator / influencer": "creators",
  "brand / partnership leader": "brand partners",
  "consultant / service provider": "service providers",
  "community builder": "community builders",
  "nonprofit leader": "community builders",
  "student / recent graduate": "students",
  "press / media": "press / media",
  "speaker / thought leader": "speakers",
};

const GOAL_SIGNALS: Record<string, { direct: string[]; adjacent: string[] }> = {
  "meet investors": { direct: ["investor", "investment capital", "investor introductions"], adjacent: ["fundraising advice", "strategic advice"] },
  "raise capital": { direct: ["investor", "investment capital", "investor introductions"], adjacent: ["fundraising advice", "financial strategy"] },
  "explore investment opportunities": { direct: ["founder / co-founder", "raise capital"], adjacent: ["founder advice", "product feedback"] },
  "find customers or clients": { direct: ["customer introductions", "sales expertise", "business development expertise"], adjacent: ["take on new clients", "strategic advice"] },
  "take on new clients": { direct: ["find customers or clients", "finding customers"], adjacent: ["customer introductions", "business development expertise"] },
  "build business partnerships": { direct: ["partnership introductions", "business development expertise", "brand / partnership leader"], adjacent: ["meet collaborators", "strategic advice"] },
  "explore career opportunities": { direct: ["recruiter", "hiring manager", "hiring opportunities", "job referrals"], adjacent: ["career advice", "mentorship"] },
  "hire talent": { direct: ["explore career opportunities", "actively searching"], adjacent: ["talent referrals", "recruiter"] },
  "find brand partners": { direct: ["brand / partnership leader", "brand opportunities"], adjacent: ["brand expertise", "creator / influencer"] },
  "find sponsorship opportunities": { direct: ["sponsorship opportunities", "brand / partnership leader"], adjacent: ["brand opportunities"] },
  "meet collaborators": { direct: ["collaborate on products", "collaborate on content", "partnership introductions"], adjacent: ["build business partnerships", "content creation"] },
  "find a mentor": { direct: ["mentorship", "mentor others"], adjacent: ["career advice", "founder advice", "strategic advice"] },
  "mentor others": { direct: ["find a mentor", "mentorship"], adjacent: ["career growth"] },
  "learn from experts": { direct: ["expertise"], adjacent: ["industry knowledge", "strategic advice"] },
  "build community": { direct: ["community builder", "community building", "community connections"], adjacent: ["make social connections"] },
  "find speaking opportunities": { direct: ["speaking opportunities"], adjacent: ["speaker / thought leader", "gain visibility"] },
  "find media / press opportunities": { direct: ["press / media", "media / press opportunities"], adjacent: ["gain visibility", "content creation"] },
  "collaborate on products": { direct: ["product expertise", "product feedback"], adjacent: ["meet collaborators"] },
  "collaborate on content": { direct: ["content creation", "creative direction"], adjacent: ["meet collaborators", "creator / influencer"] },
  "meet people in my city": { direct: ["local city knowledge"], adjacent: ["community connections"] },
  "make social connections": { direct: ["social connection / friendship"], adjacent: ["build community"] },
};

function candidateSignals(profile: Profile): Array<{ field: string; value: string }> {
  const values: Array<{ field: string; value: string }> = [];
  roles(profile).forEach((value) => values.push({ field: "role_type", value }));
  present(profile.offers).forEach((value) => values.push({ field: "offers", value }));
  present(profile.areas_of_expertise).forEach((value) => values.push({ field: "areas_of_expertise", value }));
  selectedGoals(profile).forEach((value) => values.push({ field: "goals", value }));
  [
    roleDetailString(profile, "Founder", "fundraisingTimeline"),
    roleDetailString(profile, "Recruiter", "hiringTimeline"),
    roleDetailString(profile, "Hiring Manager", "hiringTimeline"),
    roleDetailString(profile, "CareerSeeker", "searchStatus"),
  ].filter((value): value is string => Boolean(value)).forEach((value) => values.push({ field: "role_details", value }));
  return values;
}

function scoreGoal(goal: string, candidate: Profile, isSecondary = false): { score: number; evidence: MatchEvidenceItem[] } {
  const mapping = GOAL_SIGNALS[norm(goal)];
  if (!mapping) return { score: 0, evidence: [] };
  const signals = candidateSignals(candidate);
  const direct = signals.find((signal) => mapping.direct.some((item) => norm(signal.value).includes(norm(item)) || norm(item).includes(norm(signal.value))));
  if (direct) {
    const score = isSecondary ? 80 : direct.field === "goals" ? 90 : 100;
    const mappingName = isSecondary ? "direct secondary-goal fulfillment" : direct.field === "goals" ? "strong complementary primary goal" : "direct primary-goal fulfillment";
    return { score, evidence: [evidence("goalToValueFit", score, isSecondary ? "secondary_goals" : "primary_goal", goal, direct.field, direct.value, mappingName)] };
  }
  const adjacent = signals.find((signal) => mapping.adjacent.some((item) => norm(signal.value).includes(norm(item)) || norm(item).includes(norm(signal.value))));
  if (adjacent) return { score: 65, evidence: [evidence("goalToValueFit", 65, "goal", goal, adjacent.field, adjacent.value, "adjacent goal support")] };
  const broad = overlap(functions(candidate), functions(candidate)).length > 0 && candidateSignals(candidate).length > 0;
  return broad ? { score: 40, evidence: [evidence("goalToValueFit", 40, isSecondary ? "secondary_goals" : "primary_goal", goal, "professional_identity", roles(candidate)[0] ?? functions(candidate)[0], "broad professional relevance")] } : { score: 0, evidence: [] };
}

function goalToValueFit(viewer: Profile, candidate: Profile): ComponentBreakdown {
  const primary = viewer.primary_goal ?? viewer.matching_goal;
  if (!primary) return { score: null, weight: WEIGHTS.goalToValueFit, evidence: [] };
  const primaryResult = scoreGoal(primary, candidate);
  const secondaryResults = present(viewer.secondary_goals).map((goal) => scoreGoal(goal, candidate, true));
  const strongestSecondary = secondaryResults.sort((a, b) => b.score - a.score)[0];
  const score = strongestSecondary ? primaryResult.score * 0.7 + strongestSecondary.score * 0.3 : primaryResult.score;
  return { score, weight: WEIGHTS.goalToValueFit, evidence: [...primaryResult.evidence, ...(strongestSecondary?.evidence ?? [])] };
}

function targetPersonFit(viewer: Profile, candidate: Profile): ComponentBreakdown {
  const wanted = present(viewer.who_to_meet).filter((value) => norm(value) !== "no preference");
  const career = present(viewer.career_level_preference).filter((value) => norm(value) !== "no preference");
  const hasTarget = wanted.length > 0 || career.length > 0 || Boolean(viewer.primary_function);
  if (!hasTarget) return { score: null, weight: WEIGHTS.targetPersonFit, evidence: [] };
  for (const role of roles(candidate)) {
    const category = ROLE_TYPE_TO_WHO[norm(role)];
    if (category && wanted.some((value) => norm(value) === category)) {
      return { score: 100, weight: WEIGHTS.targetPersonFit, evidence: [evidence("targetPersonFit", 100, "who_to_meet", category, "role_type", role, "exact requested identity")] };
    }
  }
  const functionMatch = overlap(functions(viewer), functions(candidate))[0];
  if (functionMatch || (candidate.seniority && career.some((value) => norm(value) === norm(candidate.seniority!)))) {
    const value = functionMatch ?? candidate.seniority!;
    return { score: 90, weight: WEIGHTS.targetPersonFit, evidence: [evidence("targetPersonFit", 90, functionMatch ? "primary_function" : "career_level_preference", value, functionMatch ? "primary_function" : "seniority", value, "exact requested function or career level")] };
  }
  const viewerIndustries = industries(viewer);
  const candidateIndustries = industries(candidate);
  if (viewer.industry_preference && viewerIndustries.length && candidateIndustries.length) {
    const shared = overlap(viewerIndustries, candidateIndustries)[0];
    const wantsOutside = norm(viewer.industry_preference).includes("outside");
    if ((shared && !wantsOutside) || (!shared && wantsOutside)) {
      const candidateIndustry = shared ?? candidateIndustries[0];
      return { score: 60, weight: WEIGHTS.targetPersonFit, evidence: [evidence("targetPersonFit", 60, "industry_preference", viewer.industry_preference, "industries", candidateIndustry, "requested industry preference")] };
    }
  }
  const viewerCity = viewer.location_city ?? viewer.location;
  const candidateCity = candidate.location_city ?? candidate.location;
  if (viewer.location_preference && viewerCity && candidateCity) {
    const same = norm(viewerCity) === norm(candidateCity);
    if ((viewer.location_preference === "prioritize_city" && same) || (viewer.location_preference === "prioritize_outside_city" && !same)) {
      return { score: 60, weight: WEIGHTS.targetPersonFit, evidence: [evidence("targetPersonFit", 60, "location_preference", viewer.location_preference, "location", candidateCity, "requested location preference")] };
    }
  }
  return { score: 0, weight: WEIGHTS.targetPersonFit, evidence: [] };
}

const EXACT_NEEDS_OFFERS = new Set([
  "Investor Introductions", "Customer Introductions", "Partnership Introductions", "Talent Referrals", "Job Referrals",
  "Brand Opportunities", "Sponsorship Opportunities", "Media / Press Opportunities", "Speaking Opportunities", "Mentorship",
  "Strategic Advice", "Product Feedback", "Community Building", "Content Creation", "Creative Direction", "Financial Strategy",
  "Legal / Compliance Guidance", "Event / Experience Strategy", "Local City Knowledge", "Accountability / Peer Support",
  "Social Connection / Friendship",
].map(norm));

const NEED_OFFER_MAP: Record<string, Record<string, number>> = {
  "finding customers": { "customer introductions": 100, "sales expertise": 80, "business development expertise": 80 },
  "raising capital": { "investment capital": 100, "investor introductions": 100, "fundraising advice": 80 },
  "hiring talent": { "hiring opportunities": 80, "talent referrals": 100 },
  "finding a new role": { "hiring opportunities": 100, "job referrals": 100, "career advice": 80 },
  "career growth": { "career advice": 80, mentorship: 80, "founder advice": 60 },
  "building partnerships": { "partnership introductions": 100, "business development expertise": 80 },
  "finding brand partners": { "brand opportunities": 100, "brand expertise": 80 },
  "brand strategy": { "brand expertise": 100 }, marketing: { "marketing expertise": 100 },
  "sales / business development": { "sales expertise": 100, "business development expertise": 100 },
  "product development": { "product expertise": 100, "product feedback": 80 },
  "technology / engineering": { "technical expertise": 100, "engineering expertise": 100 },
  operations: { "operations expertise": 100 }, recruiting: { "talent referrals": 80, "hiring opportunities": 80 },
  "fundraising strategy": { "fundraising advice": 100, "investment capital": 80 },
  "social media": { "social media expertise": 100 }, design: { "design expertise": 100 },
  "data / analytics": { "data / analytics expertise": 100 }, "entering a new industry": { "industry knowledge": 100 },
  "entering a new market": { "industry knowledge": 80, "strategic advice": 60 },
  "meeting people locally": { "local city knowledge": 100, "community connections": 80 },
};

function bestOffer(need: string, offers: string[]): { offer: string; score: number; type: "exact" | "near" } | null {
  const needKey = norm(need);
  const exact = offers.find((offer) => norm(offer) === needKey && EXACT_NEEDS_OFFERS.has(needKey));
  if (exact) return { offer: exact, score: 100, type: "exact" };
  let best: { offer: string; score: number; type: "near" } | null = null;
  for (const offer of offers) {
    const score = NEED_OFFER_MAP[needKey]?.[norm(offer)] ?? 0;
    if (score > (best?.score ?? 0)) best = { offer, score, type: "near" };
  }
  return best;
}

export function calculateNeedsOffersScore(needs: string[], offers: string[]): number {
  if (!needs.length || !offers.length) return 0;
  return needs.reduce((sum, need) => sum + (bestOffer(need, offers)?.score ?? 0), 0) / needs.length;
}

function needToOfferFit(viewer: Profile, candidate: Profile): ComponentBreakdown {
  const needs = present(viewer.needs);
  const offers = present(candidate.offers);
  if (!needs.length || !offers.length) return { score: null, weight: WEIGHTS.needToOfferFit, evidence: [] };
  const matches = needs.map((need) => ({ need, match: bestOffer(need, offers) }));
  return {
    score: matches.reduce((sum, item) => sum + (item.match?.score ?? 0), 0) / needs.length,
    weight: WEIGHTS.needToOfferFit,
    evidence: matches.filter((item) => item.match).map((item) => evidence("needToOfferFit", item.match!.score, "needs", item.need, "offers", item.match!.offer, item.match!.type === "exact" ? "exact approved mapping" : "approved conceptual mapping")),
  };
}

const EXPERTISE_NEEDS: Record<string, string[]> = {
  marketing: ["marketing expertise"], "sales / business development": ["sales expertise", "business development expertise"],
  "product development": ["product expertise"], "technology / engineering": ["technical expertise", "engineering expertise"],
  operations: ["operations expertise"], "brand strategy": ["brand expertise"], "social media": ["social media expertise"],
  design: ["design expertise", "creative direction"], "data / analytics": ["data / analytics expertise"],
  "fundraising strategy": ["fundraising advice", "financial strategy"], recruiting: ["hiring opportunities", "talent referrals"],
};

function soughtExpertise(profile: Profile): string[] {
  if (present(profile.expertise_sought).length) return present(profile.expertise_sought);
  return unique(present(profile.needs).flatMap((need) => EXPERTISE_NEEDS[norm(need)] ?? []));
}

function expertiseFit(viewer: Profile, candidate: Profile): ComponentBreakdown {
  const sought = soughtExpertise(viewer);
  const offered = unique([...present(candidate.areas_of_expertise), ...present(candidate.offers)]);
  if (!sought.length || !offered.length) return { score: null, weight: WEIGHTS.expertiseFit, evidence: [] };
  const exact = overlap(sought, offered);
  if (exact.length) {
    const score = exact.length >= 2 ? 100 : 90;
    return { score, weight: WEIGHTS.expertiseFit, evidence: exact.map((value) => evidence("expertiseFit", score, "expertise_sought", value, "expertise_offered", value, "exact expertise match")) };
  }
  const conceptual = sought.flatMap((need) => offered.filter((offer) => norm(offer).includes(norm(need)) || norm(need).includes(norm(offer))).map((offer) => ({ need, offer })))[0];
  return conceptual
    ? { score: 75, weight: WEIGHTS.expertiseFit, evidence: [evidence("expertiseFit", 75, "expertise_sought", conceptual.need, "expertise_offered", conceptual.offer, "conceptual expertise match")] }
    : { score: 0, weight: WEIGHTS.expertiseFit, evidence: [] };
}

type Tier = 0 | 1 | 2;
const STAGE_TIERS: Record<string, Tier> = { "idea stage": 0, "pre-seed": 0, seed: 1, "series a": 1, "series b+": 2, bootstrapped: 2, "acquired / exited": 2 };
const CHECK_TIERS: Record<string, Tier> = { "under $25k": 0, "$25k-$100k": 0, "$100k-$500k": 1, "$500k+": 2 };
const TIMING_TIERS: Record<string, Tier> = {
  "exploring for the future": 0, "open to building investor relationships": 0, "building a future talent pipeline": 0,
  "not currently searching": 0, "preparing to raise within 6 months": 1, "hiring within 3-6 months": 1,
  "open to the right opportunity": 1, "planning to explore within 6 months": 1, "actively raising": 2,
  "actively hiring": 2, "actively searching": 2,
};
const tierKey = (value: string) => norm(value).replaceAll("–", "-").replaceAll("—", "-");
const tierScore = (a: Tier, b: Tier, rubric: [number, number, number] = [100, 75, 40]) => rubric[Math.abs(a - b)];
const hasRole = (profile: Profile, role: string) => roles(profile).some((value) => norm(value) === norm(role));

export function calculateOpportunityCompatibility(viewer: Profile, candidate: Profile): number | null {
  const founderInvestor = hasRole(viewer, "Founder / Co-founder") && hasRole(candidate, "Investor");
  const investorFounder = hasRole(viewer, "Investor") && hasRole(candidate, "Founder / Co-founder");
  if (founderInvestor || investorFounder) {
    const founder = founderInvestor ? viewer : candidate;
    const investor = founderInvestor ? candidate : viewer;
    const stage = roleDetailString(founder, "Founder", "companyStage");
    const check = roleDetailString(investor, "Investor", "checkSize");
    if (!stage || !check) return null;
    const a = STAGE_TIERS[tierKey(stage)];
    const b = CHECK_TIERS[tierKey(check)];
    return a === undefined || b === undefined ? null : tierScore(a, b, [100, 75, 0]);
  }
  const careerGoal = selectedGoals(viewer).some((goal) => norm(goal) === "explore career opportunities");
  if (careerGoal && (hasRole(candidate, "Recruiter") || hasRole(candidate, "Hiring Manager"))) {
    const active = roleDetailString(candidate, "Recruiter", "activelyHiring") ?? roleDetailString(candidate, "Hiring Manager", "activelyHiring");
    if (!active) return null;
    if (norm(active) === "no") return 0;
    const hiringFunctions = [...roleDetailArray(candidate, "Recruiter", "hiringFunctions"), ...roleDetailArray(candidate, "Hiring Manager", "hiringFunctions")];
    const match = overlap(functions(viewer), hiringFunctions);
    return match.length ? 100 : hiringFunctions.length ? 75 : 75;
  }
  const brandGoal = selectedGoals(viewer).some((goal) => ["find brand partners", "find sponsorship opportunities"].includes(norm(goal)));
  if (brandGoal && hasRole(candidate, "Brand / Partnership Leader")) return 100;
  if (brandGoal && hasRole(candidate, "Creator / Influencer")) {
    const open = roleDetailString(candidate, "Creator", "openToBrandPartnerships");
    return open ? (norm(open) === "yes" ? 100 : 0) : null;
  }
  return null;
}

const COMPATIBLE_CONNECTIONS = new Set([
  "one-on-one conversation|quick introduction", "business opportunity|scheduled meeting",
  "collaboration|ongoing professional relationship", "mentorship relationship|one-on-one conversation",
].map((value) => value.split("|").sort().join("|")));

function connectionScore(a: Profile, b: Profile): number | null {
  const aa = present(a.connection_preference).filter((value) => norm(value) !== "no preference");
  const bb = present(b.connection_preference).filter((value) => norm(value) !== "no preference");
  if (!aa.length || !bb.length) return null;
  if (overlap(aa, bb).length) return 100;
  if (aa.some((left) => bb.some((right) => COMPATIBLE_CONNECTIONS.has([norm(left), norm(right)].sort().join("|"))))) return 75;
  return 40;
}

function timingTier(profile: Profile): Tier | null {
  const values = [roleDetailString(profile, "Founder", "fundraisingTimeline"), roleDetailString(profile, "Recruiter", "hiringTimeline"), roleDetailString(profile, "Hiring Manager", "hiringTimeline"), roleDetailString(profile, "CareerSeeker", "searchStatus")];
  const tiers = values.filter((value): value is string => Boolean(value)).map((value) => TIMING_TIERS[norm(value)]).filter((value): value is Tier => value !== undefined);
  return tiers.length ? Math.max(...tiers) as Tier : null;
}

export function calculateTimingConnectionCompatibility(a: Profile, b: Profile): number | null {
  const timingA = timingTier(a);
  const timingB = timingTier(b);
  const timing = timingA === null || timingB === null ? null : tierScore(timingA, timingB);
  const connection = connectionScore(a, b);
  const scores = [timing, connection].filter((value): value is number => value !== null);
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
}

function contextFit(viewer: Profile, candidate: Profile): ComponentBreakdown {
  const parts: Array<{ score: number | null; weight: number; item?: MatchEvidenceItem }> = [];
  const viewerIndustries = industries(viewer);
  const candidateIndustries = industries(candidate);
  const industryPreference = viewer.industry_preference;
  let industryScore: number | null = null;
  if (industryPreference && viewerIndustries.length && candidateIndustries.length) {
    const shared = overlap(viewerIndustries, candidateIndustries).length > 0;
    if (norm(industryPreference).includes("outside")) industryScore = shared ? 0 : 100;
    else if (norm(industryPreference).includes("my industry")) industryScore = shared ? 100 : 0;
    else industryScore = 100;
  }
  parts.push({ score: industryScore, weight: 40, item: industryScore && candidateIndustries[0] ? evidence("contextFit", industryScore, "industry_preference", industryPreference!, "industries", candidateIndustries[0], "industry preference fulfillment") : undefined });
  let locationScore: number | null = null;
  const viewerCity = viewer.location_city ?? viewer.location;
  const candidateCity = candidate.location_city ?? candidate.location;
  if (viewer.location_preference && viewerCity && candidateCity) {
    const same = norm(viewerCity) === norm(candidateCity);
    locationScore = viewer.location_preference === "prioritize_city" ? (same ? 100 : 0) : viewer.location_preference === "prioritize_outside_city" ? (same ? 0 : 100) : 100;
  }
  parts.push({ score: locationScore, weight: 30, item: locationScore && candidateCity ? evidence("contextFit", locationScore, "location_preference", viewer.location_preference!, "location", candidateCity, "location preference fulfillment") : undefined });
  const sharedInterests = overlap(viewer.interests, candidate.interests);
  const interestScore = present(viewer.interests).length && present(candidate.interests).length ? (sharedInterests.length ? 100 : 0) : null;
  parts.push({ score: interestScore, weight: 20, item: sharedInterests[0] ? evidence("contextFit", 100, "interests", sharedInterests[0], "interests", sharedInterests[0], "shared interest") : undefined });
  const sharedCommunities = overlap(viewer.communities, candidate.communities);
  const communityScore = present(viewer.communities).length && present(candidate.communities).length ? (sharedCommunities.length ? 100 : 0) : null;
  parts.push({ score: communityScore, weight: 10, item: sharedCommunities[0] ? evidence("contextFit", 100, "communities", sharedCommunities[0], "communities", sharedCommunities[0], "shared community") : undefined });
  const applicable = parts.filter((part): part is { score: number; weight: number; item?: MatchEvidenceItem } => part.score !== null);
  if (!applicable.length) return { score: null, weight: WEIGHTS.contextFit, evidence: [] };
  return { score: applicable.reduce((sum, part) => sum + part.score * part.weight, 0) / applicable.reduce((sum, part) => sum + part.weight, 0), weight: WEIGHTS.contextFit, evidence: applicable.flatMap((part) => part.item ? [part.item] : []) };
}

function opportunityComponent(viewer: Profile, candidate: Profile): ComponentBreakdown {
  const score = calculateOpportunityCompatibility(viewer, candidate);
  return { score, weight: WEIGHTS.opportunityCompatibility, evidence: score && score > 0 ? [evidence("opportunityCompatibility", score, "open_opportunity", selectedGoals(viewer)[0] ?? "conditional opportunity", "role_details", roles(candidate)[0] ?? "conditional answers", "structured opportunity compatibility")] : [] };
}

function timingComponent(viewer: Profile, candidate: Profile): ComponentBreakdown {
  const score = calculateTimingConnectionCompatibility(viewer, candidate);
  return { score, weight: WEIGHTS.timingConnectionFit, evidence: score && score > 0 ? [evidence("timingConnectionFit", score, "timing/connection_preference", present(viewer.connection_preference)[0] ?? "conditional timeline", "timing/connection_preference", present(candidate.connection_preference)[0] ?? "conditional timeline", "compatible timing or connection format")] : [] };
}

function scoreDirection(viewer: Profile, candidate: Profile): { score: number; breakdown: DirectionalScoreBreakdown; evidence: MatchEvidenceItem[] } {
  const components: Record<ComponentName, ComponentBreakdown> = {
    goalToValueFit: goalToValueFit(viewer, candidate), targetPersonFit: targetPersonFit(viewer, candidate),
    needToOfferFit: needToOfferFit(viewer, candidate), expertiseFit: expertiseFit(viewer, candidate),
    opportunityCompatibility: opportunityComponent(viewer, candidate), timingConnectionFit: timingComponent(viewer, candidate),
    contextFit: contextFit(viewer, candidate),
  };
  const applicable = Object.values(components).filter((component) => component.score !== null);
  const applicableWeight = applicable.reduce((sum, component) => sum + component.weight, 0);
  const weightedPoints = applicable.reduce((sum, component) => sum + component.score! * component.weight, 0);
  const score = applicableWeight ? Math.round(weightedPoints / applicableWeight) : 0;
  return { score, breakdown: { ...components, applicableWeight, weightedPoints }, evidence: Object.values(components).flatMap((component) => component.evidence) };
}

function coreCompletion(profile: Profile): number {
  const checks = [Boolean(profile.primary_goal ?? profile.matching_goal), present(profile.who_to_meet).length > 0, present(profile.needs).length > 0, present(profile.offers).length > 0];
  return checks.filter(Boolean).length / checks.length * 100;
}

function conditionalCompletion(profile: Profile): number {
  const applicable: boolean[] = [];
  if (hasRole(profile, "Founder / Co-founder")) applicable.push(Boolean(roleDetailString(profile, "Founder", "companyStage")), Boolean(roleDetailString(profile, "Founder", "fundraisingTimeline") ?? roleDetailString(profile, "Founder", "lookingForInvestors")));
  if (hasRole(profile, "Investor")) applicable.push(Boolean(roleDetailString(profile, "Investor", "checkSize")), roleDetailArray(profile, "Investor", "investmentFocusAreas").length > 0);
  if (hasRole(profile, "Recruiter") || hasRole(profile, "Hiring Manager")) applicable.push(Boolean(roleDetailString(profile, "Recruiter", "hiringTimeline") ?? roleDetailString(profile, "Hiring Manager", "hiringTimeline")));
  if (selectedGoals(profile).some((goal) => norm(goal) === "explore career opportunities")) applicable.push(Boolean(roleDetailString(profile, "CareerSeeker", "searchStatus")));
  return applicable.length ? applicable.filter(Boolean).length / applicable.length * 100 : 100;
}

function recencyScore(updatedAt?: string | null): number {
  if (!updatedAt) return 0;
  const ageDays = (Date.now() - Date.parse(updatedAt)) / 86_400_000;
  if (!Number.isFinite(ageDays)) return 0;
  if (ageDays <= 90) return 100;
  if (ageDays <= 180) return 75;
  if (ageDays <= 365) return 50;
  return 25;
}

export function calculateMatchConfidence(viewer: Profile, candidate: Profile, breakdown: DirectionalScoreBreakdown): number {
  const structured = Object.values(breakdown).filter((value): value is ComponentBreakdown => typeof value === "object" && value !== null && "score" in value);
  const evaluated = structured.filter((component) => component.score !== null).length / 7 * 100;
  const confirmation = ((viewer.profile_completed ? 1 : 0) + (candidate.profile_completed ? 1 : 0) + (viewer.linkedin_url ? 1 : 0) + (candidate.linkedin_url ? 1 : 0)) / 4 * 100;
  const recency = (recencyScore(viewer.updated_at) + recencyScore(candidate.updated_at)) / 2;
  return Math.round(0.3 * ((coreCompletion(viewer) + coreCompletion(candidate)) / 2) + 0.25 * evaluated + 0.2 * ((conditionalCompletion(viewer) + conditionalCompletion(candidate)) / 2) + 0.15 * recency + 0.1 * confirmation);
}

export function getReciprocityLabel(aToB: number, bToA: number): MatchResult["reciprocityLabel"] {
  if (aToB >= 70 && bToA >= 70) return "You Can Help Each Other";
  if (aToB >= 70 && bToA < 70) return "They Can Help You";
  if (aToB < 70 && bToA >= 70) return "You Can Help Them";
  return "Potential Connection";
}

function scoreLabel(score: number): string {
  if (score >= 85) return "Don't Leave Without Meeting";
  if (score >= 70) return "Strong Match";
  if (score >= 60) return "Worth an Introduction";
  return "Hidden";
}

function reasons(items: MatchEvidenceItem[]): string[] {
  return items.sort((a, b) => WEIGHTS[b.component] - WEIGHTS[a.component] || b.score - a.score).slice(0, 3).map((item) => `${item.viewerValue} matches ${item.candidateValue} (${item.mapping}).`);
}

export function calculateMatchScore(profileA: Profile, profileB: Profile): MatchResult {
  const aToB = scoreDirection(profileA, profileB);
  const bToA = scoreDirection(profileB, profileA);
  const aToBConfidence = calculateMatchConfidence(profileA, profileB, aToB.breakdown);
  const bToAConfidence = calculateMatchConfidence(profileB, profileA, bToA.breakdown);
  const aToBReasons = reasons(aToB.evidence);
  const bToAReasons = reasons(bToA.evidence);
  return {
    aToBScore: aToB.score, bToAScore: bToA.score, aToBConfidence, bToAConfidence,
    reciprocityLabel: getReciprocityLabel(aToB.score, bToA.score), scoreVersion: SCORE_VERSION,
    scoreBreakdown: { aToB: aToB.breakdown, bToA: bToA.breakdown },
    matchEvidence: { aToB: aToB.evidence, bToA: bToA.evidence },
    aToBReasons, bToAReasons, score: aToB.score, label: scoreLabel(aToB.score), matchReasons: aToBReasons,
  };
}

// Legacy structured detail exports remain until the explanation/UI follow-up.
const COMPLEMENTARY_GOALS: [string, string][] = [
  ["Find Customers or Clients", "Take On New Clients"], ["Build Business Partnerships", "Meet Collaborators"],
  ["Meet Investors", "Raise Capital"], ["Meet Investors", "Explore Investment Opportunities"],
  ["Hire Talent", "Explore Career Opportunities"], ["Find Brand Partners", "Gain Visibility"],
  ["Find a Mentor", "Mentor Others"], ["Build Community", "Make Social Connections"],
  ["Meet Collaborators", "Collaborate on Products"], ["Meet Collaborators", "Collaborate on Content"],
];
const isComplementary = (a: string, b: string) => COMPLEMENTARY_GOALS.some(([left, right]) => (norm(a) === norm(left) && norm(b) === norm(right)) || (norm(a) === norm(right) && norm(b) === norm(left)));
export interface MatchedGoal { goalA: string; goalB: string; type: "complementary" | "shared"; }
export interface MatchedRole { roleA: string; roleB: string; pairType: string; }
export interface NeedsOffersMatch { need: string; offer: string; matchType: "exact" | "near"; }
export interface MatchDetails { matchedGoals: MatchedGoal[]; matchedRoles: MatchedRole[]; matchedInterests: string[]; needsOffersAToB: NeedsOffersMatch[]; needsOffersBToA: NeedsOffersMatch[]; }
export function extractMatchedGoals(a: Profile, b: Profile): MatchedGoal[] {
  const matches: MatchedGoal[] = [];
  for (const goalA of selectedGoals(a)) {
    for (const goalB of selectedGoals(b)) {
      if (isComplementary(goalA, goalB)) matches.push({ goalA, goalB, type: "complementary" });
      else if (norm(goalA) === norm(goalB)) matches.push({ goalA, goalB, type: "shared" });
    }
  }
  return matches;
}
export function extractMatchedRoles(a: Profile, b: Profile): MatchedRole[] {
  return roles(a).flatMap((roleA) => roles(b).flatMap((roleB) => {
    if (norm(roleA) === norm(roleB)) return [{ roleA, roleB, pairType: "same-role" }];
    if ((hasRole(a, "Founder / Co-founder") && hasRole(b, "Investor")) || (hasRole(b, "Founder / Co-founder") && hasRole(a, "Investor"))) return [{ roleA, roleB, pairType: "founder-investor-aligned" }];
    return [];
  }));
}
export function extractMatchedInterests(a: Profile, b: Profile): string[] { return unique([...overlap(a.interests, b.interests), ...overlap(a.communities, b.communities), ...overlap(a.hobbies, b.hobbies), ...overlap(a.music_interests, b.music_interests), ...overlap(a.favorite_conferences, b.favorite_conferences)]); }
export function extractNeedsOffersMatches(needs: string[], offers: string[]): NeedsOffersMatch[] {
  return needs.flatMap((need) => { const match = bestOffer(need, offers); return match ? [{ need, offer: match.offer, matchType: match.type }] : []; });
}
export function buildMatchDetails(a: Profile, b: Profile): MatchDetails {
  return { matchedGoals: extractMatchedGoals(a, b), matchedRoles: extractMatchedRoles(a, b), matchedInterests: extractMatchedInterests(a, b), needsOffersAToB: extractNeedsOffersMatches(present(a.needs), present(b.offers)), needsOffersBToA: extractNeedsOffersMatches(present(b.needs), present(a.offers)) };
}
