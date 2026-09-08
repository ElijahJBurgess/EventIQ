import { describe, expect, it } from "vitest";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "./types";
import { findMissingRequiredProfileFields } from "./requiredProfileFields";

const complete: ProfileSetupFormData = {
  ...initialProfileSetupFormData,
  roleType: "Founder / Co-founder",
  primaryFunction: "Product",
  seniority: "Senior",
  primaryGoal: "Raise Capital",
  industryPreference: "Show me a mix of both",
  locationPreference: "mix",
};

describe("findMissingRequiredProfileFields", () => {
  it("returns no findings when every required pick-one field is set", () => {
    expect(findMissingRequiredProfileFields(complete)).toEqual([]);
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

  it("treats whitespace-only values as blank", () => {
    const findings = findMissingRequiredProfileFields({ ...complete, seniority: "   " });
    expect(findings.map((f) => f.field)).toEqual(["seniority"]);
  });

  it("returns findings ordered by wizard page when several are blank", () => {
    const findings = findMissingRequiredProfileFields({
      ...complete,
      locationPreference: "",
      roleType: "",
      primaryGoal: "",
    });
    expect(findings.map((f) => f.field)).toEqual(["roleType", "primaryGoal", "locationPreference"]);
  });
});
