import { getQuestionBlocks } from "./roleQuestionRules";

const ROLE_DETAILS_NAMESPACES = [
  "Founder",
  "Investor",
  "Recruiter",
  "Hiring Manager",
  "Creator",
  "CareerSeeker",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function cleanRoleDetailsForIdentities(
  roleDetails: Record<string, unknown>,
  primaryRoleType: string,
  secondaryRoleTypes: string[],
  primaryGoal: string,
  secondaryGoals: string[],
): Record<string, unknown> {
  const activeNamespaces = new Set(getQuestionBlocks(
    primaryRoleType,
    secondaryRoleTypes,
    primaryGoal,
    secondaryGoals,
  ).map((block) => block.storageKey));
  let cleanedRoleDetails = roleDetails;

  ROLE_DETAILS_NAMESPACES.forEach((namespace) => {
    if (!activeNamespaces.has(namespace) && namespace in cleanedRoleDetails) {
      if (cleanedRoleDetails === roleDetails) cleanedRoleDetails = { ...roleDetails };
      delete cleanedRoleDetails[namespace];
    }
  });

  const founderDetails = asRecord(cleanedRoleDetails.Founder);
  if (activeNamespaces.has("Founder") && founderDetails) {
    const hiddenFounderField = primaryGoal === "Raise Capital" || secondaryGoals.includes("Raise Capital")
      ? "lookingForInvestors"
      : "fundraisingTimeline";

    if (hiddenFounderField in founderDetails) {
      if (cleanedRoleDetails === roleDetails) cleanedRoleDetails = { ...roleDetails };
      const nextFounderDetails = { ...founderDetails };
      delete nextFounderDetails[hiddenFounderField];
      cleanedRoleDetails.Founder = nextFounderDetails;
    }
  }

  return cleanedRoleDetails;
}
