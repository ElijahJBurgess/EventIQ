import type { ProfileSetupFormData } from "./types";
import { getQuestionBlocks } from "./roleQuestionRules";
import { cleanRoleDetailsForIdentities } from "./roleDetailsUtils";

const VISIBLE_FIELDS = {
  Investor: ["checkSize", "investmentFocusAreas"],
  Recruiter: ["hiringTimeline", "activelyHiring", "hiringFunctions"],
  Creator: ["openToBrandPartnerships", "contentCategories"],
  CareerSeeker: ["searchStatus"],
};

function hasAnswer(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0
    : Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim().length > 0);
}

export function calculateCompletionScore(formData: ProfileSetupFormData): number {
  let score = 0;

  const mandatoryFilled =
    formData.fullName.trim().length > 0 &&
    formData.roleType.trim().length > 0 &&
    formData.whoToMeet.length >= 1 &&
    formData.primaryGoal.trim().length > 0;
  if (mandatoryFilled) score += 50;

  const optionalPage1Filled =
    formData.avatarUrl.trim().length > 0 ||
    formData.jobTitle.trim().length > 0 ||
    formData.company.trim().length > 0 ||
    formData.location.trim().length > 0 ||
    formData.linkedinUrl.trim().length > 0;
  if (optionalPage1Filled) score += 20;

  const blocks = getQuestionBlocks(formData.roleType, formData.secondaryRoleTypes, formData.primaryGoal, formData.secondaryGoals);
  const details = cleanRoleDetailsForIdentities(formData.roleDetails, formData.roleType, formData.secondaryRoleTypes, formData.primaryGoal, formData.secondaryGoals);
  const raising = [formData.primaryGoal, ...formData.secondaryGoals].includes("Raise Capital");
  const roleDetailsFilled = blocks.some((block) => {
    const answers = details[block.storageKey];
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return false;
    const fields = block.type === "Founder"
      ? ["companyStage", "lookingToHire", raising ? "fundraisingTimeline" : "lookingForInvestors"]
      : VISIBLE_FIELDS[block.type];
    return fields.some((field) => hasAnswer((answers as Record<string, unknown>)[field]));
  });
  if (blocks.length === 0 || roleDetailsFilled) score += 20;

  if (formData.offers.length >= 1) score += 10;

  return Math.min(score, 100);
}

