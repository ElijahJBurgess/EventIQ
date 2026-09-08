import type { ProfileSetupFormData } from "./types";

export interface MissingRequiredProfileField {
  field: "roleType" | "primaryFunction" | "seniority" | "primaryGoal" | "industryPreference" | "locationPreference";
  /** Same wording the signup wizard shows for this field. */
  message: string;
  /** The EditProfileScreen wizard page that edits this field (1-based). */
  page: number;
}

// One entry per pick-one field the signup wizard blocks on, in wizard-page
// order. The messages are copied verbatim from the pages that own them:
//  - roleType / primaryFunction / seniority -> Page1BasicInfo.validate
//  - primaryGoal                            -> Page2Goals.validate
//  - industryPreference / locationPreference -> Page3WhoAndFilters.validate
// EditProfileScreen.saveChanges writes the profile directly and never runs
// those page validators, so it re-checks the same fields here.
const REQUIRED_FIELDS: MissingRequiredProfileField[] = [
  { field: "roleType", message: "Select at least 1 identity", page: 1 },
  { field: "primaryFunction", message: "Select at least 1 function", page: 1 },
  { field: "seniority", message: "Select your current level of seniority", page: 1 },
  { field: "primaryGoal", message: "Select at least 1 goal", page: 2 },
  { field: "industryPreference", message: "Select an industry preference", page: 3 },
  { field: "locationPreference", message: "Select a location preference", page: 3 },
];

/**
 * Returns a finding for every required pick-one profile field left blank,
 * ordered by wizard page. An empty array means the profile clears the same
 * required-field bar the signup wizard enforces.
 */
export function findMissingRequiredProfileFields(
  formData: ProfileSetupFormData,
): MissingRequiredProfileField[] {
  return REQUIRED_FIELDS.filter((entry) => formData[entry.field].trim() === "");
}
