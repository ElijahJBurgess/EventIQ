import { describe, expect, it, vi } from "vitest";
import {
  buildConciergeContext,
  type ConciergeContextSource,
  type ConciergeLiveCandidateSource,
} from "./context.ts";
import { CONCIERGE_SYSTEM_INSTRUCTIONS } from "./openai.ts";
import * as scorer from "./scorer.ts";

const USER_ID = "user-1";
const EVENT_ID = "event-1";
const CANDIDATE_ID = "unmatched-nia";

function row(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    full_name: name,
    role_type: null,
    secondary_role_types: [],
    who_to_meet: [],
    desired_outcomes: [],
    areas_of_expertise: [],
    expertise_sought: [],
    primary_goal: null,
    secondary_goals: [],
    matching_goal: null,
    primary_function: null,
    additional_functions: [],
    seniority: null,
    career_level_preference: [],
    industry_focus: [],
    industries: [],
    needs: [],
    offers: [],
    connection_preference: [],
    interests: [],
    communities: [],
    hobbies: [],
    music_interests: [],
    favorite_conferences: [],
    role_details: null,
    location: null,
    title: null,
    company: null,
    profile_completed: true,
    linkedin_url: null,
    updated_at: null,
    ...extra,
  };
}

// current user: founder chasing capital. candidate: investor with capital.
const CURRENT_ROW = row(USER_ID, "Avery Morgan", {
  role_type: "Founder / Co-founder", primary_goal: "Meet Investors",
  who_to_meet: ["Investors"], needs: ["Raising Capital"], offers: ["Product Feedback"],
});
const CANDIDATE_ROW = row(CANDIDATE_ID, "Nia Brooks", {
  role_type: "Investor", primary_goal: "Build Community",
  offers: ["Investment Capital", "Financial Strategy"],
});

function baseSource(overrides: Partial<ConciergeContextSource> = {}): ConciergeContextSource {
  const person = row("person-2", "Marcus Chen", { primary_goal: "Meet Investors", offers: ["Product Feedback"] });
  return {
    getCurrentProfile: async () => CURRENT_ROW,
    getEvent: async () => ({ id: EVENT_ID, name: "OFFRIP Room" }),
    getMatches: async () => [{
      id: "match-1", event_id: EVENT_ID, user_a_id: USER_ID, user_b_id: "person-2",
      a_to_b_score: 90, b_to_a_score: 88, a_to_b_confidence: 90, b_to_a_confidence: 88,
      reciprocity_label: "Mutual Value", match_reason: "Persisted reason",
      score_breakdown: { aToB: {}, bToA: {} }, match_evidence: { aToB: [], bToA: [] }, match_details: null,
      shared_goals: [], shared_interests: [], shared_industries: [], shared_communities: [],
    }],
    getCheckedInProfileIds: async () => [USER_ID, "person-2", CANDIDATE_ID],
    getProfiles: async () => [person],
    getMessageFacts: async () => [],
    getMeetings: async () => [],
    ...overrides,
  };
}

function liveSource(overrides: Partial<ConciergeLiveCandidateSource> = {}): ConciergeLiveCandidateSource {
  return {
    getCheckedInNames: async () => [
      { id: USER_ID, fullName: "Avery Morgan" },
      { id: "person-2", fullName: "Marcus Chen" },
      { id: CANDIDATE_ID, fullName: "Nia Brooks" },
    ],
    getScoringProfile: async (id) => (id === CANDIDATE_ID ? CANDIDATE_ROW : null),
    ...overrides,
  };
}

describe("concierge live (unmatched) comparison", () => {
  it("adds a liveComparison flagged isLiveComputed for a named unmatched checked-in person", async () => {
    const context = await buildConciergeContext(
      baseSource(), USER_ID, EVENT_ID, "How would I score with Nia Brooks?", liveSource(),
    );

    expect(context.status).toBe("ready");
    expect(context.liveComparison).not.toBeNull();
    expect(context.liveComparison?.isLiveComputed).toBe(true);
    expect(context.liveComparison?.trusted.profileId).toBe(CANDIDATE_ID);

    // the numbers are the real calculateMatchScore for that exact pair
    const raw = scorer.calculateMatchScore(toProfile(CURRENT_ROW), toProfile(CANDIDATE_ROW));
    expect(context.liveComparison?.trusted.computedScore).toBe(raw.aToBScore);
    expect(context.liveComparison?.trusted.computedConfidence).toBe(raw.aToBConfidence);
    expect(context.liveComparison?.liveMatchEvidence.reasons).toEqual(raw.aToBReasons);
    expect(context.liveComparison?.liveMatchEvidence.reciprocityLabel).toBe(raw.reciprocityLabel);
    expect(context.liveComparison?.liveMatchEvidence.reverseScore).toBe(raw.bToAScore);
  });

  it("calls calculateMatchScore with real Profile shapes (current user, candidate)", async () => {
    const spy = vi.spyOn(scorer, "calculateMatchScore");
    await buildConciergeContext(baseSource(), USER_ID, EVENT_ID, "tell me about nia", liveSource());

    expect(spy).toHaveBeenCalledTimes(1);
    const [a, b] = spy.mock.calls[0];
    expect(a.id).toBe(USER_ID);
    expect(a.primary_goal).toBe("Meet Investors");
    expect(Array.isArray(a.needs)).toBe(true);
    expect(b.id).toBe(CANDIDATE_ID);
    expect(b.role_type).toBe("Investor");
    expect(Array.isArray(b.offers)).toBe(true);
    spy.mockRestore();
  });

  it("distinguishes a live comparison from a persisted match", async () => {
    const context = await buildConciergeContext(
      baseSource(), USER_ID, EVENT_ID, "How would I score with Nia Brooks?", liveSource(),
    );
    const persisted = context.checkedInMatches[0];
    expect((persisted as { isLiveComputed?: unknown }).isLiveComputed).toBeUndefined();
    expect(persisted.trusted).toHaveProperty("matchId");
    expect("persistedMatchEvidence" in persisted).toBe(true);

    const live = context.liveComparison!;
    expect(live).toHaveProperty("isLiveComputed", true);
    expect(live.trusted).not.toHaveProperty("matchId");
    expect(live).toHaveProperty("liveMatchEvidence");
    expect(live.disclaimer.length).toBeGreaterThan(0);
  });

  it("does not add a live comparison when no candidate source is provided (unchanged behavior)", async () => {
    const context = await buildConciergeContext(baseSource(), USER_ID, EVENT_ID, "How would I score with Nia Brooks?");
    expect(context.liveComparison).toBeNull();
  });

  it("does not add a live comparison for an ambiguous or absent name", async () => {
    const context = await buildConciergeContext(
      baseSource(), USER_ID, EVENT_ID, "who should I meet next?", liveSource(),
    );
    expect(context.liveComparison).toBeNull();
  });

  it("never fails the whole context build if the candidate lookup throws", async () => {
    const context = await buildConciergeContext(
      baseSource(), USER_ID, EVENT_ID, "How would I score with Nia Brooks?",
      liveSource({ getScoringProfile: async () => { throw new Error("db down"); } }),
    );
    expect(context.status).toBe("ready");
    expect(context.liveComparison).toBeNull();
    expect(context.checkedInMatches.length).toBe(1);
  });

  it("system prompt tells the model to disclose a live comparison, not present it as a match", () => {
    expect(CONCIERGE_SYSTEM_INSTRUCTIONS).toMatch(/liveComparison/);
    expect(CONCIERGE_SYSTEM_INSTRUCTIONS).toMatch(/isLiveComputed/);
    expect(CONCIERGE_SYSTEM_INSTRUCTIONS).toMatch(/never present it as an existing match/i);
    expect(CONCIERGE_SYSTEM_INSTRUCTIONS).toMatch(/not .*matched .*yet|haven't matched/i);
  });
});

function toProfile(r: Record<string, unknown>) {
  // mirror of liveComparison.toScorerProfile for the expectation math
  const str = (k: string) => (r[k] as string | null) ?? null;
  const arr = (k: string) => (r[k] as string[] | null) ?? null;
  return {
    id: r.id as string, full_name: str("full_name"), location: str("location"),
    location_city: null, location_state_code: null, location_preference: str("location_preference"),
    role_type: str("role_type"), secondary_role_types: arr("secondary_role_types") ?? [], company: null, title: null,
    who_to_meet: arr("who_to_meet"), desired_outcomes: arr("desired_outcomes"), areas_of_expertise: arr("areas_of_expertise"),
    expertise_sought: arr("expertise_sought"), primary_function: str("primary_function"),
    additional_functions: arr("additional_functions"), seniority: str("seniority"),
    career_level_preference: arr("career_level_preference"), matching_goal: str("matching_goal"),
    primary_goal: str("primary_goal"), secondary_goals: arr("secondary_goals"),
    role_details: (r.role_details as Record<string, unknown> | null) ?? null,
    industry_focus: arr("industry_focus"), industries: arr("industries"), industry_preference: str("industry_preference"),
    needs: arr("needs"), offers: arr("offers"), connection_preference: arr("connection_preference"),
    interests: arr("interests"), communities: arr("communities"), hobbies: arr("hobbies"),
    music_interests: arr("music_interests"), favorite_conferences: arr("favorite_conferences"),
    profile_completed: (r.profile_completed as boolean | null) ?? null, profile_completion_score: null,
    updated_at: str("updated_at"), linkedin_url: str("linkedin_url"),
  };
}
