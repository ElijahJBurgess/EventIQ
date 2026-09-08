import { describe, expect, it } from "vitest";
import { buildProfileUpdatePayload } from "./profileUpdate";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "./types";

function formData(overrides: Partial<ProfileSetupFormData> = {}): ProfileSetupFormData {
  return { ...initialProfileSetupFormData, ...overrides };
}

describe("buildProfileUpdatePayload", () => {
  it("coerces every blank 'pick one' field to null (the columns whose CHECK rejects '')", () => {
    const payload = buildProfileUpdatePayload(formData());

    expect(payload.role_type).toBeNull();
    expect(payload.primary_function).toBeNull();
    expect(payload.seniority).toBeNull();
    expect(payload.primary_goal).toBeNull();
    expect(payload.matching_goal).toBeNull();
    expect(payload.industry_preference).toBeNull();
    expect(payload.location_preference).toBeNull();
  });

  it("treats a whitespace-only value as blank", () => {
    const payload = buildProfileUpdatePayload(formData({ locationPreference: "   " }));
    expect(payload.location_preference).toBeNull();
  });

  it("passes valid 'pick one' values straight through and mirrors primary_goal into matching_goal", () => {
    const payload = buildProfileUpdatePayload(
      formData({
        roleType: "Founder / Co-founder",
        primaryFunction: "Engineering",
        seniority: "Director",
        primaryGoal: "Raise Capital",
        industryPreference: "AI",
        locationPreference: "mix",
      }),
    );

    expect(payload.role_type).toBe("Founder / Co-founder");
    expect(payload.primary_function).toBe("Engineering");
    expect(payload.seniority).toBe("Director");
    expect(payload.primary_goal).toBe("Raise Capital");
    expect(payload.matching_goal).toBe("Raise Capital");
    expect(payload.industry_preference).toBe("AI");
    expect(payload.location_preference).toBe("mix");
  });

  it("leaves free-text fields as empty strings (not coerced to null)", () => {
    const payload = buildProfileUpdatePayload(formData());

    expect(payload.full_name).toBe("");
    expect(payload.title).toBe("");
    expect(payload.company).toBe("");
    expect(payload.location).toBe("");
    expect(payload.linkedin_url).toBe("");
    expect(payload.avatar_url).toBe("");
  });

  it("passes array fields through unchanged and copies offers into areas_of_expertise", () => {
    const payload = buildProfileUpdatePayload(
      formData({
        secondaryRoleTypes: ["Investor"],
        offers: ["Intros", "Advice"],
        needs: ["Capital"],
        whoToMeet: ["Investors"],
        careerLevelPreference: ["Director"],
        connectionPreference: ["1:1"],
      }),
    );

    expect(payload.secondary_role_types).toEqual(["Investor"]);
    expect(payload.offers).toEqual(["Intros", "Advice"]);
    expect(payload.areas_of_expertise).toEqual(["Intros", "Advice"]);
    expect(payload.needs).toEqual(["Capital"]);
    expect(payload.who_to_meet).toEqual(["Investors"]);
    expect(payload.career_level_preference).toEqual(["Director"]);
    expect(payload.connection_preference).toEqual(["1:1"]);
  });
});
