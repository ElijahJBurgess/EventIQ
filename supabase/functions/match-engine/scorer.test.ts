// Simple standalone test script for the match scoring function.
// Run with: npx tsx supabase/functions/match-engine/scorer.test.ts
//
// These are synthetic fixtures, not real seed data. Two reasons:
//   1. This prompt explicitly says not to write to (or read live data for)
//      the database yet -- scoring logic and tests only.
//   2. The Founder+Investor depth check needs `industry_focus` populated on
//      a founder, which is currently null on all 40 real seed profiles (it
//      was never part of the seeding spec). Synthetic fixtures let us prove
//      the mechanic works; populating industry_focus on real profiles is a
//      good follow-up before running this against live data.

import { calculateMatchScore, type Profile } from "./scorer.ts";

function profile(overrides: Partial<Profile> & { id: string; full_name: string }): Profile {
  return {
    location: null,
    role_type: null,
    company: null,
    title: null,
    who_to_meet: [],
    desired_outcomes: [],
    areas_of_expertise: [],
    matching_goal: null,
    role_details: {},
    industry_focus: null,
    interests: null,
    communities: null,
    hobbies: null,
    music_interests: null,
    favorite_conferences: null,
    ...overrides,
  };
}

interface TestCase {
  label: string;
  a: Profile;
  b: Profile;
  expected: string;
}

const cases: TestCase[] = [
  {
    label: "1. Founder actively fundraising x aligned Investor",
    a: profile({
      id: "a1",
      full_name: "Jordan Blake",
      role_type: "Founder",
      location: "Atlanta",
      matching_goal: "Meet Investors",
      who_to_meet: ["Investors"],
      areas_of_expertise: ["Fundraising", "Finance", "Strategy"],
      industry_focus: ["Fintech"],
      role_details: { companyStage: "Seed", lookingForInvestors: "Yes", lookingToHire: "No" },
    }),
    b: profile({
      id: "b1",
      full_name: "Priya Nair",
      role_type: "Investor",
      location: "Atlanta",
      matching_goal: "Meet Collaborators",
      who_to_meet: ["Founders"],
      areas_of_expertise: ["Venture Capital", "Finance", "Strategy"],
      role_details: { checkSize: "$100K-$500K", investmentFocusAreas: ["Fintech", "AI"] },
    }),
    expected: "should score 75 or above (Strong Match)",
  },
  {
    label: "2. Recruiter x Professional looking for career opportunities",
    a: profile({
      id: "a2",
      full_name: "Lauren Mitchell",
      role_type: "Recruiter",
      location: "Austin",
      matching_goal: "Find Talent",
      who_to_meet: ["Professionals"],
      areas_of_expertise: ["Recruiting", "Engineering", "Product"],
      role_details: { activelyHiring: "Yes", hiringFunctions: ["Engineering", "Product"] },
    }),
    b: profile({
      id: "b2",
      full_name: "Devon Brooks",
      role_type: "Professional",
      location: "New York",
      matching_goal: "Explore New Opportunities",
      desired_outcomes: ["Career Opportunities"],
      who_to_meet: ["Recruiters"],
      areas_of_expertise: ["Engineering", "Product", "Design"],
    }),
    expected: "should score 60 or above (Good Match or higher)",
  },
  {
    label: "3. Creator x Brand Partner",
    a: profile({
      id: "a3",
      full_name: "Sasha Moreno",
      role_type: "Creator",
      location: "Los Angeles",
      matching_goal: "Build Community",
      who_to_meet: ["Brand Partners"],
      areas_of_expertise: ["Content Creation", "Social Media", "Marketing"],
      role_details: { openToBrandPartnerships: "Yes", contentCategories: ["Technology", "Business"] },
    }),
    b: profile({
      id: "b3",
      full_name: "Danielle Foster",
      role_type: "Brand Partner",
      location: "Los Angeles",
      matching_goal: "General Networking",
      who_to_meet: ["Creators"],
      areas_of_expertise: ["Marketing", "Social Media", "Brand Strategy"],
    }),
    expected: "should score 65 or above (Good Match or higher)",
  },
  {
    label: "4. Two Founders, both looking for investors (peer match)",
    a: profile({
      id: "a4",
      full_name: "Zoe Bennett",
      role_type: "Founder",
      location: "New York",
      matching_goal: "Meet Investors",
      who_to_meet: ["Investors", "Founders"],
      areas_of_expertise: ["Product", "Strategy"],
      role_details: { companyStage: "Seed", lookingForInvestors: "Yes", lookingToHire: "No" },
    }),
    b: profile({
      id: "b4",
      full_name: "Omar Hassan",
      role_type: "Founder",
      location: "Austin",
      matching_goal: "Meet Investors",
      who_to_meet: ["Investors", "Founders"],
      areas_of_expertise: ["Strategy", "Fundraising"],
      role_details: { companyStage: "Series A", lookingForInvestors: "Yes", lookingToHire: "Yes" },
    }),
    expected: "should score 40 to 60 (peer match, not eliminated but not top-tier)",
  },
  {
    label: "5. Two Professionals, no overlapping goals",
    a: profile({
      id: "a5",
      full_name: "Isabella Cruz",
      role_type: "Professional",
      location: "Chicago",
      matching_goal: "Learn From Industry Leaders",
      who_to_meet: ["Founders", "Recruiters"],
      areas_of_expertise: ["Engineering"],
    }),
    b: profile({
      id: "b5",
      full_name: "Ethan Park",
      role_type: "Professional",
      location: "Miami",
      matching_goal: "Build Friendships",
      who_to_meet: ["Creators", "Speakers"],
      areas_of_expertise: ["Design"],
    }),
    expected: "should score below 40 (low / no match)",
  },
];

let failures = 0;

for (const { label, a, b, expected } of cases) {
  const result = calculateMatchScore(a, b);
  console.log(`\n=== ${label} ===`);
  console.log(`${a.full_name} (${a.role_type}) x ${b.full_name} (${b.role_type})`);
  console.log(`Expected: ${expected}`);
  console.log(`Score: ${result.score}  |  Label: ${result.label}`);
  console.log("Breakdown:", JSON.stringify(result.scoreBreakdown, null, 2));
  console.log("Match reasons:");
  result.matchReasons.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
}

console.log(`\nDone. ${cases.length} test pairs run.`);
if (failures > 0) process.exit(1);
