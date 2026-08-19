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

import {
  calculateMatchScore,
  calculateNeedsOffersScore,
  calculateOpportunityCompatibility,
  calculateTimingConnectionCompatibility,
  type Profile,
} from "./scorer.ts";

function profile(overrides: Partial<Profile> & { id: string; full_name: string }): Profile {
  return {
    location: null,
    role_type: null,
    secondary_role_types: [],
    company: null,
    title: null,
    who_to_meet: [],
    desired_outcomes: [],
    areas_of_expertise: [],
    matching_goal: null,
    primary_goal: null,
    secondary_goals: [],
    role_details: {},
    industry_focus: null,
    needs: [],
    offers: [],
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
  expectedScore: number;
}

const cases: TestCase[] = [
  {
    label: "1. Founder / Co-founder actively fundraising x aligned Investor",
    a: profile({
      id: "a1",
      full_name: "Jordan Blake",
      role_type: "Founder / Co-founder",
      location: "Atlanta",
      matching_goal: "Meet Investors",
      primary_goal: "Meet Investors",
      who_to_meet: ["Investors"],
      areas_of_expertise: ["Fundraising", "Finance", "Strategy"],
      industry_focus: ["Fintech"],
      role_details: {
        Founder: { companyStage: "Seed", lookingForInvestors: "Yes", lookingToHire: "No" },
      },
    }),
    b: profile({
      id: "b1",
      full_name: "Priya Nair",
      role_type: "Investor",
      location: "Atlanta",
      matching_goal: "Meet Collaborators",
      primary_goal: "Meet Collaborators",
      who_to_meet: ["Founders"],
      areas_of_expertise: ["Venture Capital", "Finance", "Strategy"],
      role_details: {
        Investor: { checkSize: "$100K-$500K", investmentFocusAreas: ["Fintech", "AI"] },
      },
    }),
    expectedScore: 61,
  },
  {
    label: "2. Recruiter x Corporate Professional looking for career opportunities",
    a: profile({
      id: "a2",
      full_name: "Lauren Mitchell",
      role_type: "Recruiter",
      location: "Austin",
      matching_goal: "Hire Talent",
      primary_goal: "Hire Talent",
      who_to_meet: ["Professionals"],
      areas_of_expertise: ["Recruiting", "Engineering", "Product"],
      role_details: {
        Recruiter: { activelyHiring: "Yes", hiringFunctions: ["Engineering", "Product"] },
      },
    }),
    b: profile({
      id: "b2",
      full_name: "Devon Brooks",
      role_type: "Corporate Professional",
      location: "New York",
      matching_goal: "Explore Career Opportunities",
      primary_goal: "Explore Career Opportunities",
      who_to_meet: ["Recruiters"],
      areas_of_expertise: ["Engineering", "Product", "Design"],
    }),
    expectedScore: 53,
  },
  {
    label: "3. Creator / Influencer x Brand / Partnership Leader",
    a: profile({
      id: "a3",
      full_name: "Sasha Moreno",
      role_type: "Creator / Influencer",
      location: "Los Angeles",
      matching_goal: "Build Community",
      primary_goal: "Build Community",
      who_to_meet: ["Brand Partners"],
      areas_of_expertise: ["Content Creation", "Social Media", "Marketing"],
      role_details: {
        Creator: { openToBrandPartnerships: "Yes", contentCategories: ["Technology", "Business"] },
      },
    }),
    b: profile({
      id: "b3",
      full_name: "Danielle Foster",
      role_type: "Brand / Partnership Leader",
      location: "Los Angeles",
      matching_goal: "Meet Great People Without a Specific Ask",
      primary_goal: "Meet Great People Without a Specific Ask",
      who_to_meet: ["Creators"],
      areas_of_expertise: ["Marketing", "Social Media", "Brand Strategy"],
    }),
    expectedScore: 56,
  },
  {
    label: "4. Two Founder / Co-founders, both looking for investors (peer match)",
    a: profile({
      id: "a4",
      full_name: "Zoe Bennett",
      role_type: "Founder / Co-founder",
      location: "New York",
      matching_goal: "Meet Investors",
      primary_goal: "Meet Investors",
      who_to_meet: ["Investors", "Founders"],
      areas_of_expertise: ["Product", "Strategy"],
      role_details: {
        Founder: { companyStage: "Seed", lookingForInvestors: "Yes", lookingToHire: "No" },
      },
    }),
    b: profile({
      id: "b4",
      full_name: "Omar Hassan",
      role_type: "Founder / Co-founder",
      location: "Austin",
      matching_goal: "Meet Investors",
      primary_goal: "Meet Investors",
      who_to_meet: ["Investors", "Founders"],
      areas_of_expertise: ["Strategy", "Fundraising"],
      role_details: {
        Founder: { companyStage: "Series A", lookingForInvestors: "Yes", lookingToHire: "Yes" },
      },
    }),
    expectedScore: 31,
  },
  {
    label: "5. Two Corporate Professionals, no overlapping goals",
    a: profile({
      id: "a5",
      full_name: "Isabella Cruz",
      role_type: "Corporate Professional",
      location: "Chicago",
      matching_goal: "Learn From Experts",
      primary_goal: "Learn From Experts",
      who_to_meet: ["Founders", "Recruiters"],
      areas_of_expertise: ["Engineering"],
    }),
    b: profile({
      id: "b5",
      full_name: "Ethan Park",
      role_type: "Corporate Professional",
      location: "Miami",
      matching_goal: "Make Social Connections",
      primary_goal: "Make Social Connections",
      who_to_meet: ["Creators", "Speakers"],
      areas_of_expertise: ["Design"],
    }),
    expectedScore: 4,
  },
];

let failures = 0;

for (const { label, a, b, expectedScore } of cases) {
  const result = calculateMatchScore(a, b);
  console.log(`\n=== ${label} ===`);
  console.log(`${a.full_name} (${a.role_type}) x ${b.full_name} (${b.role_type})`);
  console.log(`Expected score: ${expectedScore}`);
  console.log(`Score: ${result.score}  |  Label: ${result.label}`);
  console.log("Breakdown:", JSON.stringify(result.scoreBreakdown, null, 2));
  console.log("Match reasons:");
  result.matchReasons.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  if (result.score !== expectedScore) {
    failures += 1;
    console.error(`  Expected score ${expectedScore}, received ${result.score}`);
  }
}

console.log(`\nDone. ${cases.length} test pairs run.`);

const secondaryGoalResult = calculateMatchScore(
  profile({
    id: "secondary-goal-a",
    full_name: "Secondary Goal A",
    primary_goal: "Explore Opportunities Generally",
    secondary_goals: ["Meet Investors"],
  }),
  profile({
    id: "secondary-goal-b",
    full_name: "Secondary Goal B",
    primary_goal: "Make Social Connections",
    secondary_goals: ["Raise Capital"],
  }),
);
console.log(`Secondary-goal complementary alignment: ${secondaryGoalResult.scoreBreakdown.eventGoalAlignment}`);
if (secondaryGoalResult.scoreBreakdown.eventGoalAlignment !== 30) {
  failures += 1;
  console.error(
    `  Expected secondary-goal alignment 30, received ${secondaryGoalResult.scoreBreakdown.eventGoalAlignment}`,
  );
}

const needsOffersCases = [
  {
    label: "exact match",
    needs: ["Investor Introductions"],
    offers: ["Investor Introductions"],
    expected: 100,
  },
  {
    label: "near match",
    needs: ["Raising Capital"],
    offers: ["Investment Capital"],
    expected: 70,
  },
  {
    label: "one of two needs matched",
    needs: ["Raising Capital", "Marketing"],
    offers: ["Investment Capital"],
    expected: 35,
  },
  {
    label: "best match per need without double-counting",
    needs: ["Finding Customers"],
    offers: ["Sales Expertise", "Customer Introductions"],
    expected: 70,
  },
  {
    label: "empty needs",
    needs: [],
    offers: ["Investor Introductions"],
    expected: 0,
  },
];

console.log("\n=== Standalone needs/offers scoring ===");
for (const testCase of needsOffersCases) {
  const actual = calculateNeedsOffersScore(testCase.needs, testCase.offers);
  console.log(`${testCase.label}: ${actual}`);
  if (actual !== testCase.expected) {
    failures += 1;
    console.error(`  Expected ${testCase.expected}, received ${actual}`);
  }
}

const opportunityFounder = profile({
  id: "opportunity-founder",
  full_name: "Opportunity Founder",
  role_type: "Founder / Co-founder",
  role_details: { Founder: { companyStage: "Seed" } },
});
const opportunityInvestor = profile({
  id: "opportunity-investor",
  full_name: "Opportunity Investor",
  role_type: "Investor",
  role_details: { Investor: { checkSize: "$100K-$500K" } },
});

const compatibilityCases: Array<{ label: string; actual: number | null; expected: number | null }> = [
  {
    label: "1. matching Founder/Investor tiers",
    actual: calculateOpportunityCompatibility(opportunityFounder, opportunityInvestor),
    expected: 100,
  },
  {
    label: "2. far-apart Founder/Investor tiers",
    actual: calculateOpportunityCompatibility(
      profile({
        id: "idea-founder",
        full_name: "Idea Founder",
        role_type: "Founder / Co-founder",
        role_details: { Founder: { companyStage: "Idea Stage" } },
      }),
      profile({
        id: "late-investor",
        full_name: "Late Investor",
        role_type: "Investor",
        role_details: { Investor: { checkSize: "$500K+" } },
      }),
    ),
    expected: 10,
  },
  {
    label: "3. opportunity compatibility not applicable",
    actual: calculateOpportunityCompatibility(
      profile({ id: "professional", full_name: "Corporate Person", role_type: "Corporate Professional" }),
      profile({ id: "executive", full_name: "Executive Person", role_type: "Executive" }),
    ),
    expected: null,
  },
  {
    label: "4. identical connection preferences",
    actual: calculateTimingConnectionCompatibility(
      profile({
        id: "connection-a",
        full_name: "Connection A",
        connection_preference: ["One-on-One Conversation", "Scheduled Meeting"],
      }),
      profile({
        id: "connection-b",
        full_name: "Connection B",
        connection_preference: ["One-on-One Conversation", "Scheduled Meeting"],
      }),
    ),
    expected: 100,
  },
  {
    label: "5. disjoint connection preferences without timing",
    actual: calculateTimingConnectionCompatibility(
      profile({
        id: "different-connection-a",
        full_name: "Different Connection A",
        connection_preference: ["Quick Introduction"],
      }),
      profile({
        id: "different-connection-b",
        full_name: "Different Connection B",
        connection_preference: ["Scheduled Meeting"],
      }),
    ),
    expected: 0,
  },
  {
    label: "6. timing/connection compatibility not applicable",
    actual: calculateTimingConnectionCompatibility(
      profile({ id: "no-data-a", full_name: "No Data A" }),
      profile({ id: "no-data-b", full_name: "No Data B" }),
    ),
    expected: null,
  },
  {
    label: "timing tiers: both immediate",
    actual: calculateTimingConnectionCompatibility(
      profile({
        id: "timing-immediate-a",
        full_name: "Timing Immediate A",
        role_details: { Founder: { fundraisingTimeline: "Actively Raising" } },
      }),
      profile({
        id: "timing-immediate-b",
        full_name: "Timing Immediate B",
        role_details: { Recruiter: { hiringTimeline: "Actively Hiring" } },
      }),
    ),
    expected: 100,
  },
  {
    label: "timing tiers: immediate versus future",
    actual: calculateTimingConnectionCompatibility(
      profile({
        id: "timing-now",
        full_name: "Timing Now",
        role_details: { CareerSeeker: { searchStatus: "Actively Searching" } },
      }),
      profile({
        id: "timing-future",
        full_name: "Timing Future",
        role_details: { Founder: { fundraisingTimeline: "Exploring for the Future" } },
      }),
    ),
    expected: 10,
  },
];

console.log("\n=== Standalone opportunity and timing/connection scoring ===");
for (const testCase of compatibilityCases) {
  console.log(`${testCase.label}: ${String(testCase.actual)}`);
  if (testCase.actual !== testCase.expected) {
    failures += 1;
    console.error(`  Expected ${String(testCase.expected)}, received ${String(testCase.actual)}`);
  }
}

if (failures > 0) process.exit(1);
