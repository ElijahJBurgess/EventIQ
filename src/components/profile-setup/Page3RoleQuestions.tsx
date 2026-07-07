import { useState } from "react";
import PillSelect from "./PillSelect";
import type { ProfileSetupPageProps } from "./types";

const COMPANY_STAGE_OPTIONS = [
  "Idea Stage",
  "Pre-Seed",
  "Seed",
  "Series A",
  "Series B+",
  "Bootstrapped",
  "Acquired / Exited",
];

const CHECK_SIZE_OPTIONS = ["Under $25K", "$25K–$100K", "$100K–$500K", "$500K+"];

const INVESTMENT_FOCUS_OPTIONS = [
  "Consumer",
  "Enterprise SaaS",
  "AI",
  "Fintech",
  "Healthcare",
  "Climate",
  "Creator Economy",
  "Media",
  "Sports",
  "Entertainment",
  "Other",
];

const HIRING_FUNCTIONS_OPTIONS = [
  "Engineering",
  "Product",
  "Design",
  "Marketing",
  "Sales",
  "Operations",
  "Finance",
  "HR",
  "Community",
  "Executive Leadership",
];

const CONTENT_CATEGORY_OPTIONS = [
  "Business",
  "Technology",
  "Career",
  "Lifestyle",
  "Fashion",
  "Travel",
  "Sports",
  "Music",
  "Entertainment",
  "Wellness",
];

const YES_NO_OPTIONS = ["Yes", "No"];
const MULTI_MAX = 5;

const sectionLabel = "text-sm font-bold mb-2 block";
const countText = "text-xs text-muted-foreground normal-case font-sans mt-2";
const messageText = "text-xs text-destructive normal-case font-sans mt-2";

const asString = (value: unknown): string => (typeof value === "string" ? value : "");
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export default function Page3RoleQuestions({ formData, setFormData, onNext, onBack }: ProfileSetupPageProps) {
  const roleType = formData.roleType;
  const roleDetails = formData.roleDetails;

  const [investmentFocusMaxHit, setInvestmentFocusMaxHit] = useState(false);
  const [hiringFunctionsMaxHit, setHiringFunctionsMaxHit] = useState(false);
  const [contentCategoriesMaxHit, setContentCategoriesMaxHit] = useState(false);

  // Writes straight into the shared formData.roleDetails on every change (no
  // separate local draft) so answers survive Back navigation even if the user
  // never clicks Continue/Skip on this visit to the page.
  const setDetail = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, roleDetails: { ...prev.roleDetails, [key]: value } }));
  };

  const handleSkip = () => {
    setFormData((prev) => ({ ...prev, roleDetails: {} }));
    onNext();
  };

  const header = (
    <>
      <h1 className="text-3xl sm:text-4xl font-black">A few more details</h1>
      <p className="text-sm text-muted-foreground normal-case font-sans mt-2 mb-8">
        These help us find even better matches for you — all optional
      </p>
    </>
  );

  const navButtons = (
    <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
      <button
        onClick={onBack}
        className="w-full sm:w-auto bg-card text-foreground ooo-border px-8 py-3 shadow-card hover-lift font-label"
      >
        Back
      </button>
      <button
        onClick={handleSkip}
        className="w-full sm:w-auto bg-card text-muted-foreground ooo-border px-8 py-3 shadow-card hover-lift font-label"
      >
        Skip for now
      </button>
      <button
        onClick={onNext}
        className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 shadow-card hover-lift font-label"
      >
        Continue
      </button>
    </div>
  );

  if (roleType === "Founder") {
    const companyStage = asString(roleDetails.companyStage);
    const lookingForInvestors = asString(roleDetails.lookingForInvestors);
    const lookingToHire = asString(roleDetails.lookingToHire);
    return (
      <div>
        {header}
        <div className="space-y-8">
          <div>
            <label className={sectionLabel}>Company stage</label>
            <PillSelect
              options={COMPANY_STAGE_OPTIONS}
              selected={companyStage ? [companyStage] : []}
              singleSelect
              onChange={(next) => setDetail("companyStage", next[0] ?? "")}
            />
          </div>
          <div>
            <label className={sectionLabel}>Looking for investors?</label>
            <PillSelect
              options={YES_NO_OPTIONS}
              selected={lookingForInvestors ? [lookingForInvestors] : []}
              singleSelect
              onChange={(next) => setDetail("lookingForInvestors", next[0] ?? "")}
            />
          </div>
          <div>
            <label className={sectionLabel}>Looking to hire?</label>
            <PillSelect
              options={YES_NO_OPTIONS}
              selected={lookingToHire ? [lookingToHire] : []}
              singleSelect
              onChange={(next) => setDetail("lookingToHire", next[0] ?? "")}
            />
          </div>
        </div>
        {navButtons}
      </div>
    );
  }

  if (roleType === "Investor") {
    const checkSize = asString(roleDetails.checkSize);
    const investmentFocusAreas = asStringArray(roleDetails.investmentFocusAreas);
    return (
      <div>
        {header}
        <div className="space-y-8">
          <div>
            <label className={sectionLabel}>Typical check size</label>
            <PillSelect
              options={CHECK_SIZE_OPTIONS}
              selected={checkSize ? [checkSize] : []}
              singleSelect
              onChange={(next) => setDetail("checkSize", next[0] ?? "")}
            />
          </div>
          <div>
            <label className={sectionLabel}>Investment focus areas</label>
            <PillSelect
              options={INVESTMENT_FOCUS_OPTIONS}
              selected={investmentFocusAreas}
              max={MULTI_MAX}
              onMaxAttempt={() => setInvestmentFocusMaxHit(true)}
              onChange={(next) => {
                setInvestmentFocusMaxHit(false);
                setDetail("investmentFocusAreas", next);
              }}
            />
            <p className={countText}>
              {investmentFocusAreas.length} of {MULTI_MAX} selected
            </p>
            {investmentFocusMaxHit && <p className={messageText}>Maximum {MULTI_MAX} selections</p>}
          </div>
        </div>
        {navButtons}
      </div>
    );
  }

  if (roleType === "Recruiter" || roleType === "Hiring Manager") {
    const activelyHiring = asString(roleDetails.activelyHiring);
    const hiringFunctions = asStringArray(roleDetails.hiringFunctions);
    return (
      <div>
        {header}
        <div className="space-y-8">
          <div>
            <label className={sectionLabel}>Actively hiring?</label>
            <PillSelect
              options={YES_NO_OPTIONS}
              selected={activelyHiring ? [activelyHiring] : []}
              singleSelect
              onChange={(next) => setDetail("activelyHiring", next[0] ?? "")}
            />
          </div>
          <div>
            <label className={sectionLabel}>Hiring functions</label>
            <PillSelect
              options={HIRING_FUNCTIONS_OPTIONS}
              selected={hiringFunctions}
              max={MULTI_MAX}
              onMaxAttempt={() => setHiringFunctionsMaxHit(true)}
              onChange={(next) => {
                setHiringFunctionsMaxHit(false);
                setDetail("hiringFunctions", next);
              }}
            />
            <p className={countText}>
              {hiringFunctions.length} of {MULTI_MAX} selected
            </p>
            {hiringFunctionsMaxHit && <p className={messageText}>Maximum {MULTI_MAX} selections</p>}
          </div>
        </div>
        {navButtons}
      </div>
    );
  }

  if (roleType === "Creator") {
    const openToBrandPartnerships = asString(roleDetails.openToBrandPartnerships);
    const contentCategories = asStringArray(roleDetails.contentCategories);
    return (
      <div>
        {header}
        <div className="space-y-8">
          <div>
            <label className={sectionLabel}>Open to brand partnerships?</label>
            <PillSelect
              options={YES_NO_OPTIONS}
              selected={openToBrandPartnerships ? [openToBrandPartnerships] : []}
              singleSelect
              onChange={(next) => setDetail("openToBrandPartnerships", next[0] ?? "")}
            />
          </div>
          <div>
            <label className={sectionLabel}>Content categories</label>
            <PillSelect
              options={CONTENT_CATEGORY_OPTIONS}
              selected={contentCategories}
              max={MULTI_MAX}
              onMaxAttempt={() => setContentCategoriesMaxHit(true)}
              onChange={(next) => {
                setContentCategoriesMaxHit(false);
                setDetail("contentCategories", next);
              }}
            />
            <p className={countText}>
              {contentCategories.length} of {MULTI_MAX} selected
            </p>
            {contentCategoriesMaxHit && <p className={messageText}>Maximum {MULTI_MAX} selections</p>}
          </div>
        </div>
        {navButtons}
      </div>
    );
  }

  // Professional, Brand Partner, Community Builder, Student, Sponsor, Other (and any unrecognized role type)
  return (
    <div>
      {header}
      <div className="ooo-card bg-warm p-6 text-center">
        <p className="normal-case font-sans text-sm leading-6">
          You're all set on this step. Complete your profile after setup to unlock even better matches.
        </p>
      </div>
      {navButtons}
    </div>
  );
}
