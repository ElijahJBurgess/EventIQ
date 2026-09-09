import assert from "node:assert/strict";
import test from "node:test";
import { calculateMatchScore, type Profile } from "./scorer.ts";
import {
  computeLiveMatch,
  resolveNamedCandidateId,
  SCORER_PROFILE_COLUMNS,
  toScorerProfile,
} from "./liveComparison.ts";

function scoringRow(id: string, name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
    profile_completed: true,
    linkedin_url: null,
    updated_at: null,
    ...overrides,
  };
}

test("toScorerProfile maps a DB row into the shape calculateMatchScore accepts", () => {
  const profile = toScorerProfile(scoringRow("p1", "Priya Shah", {
    primary_goal: "Raise Capital",
    needs: ["Raising Capital"],
    who_to_meet: ["Investors"],
    secondary_role_types: ["Advisor"],
  }));
  assert.equal(profile.id, "p1");
  assert.equal(profile.full_name, "Priya Shah");
  assert.equal(profile.primary_goal, "Raise Capital");
  assert.deepEqual(profile.needs, ["Raising Capital"]);
  assert.deepEqual(profile.who_to_meet, ["Investors"]);
  assert.deepEqual(profile.secondary_role_types, ["Advisor"]);
  // fields the scorer needs but the row omits default cleanly, never undefined
  assert.equal(profile.company, null);
  const sparse = toScorerProfile({ id: "sparse" });
  assert.deepEqual(sparse.secondary_role_types, []); // `?? []` fallback
  assert.equal(sparse.needs, null); // array fields default to null
  assert.equal(sparse.role_details, null);
  // the column list stays a superset of what the adapter reads
  for (const key of ["needs", "offers", "primary_goal", "who_to_meet", "role_details", "seniority"]) {
    assert.ok(SCORER_PROFILE_COLUMNS.includes(key), `${key} missing from SCORER_PROFILE_COLUMNS`);
  }
});

test("computeLiveMatch returns the same numbers calculateMatchScore would for that pair", () => {
  const founder = toScorerProfile(scoringRow("f", "Founder", {
    role_type: "Founder / Co-founder", primary_goal: "Meet Investors", who_to_meet: ["Investors"],
    needs: ["Raising Capital"], offers: ["Product Feedback"],
  }));
  const investor = toScorerProfile(scoringRow("i", "Investor", {
    role_type: "Investor", primary_goal: "Build Community", offers: ["Investment Capital", "Financial Strategy"],
  }));

  const live = computeLiveMatch(founder, investor);
  const raw = calculateMatchScore(founder, investor);

  assert.equal(live.computedScore, raw.aToBScore);
  assert.equal(live.computedConfidence, raw.aToBConfidence);
  assert.deepEqual(live.reasons, raw.aToBReasons);
  assert.equal(live.reciprocityLabel, raw.reciprocityLabel);
  assert.equal(live.reverseScore, raw.bToAScore);
  assert.equal(live.reverseConfidence, raw.bToAConfidence);
  assert.equal(live.scoreVersion, raw.scoreVersion);
  // this pair is genuinely one-way, so the directions differ
  assert.notEqual(raw.aToBScore, raw.bToAScore);
});

const ROSTER = [
  { id: "matched-priya", fullName: "Priya Shah" },       // already matched
  { id: "unmatched-nia", fullName: "Nia Brooks" },
  { id: "unmatched-marcus", fullName: "Marcus Chen" },
  { id: "unmatched-jordan", fullName: "Jordan Lee" },
  { id: "unmatched-jordan2", fullName: "Jordan Alvarez" }, // shares first name with jordan
];
const UNMATCHED = new Set(["unmatched-nia", "unmatched-marcus", "unmatched-jordan", "unmatched-jordan2"]);

test("resolveNamedCandidateId: full name in the question -> that unmatched person", () => {
  assert.equal(
    resolveNamedCandidateId("How would I score with Nia Brooks?", ROSTER, UNMATCHED),
    "unmatched-nia",
  );
});

test("resolveNamedCandidateId: first + last as separate words -> resolves", () => {
  assert.equal(
    resolveNamedCandidateId("Is Marcus a good person for me to meet? I mean Chen.", ROSTER, UNMATCHED),
    "unmatched-marcus",
  );
});

test("resolveNamedCandidateId: unique first-name token -> fallback resolves", () => {
  assert.equal(
    resolveNamedCandidateId("tell me about nia", ROSTER, UNMATCHED),
    "unmatched-nia",
  );
});

test("resolveNamedCandidateId: ambiguous first name -> null", () => {
  assert.equal(resolveNamedCandidateId("what about jordan?", ROSTER, UNMATCHED), null);
});

test("resolveNamedCandidateId: name belongs to an already-matched person -> null (not eligible for live compare)", () => {
  assert.equal(resolveNamedCandidateId("how do I compare with Priya Shah?", ROSTER, UNMATCHED), null);
});

test("resolveNamedCandidateId: no name in the question -> null", () => {
  assert.equal(resolveNamedCandidateId("who should I meet next?", ROSTER, UNMATCHED), null);
});
