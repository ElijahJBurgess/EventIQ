import type { ProfileSetupFormData } from "./types";

type TextFieldName =
  | "location"
  | "avatarUrl"
  | "linkedinUrl"
  | "roleType"
  | "primaryFunction"
  | "seniority"
  | "primaryGoal"
  | "industryPreference"
  | "locationPreference";

type ArrayFieldName =
  | "secondaryRoleTypes"
  | "additionalFunctions"
  | "secondaryGoals"
  | "needs"
  | "offers"
  | "whoToMeet"
  | "careerLevelPreference"
  | "connectionPreference";

export type RequiredProfileFieldName = TextFieldName | ArrayFieldName;

export interface MissingRequiredProfileField {
  field: RequiredProfileFieldName;
  /** Same wording the signup wizard shows for this field. */
  message: string;
  /** The EditProfileScreen wizard page that edits this field (1-based). */
  page: number;
}

interface TextFieldEntry extends MissingRequiredProfileField {
  field: TextFieldName;
}
interface ArrayFieldEntry extends MissingRequiredProfileField {
  field: ArrayFieldName;
}

// Every field the signup wizard blocks on, in wizard-page order. The wizard
// enforces these per-page; EditProfileScreen.saveChanges writes the profile
// directly and never runs those page validators, so it re-checks them here.
// Messages are the exact strings the owning page shows.
const REQUIRED_TEXT_FIELDS: TextFieldEntry[] = [
  { field: "avatarUrl", message: "Profile photo is required", page: 1 },
  { field: "linkedinUrl", message: "LinkedIn URL is required", page: 1 },
  { field: "roleType", message: "Select at least 1 identity", page: 1 },
  { field: "primaryFunction", message: "Select at least 1 function", page: 1 },
  { field: "seniority", message: "Select your current level of seniority", page: 1 },
  { field: "primaryGoal", message: "Select at least 1 goal", page: 2 },
  { field: "industryPreference", message: "Select an industry preference", page: 3 },
  { field: "locationPreference", message: "Select a location preference", page: 3 },
];

// Multi-select fields that must carry at least one selection.
export const REQUIRED_ARRAY_FIELDS: ArrayFieldEntry[] = [
  { field: "secondaryRoleTypes", message: "Select at least 1 additional identity", page: 1 },
  { field: "additionalFunctions", message: "Select at least 1 additional function", page: 1 },
  { field: "secondaryGoals", message: "Select at least 1 additional goal", page: 2 },
  { field: "needs", message: "Select at least 1 way someone can help", page: 2 },
  { field: "offers", message: "Select at least 1 thing you can offer", page: 2 },
  { field: "whoToMeet", message: "Select at least 1 option", page: 3 },
  { field: "careerLevelPreference", message: "Select at least 1 career level", page: 3 },
  { field: "connectionPreference", message: "Select at least 1 connection preference", page: 3 },
];

/** field -> message, so the wizard pages and this guard stay in lockstep. */
export const REQUIRED_PROFILE_FIELD_MESSAGES = Object.fromEntries(
  [...REQUIRED_TEXT_FIELDS, ...REQUIRED_ARRAY_FIELDS].map((entry) => [entry.field, entry.message]),
) as Record<RequiredProfileFieldName, string>;

/**
 * Returns a finding for every required profile field left blank / empty,
 * ordered by wizard page. An empty array means the profile clears the same
 * required-field bar the signup wizard enforces.
 */
export function findMissingRequiredProfileFields(
  formData: ProfileSetupFormData,
): MissingRequiredProfileField[] {
  const missing: MissingRequiredProfileField[] = [];
  for (const entry of REQUIRED_TEXT_FIELDS) {
    if (formData[entry.field].trim() === "") missing.push(entry);
  }
  for (const entry of REQUIRED_ARRAY_FIELDS) {
    if ((formData[entry.field] ?? []).length === 0) missing.push(entry);
  }
  const locationError = getLocationValidationError(formData);
  if (locationError) missing.push({ field: "location", message: locationError, page: 1 });
  return missing.sort((left, right) => left.page - right.page);
}

/** Existing locations are explicitly marked on hydration; new typing must be confirmed. */
export function getLocationValidationError(formData: ProfileSetupFormData): string | undefined {
  if (!formData.location.trim()) return "Location is required";
  if (!formData.locationSelectionType) return "Select a city from the results or use the custom location option";
}
