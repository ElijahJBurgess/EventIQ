import type { Dispatch, SetStateAction } from "react";

export interface ProfileSetupFormData {
  // Page 1 — Basic Info
  fullName: string;
  avatarUrl: string;
  jobTitle: string;
  company: string;
  location: string;
  linkedinUrl: string;
  roleType: string;

  // Page 2 — Matching Preferences
  whoToMeet: string[];
  desiredOutcomes: string[];
  areasOfExpertise: string[];
  matchingGoal: string;

  // Page 3 — Role Specific Questions (exact fields defined when Page 3 is built)
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
  linkedinUrl: "",
  roleType: "",
  whoToMeet: [],
  desiredOutcomes: [],
  areasOfExpertise: [],
  matchingGoal: "",
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
