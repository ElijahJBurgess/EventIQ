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

function getActiveRoleDetailsNamespaces(
  primaryRoleType: string,
  secondaryRoleTypes: string[],
  primaryGoal: string,
  secondaryGoals: string[],
): Set<string> {
  const identities = new Set([primaryRoleType, ...secondaryRoleTypes].filter(Boolean));
  const goals = new Set([primaryGoal, ...secondaryGoals].filter(Boolean));
  const activeNamespaces = new Set<string>();

  if (
    identities.has("Founder / Co-founder") &&
    (goals.has("Raise Capital") || goals.has("Find Customers or Clients"))
  ) {
    activeNamespaces.add("Founder");
  }
  if (identities.has("Investor")) activeNamespaces.add("Investor");
  if (identities.has("Creator / Influencer") && goals.has("Find Brand Partners")) {
    activeNamespaces.add("Creator");
  }

  if (identities.has("Recruiter") || identities.has("Hiring Manager") || goals.has("Hire Talent")) {
    if (primaryRoleType === "Recruiter") {
      activeNamespaces.add("Recruiter");
    } else if (primaryRoleType === "Hiring Manager") {
      activeNamespaces.add("Hiring Manager");
    } else {
      activeNamespaces.add("Recruiter");
    }
  }

  if (goals.has("Explore Career Opportunities")) activeNamespaces.add("CareerSeeker");

  return activeNamespaces;
}

export function cleanRoleDetailsForIdentities(
  roleDetails: Record<string, unknown>,
  primaryRoleType: string,
  secondaryRoleTypes: string[],
  primaryGoal: string,
  secondaryGoals: string[],
): Record<string, unknown> {
  const activeNamespaces = getActiveRoleDetailsNamespaces(
    primaryRoleType,
    secondaryRoleTypes,
    primaryGoal,
    secondaryGoals,
  );
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
