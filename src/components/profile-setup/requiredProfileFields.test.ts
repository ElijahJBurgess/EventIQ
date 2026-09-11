import { describe, expect, it } from "vitest";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "./types";
import { findMissingRequiredProfileFields, REQUIRED_ARRAY_FIELDS } from "./requiredProfileFields";

const complete: ProfileSetupFormData = {
  ...initialProfileSetupFormData,
  location: "Atlanta, GA",
  locationSelectionType: "existing",
  avatarUrl: "https://example.com/photo.jpg",
  linkedinUrl: "linkedin.com/in/jordanlee",
  roleType: "Founder / Co-founder",
  primaryFunction: "Product",
  seniority: "Senior",
  primaryGoal: "Raise Capital",
  industryPreference: "Show me a mix of both",
  locationPreference: "mix",
  secondaryRoleTypes: ["Investor"],
  additionalFunctions: ["Engineering"],
  secondaryGoals: ["Hire Talent"],
  needs: ["Hiring Talent"],
  offers: ["Career Advice"],
  whoToMeet: ["Founders"],
  careerLevelPreference: ["Director"],
  connectionPreference: ["Quick Introduction"],
};

describe("findMissingRequiredProfileFields", () => {
  it("returns no findings when every required field is set", () => {
    expect(findMissingRequiredProfileFields(complete)).toEqual([]);
  });

  it("flags a missing profile photo", () => {
    const findings = findMissingRequiredProfileFields({ ...complete, avatarUrl: "" });
    expect(findings).toEqual([{ field: "avatarUrl", message: "Profile photo is required", page: 1 }]);
  });

  it("flags a missing LinkedIn URL", () => {
    const findings = findMissingRequiredProfileFields({ ...complete, linkedinUrl: "" });
    expect(findings).toEqual([{ field: "linkedinUrl", message: "LinkedIn URL is required", page: 1 }]);
  });

  it("flags a blank identity with the signup wording", () => {
    const findings = findMissingRequiredProfileFields({ ...complete, roleType: "" });
    expect(findings).toEqual([{ field: "roleType", message: "Select at least 1 identity", page: 1 }]);
  });

  it("flags a blank primary function with the signup wording", () => {
    const findings = findMissingRequiredProfileFields({ ...complete, primaryFunction: "" });
    expect(findings).toEqual([{ field: "primaryFunction", message: "Select at least 1 function", page: 1 }]);
  });

  it("flags a blank seniority with the signup wording", () => {
    const findings = findMissingRequiredProfileFields({ ...complete, seniority: "" });
    expect(findings).toEqual([
      { field: "seniority", message: "Select your current level of seniority", page: 1 },
    ]);
  });

  it("flags a blank primary goal with the signup wording", () => {
    const findings = findMissingRequiredProfileFields({ ...complete, primaryGoal: "" });
    expect(findings).toEqual([{ field: "primaryGoal", message: "Select at least 1 goal", page: 2 }]);
  });

  it("flags a blank industry preference with the signup wording", () => {
    const findings = findMissingRequiredProfileFields({ ...complete, industryPreference: "" });
    expect(findings).toEqual([
      { field: "industryPreference", message: "Select an industry preference", page: 3 },
    ]);
  });

  it("flags a blank location preference with the signup wording", () => {
    const findings = findMissingRequiredProfileFields({ ...complete, locationPreference: "" });
    expect(findings).toEqual([
      { field: "locationPreference", message: "Select a location preference", page: 3 },
    ]);
  });

  it("treats whitespace-only text values as blank", () => {
    const findings = findMissingRequiredProfileFields({ ...complete, seniority: "   " });
    expect(findings.map((f) => f.field)).toEqual(["seniority"]);
  });

  // The eight multi-selects that became required.
  for (const entry of REQUIRED_ARRAY_FIELDS) {
    it(`flags an empty ${entry.field}`, () => {
      const findings = findMissingRequiredProfileFields({ ...complete, [entry.field]: [] });
      expect(findings).toEqual([entry]);
    });
  }

  it("passes when a multi-select has at least one selection", () => {
    expect(findMissingRequiredProfileFields({ ...complete, whoToMeet: ["Investors", "Recruiters"] })).toEqual([]);
  });

  it("returns findings ordered by wizard page when several are missing", () => {
    const findings = findMissingRequiredProfileFields({
      ...complete,
      connectionPreference: [],
      roleType: "",
      secondaryGoals: [],
      additionalFunctions: [],
    });
    expect(findings.map((f) => f.page)).toEqual([1, 1, 2, 3]);
    expect(findings.map((f) => f.field)).toEqual([
      "roleType",
      "additionalFunctions",
      "secondaryGoals",
      "connectionPreference",
    ]);
  });
});


it.each(["", "Changed city"])("rejects cleared or unconfirmed location %s in editor validation", (location) => {
  expect(findMissingRequiredProfileFields({ ...complete, location, locationSelectionType: "" }))
    .toContainEqual({ field: "location", page: 1, message: location ? "Select a city from the results or use the custom location option" : "Location is required" });
});
