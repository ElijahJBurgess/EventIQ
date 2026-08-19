import type { Dispatch, SetStateAction } from "react";

export interface ProfileSetupFormData {
  // Page 1 — Basic Info
  fullName: string;
  avatarUrl: string;
  jobTitle: string;
  company: string;
  location: string;
  locationCity: string;
  locationStateCode: string;
  locationSelectionType: "database" | "custom" | "existing" | "";
  linkedinUrl: string;
  roleType: string;
  secondaryRoleTypes: string[];
  primaryFunction: string;
  additionalFunctions: string[];
  seniority: string;

  // Page 2 — Goals, Needs, Offers
  primaryGoal: string;
  secondaryGoals: string[];
  needs: string[];
  offers: string[];

  // Page 3 — Who to Meet and Match Filters
  whoToMeet: string[];
  industryPreference: string;
  locationPreference: string;
  careerLevelPreference: string[];
  connectionPreference: string[];

  // Page 4 — Role Specific Questions
  roleDetails: Record<string, unknown>;

  // Page 4 — Terms and AI Consent (exact fields defined when Page 4 is built)
  agreedToTerms: boolean;
  aiConsent: boolean;
}

export const initialProfileSetupFormData: ProfileSetupFormData = {
  fullName: "",
  avatarUrl: "",
  jobTitle: "",
  company: "",
  location: "",
  locationCity: "",
  locationStateCode: "",
  locationSelectionType: "",
  linkedinUrl: "",
  roleType: "",
  secondaryRoleTypes: [],
  primaryFunction: "",
  additionalFunctions: [],
  seniority: "",
  primaryGoal: "",
  secondaryGoals: [],
  needs: [],
  offers: [],
  whoToMeet: [],
  industryPreference: "",
  locationPreference: "",
  careerLevelPreference: [],
  connectionPreference: [],
  roleDetails: {},
  agreedToTerms: false,
  aiConsent: false,
};

export interface ProfileSetupPageProps {
  formData: ProfileSetupFormData;
  setFormData: Dispatch<SetStateAction<ProfileSetupFormData>>;
  onNext: () => void;
  onBack: () => void;
}

export interface Page4Props extends ProfileSetupPageProps {
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError: string;
}
