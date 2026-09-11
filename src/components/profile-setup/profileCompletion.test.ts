import { describe, expect, it } from "vitest";
import { calculateCompletionScore } from "./profileCompletion";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "./types";

const complete: ProfileSetupFormData = {
  ...initialProfileSetupFormData, fullName: "Test Person", roleType: "Corporate Professional",
  primaryGoal: "Build Community", whoToMeet: ["Founders"], location: "Atlanta, GA", offers: ["Advice"],
};

describe("visible question completion", () => {
  it.each(["Founder / Co-founder", "Creator / Influencer"])("%s earns points when no questions apply", (roleType) => {
    expect(calculateCompletionScore({ ...complete, roleType, secondaryRoleTypes: ["Corporate Professional"], secondaryGoals: ["Expand Network"] })).toBe(100);
  });
  it.each([
    ["empty namespace", { Investor: {} }],
    ["inactive namespace", { Founder: { companyStage: "Seed" } }],
    ["custom identity", { Other: { customTitle: "Advisor" } }],
    ["unknown field", { Investor: { unknown: "answer" } }],
    ["blank scalar", { Investor: { checkSize: "  " } }],
    ["empty selection", { Investor: { investmentFocusAreas: [] } }],
    ["blank selection", { Investor: { investmentFocusAreas: [" "] } }],
    ["malformed value", { Investor: { checkSize: {}, investmentFocusAreas: [false, 0] } }],
  ])("does not count %s", (_, roleDetails) => {
    expect(calculateCompletionScore({ ...complete, roleType: "Investor", roleDetails })).toBe(80);
  });
  it.each([
    { roleType: "Founder / Co-founder", primaryGoal: "Raise Capital", roleDetails: { Founder: { fundraisingTimeline: "Actively Raising" } } },
    { primaryGoal: "Hire Talent", roleDetails: { Recruiter: { hiringTimeline: "Hiring now" } } },
    { primaryGoal: "Explore Career Opportunities", roleDetails: { CareerSeeker: { searchStatus: "Actively Searching" } } },
    { roleType: "Hiring Manager", roleDetails: { "Hiring Manager": { hiringTimeline: "Hiring now" } } },
    { roleType: "Investor", roleDetails: { Investor: { investmentFocusAreas: ["AI"] } } },
    { roleType: "Creator / Influencer", secondaryGoals: ["Find Brand Partners"], roleDetails: { Creator: { openToBrandPartnerships: "No" } } },
  ])("counts a visible required or optional answer: %j", (overrides) => {
    expect(calculateCompletionScore({ ...complete, ...overrides })).toBe(100);
  });
  it("tracks primary and secondary goal changes, ignoring hidden Founder answers", () => {
    const form = { ...complete, secondaryRoleTypes: ["Founder / Co-founder"], roleDetails: { Founder: { lookingForInvestors: "Yes" } } };
    expect(calculateCompletionScore({ ...form, secondaryGoals: ["Find Customers or Clients"] })).toBe(100);
    expect(calculateCompletionScore({ ...form, primaryGoal: "Raise Capital" })).toBe(80);
    expect(calculateCompletionScore({ ...form, secondaryGoals: ["Raise Capital"] })).toBe(80);
    expect(calculateCompletionScore({ ...form, secondaryGoals: ["Hire Talent"] })).toBe(80);
  });
  it("preserves weights and leaves optional skipping below 100", () => {
    expect(calculateCompletionScore({ ...complete, roleType: "Investor" })).toBe(80);
    expect(calculateCompletionScore({ ...complete, fullName: " " })).toBe(50);
    expect(calculateCompletionScore({ ...complete, location: "" })).toBe(80);
    expect(calculateCompletionScore({ ...complete, offers: [] })).toBe(90);
  });
});
