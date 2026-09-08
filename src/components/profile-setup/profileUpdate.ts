import type { ProfileSetupFormData } from "./types";

// "Pick one" profile fields where a blank value is not valid. Four of them have a
// DB CHECK that allows NULL but rejects '' — writing '' is a 23514 constraint
// violation (this is why the profile editor could fail to save with only a
// generic "save failed"); the rest just hold junk when blank. Coerce '' -> null
// so a field the user never set persists cleanly instead of erroring.
const PICK_ONE_FIELDS = [
  "role_type",
  "primary_function",
  "seniority",
  "primary_goal",
  "matching_goal",
  "industry_preference",
  "location_preference",
] as const;

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The column set written to `profiles` by BOTH the onboarding wizard
 * (`ProfileSetup.onSubmit`) and the profile editor (`EditProfileScreen.saveChanges`).
 * Callers spread the result and add their own extras — `role_details` for both,
 * plus `profile_completed` / `profile_completion_score` for onboarding.
 *
 * Free-text fields (name, title, company, location, linkedin_url, avatar_url)
 * are passed through as-is; only the {@link PICK_ONE_FIELDS} are '' -> null
 * coerced.
 */
export function buildProfileUpdatePayload(formData: ProfileSetupFormData) {
  return {
    full_name: formData.fullName,
    avatar_url: formData.avatarUrl,
    title: formData.jobTitle,
    company: formData.company,
    location: formData.location,
    linkedin_url: formData.linkedinUrl,
    role_type: emptyToNull(formData.roleType),
    secondary_role_types: formData.secondaryRoleTypes,
    primary_function: emptyToNull(formData.primaryFunction),
    additional_functions: formData.additionalFunctions,
    seniority: emptyToNull(formData.seniority),
    primary_goal: emptyToNull(formData.primaryGoal),
    secondary_goals: formData.secondaryGoals,
    needs: formData.needs,
    offers: formData.offers,
    areas_of_expertise: formData.offers,
    matching_goal: emptyToNull(formData.primaryGoal),
    who_to_meet: formData.whoToMeet,
    industry_preference: emptyToNull(formData.industryPreference),
    location_preference: emptyToNull(formData.locationPreference),
    career_level_preference: formData.careerLevelPreference,
    connection_preference: formData.connectionPreference,
  };
}

export { PICK_ONE_FIELDS };
