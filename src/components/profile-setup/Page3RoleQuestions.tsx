import { useEffect, useState } from "react";
import PillSelect from "./PillSelect";
import { cleanRoleDetailsForIdentities } from "./roleDetailsUtils";
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
const FUNDRAISING_TIMELINE_OPTIONS = [
  "Actively Raising",
  "Preparing to Raise Within 6 Months",
  "Open to Building Investor Relationships",
  "Exploring for the Future",
];
const HIRING_TIMELINE_OPTIONS = [
  "Actively Hiring",
  "Hiring Within 3-6 Months",
  "Building a Future Talent Pipeline",
];
const CAREER_SEARCH_STATUS_OPTIONS = [
  "Actively Searching",
  "Open to the Right Opportunity",
  "Planning to Explore Within 6 Months",
  "Not Currently Searching",
];
const MULTI_MAX = 5;

const sectionLabel = "text-sm font-bold mb-2 block";
const countText = "text-xs text-muted-foreground normal-case font-sans mt-2";
const messageText = "text-xs text-destructive normal-case font-sans mt-2";

const asString = (value: unknown): string => (typeof value === "string" ? value : "");
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

type QuestionType = "Founder" | "Investor" | "Recruiter" | "Creator" | "CareerSeeker";

interface QuestionBlock {
  type: QuestionType;
  label: string;
  storageKey: string;
}

interface Page3RoleQuestionsProps extends ProfileSetupPageProps {
  nextLabel?: string;
  nextDisabled?: boolean;
}

function getQuestionBlocks(
  primaryRole: string,
  secondaryRoles: string[],
  primaryGoal: string,
  secondaryGoals: string[],
): QuestionBlock[] {
  const identities = Array.from(new Set([primaryRole, ...secondaryRoles].filter(Boolean)));
  const goals = new Set([primaryGoal, ...secondaryGoals].filter(Boolean));
  const hasRecruiter = identities.includes("Recruiter");
  const hasHiringManager = identities.includes("Hiring Manager");
  let recruitingBlockAdded = false;

  const blocks = identities.flatMap((role): QuestionBlock[] => {
    if (role === "Founder / Co-founder") {
      return goals.has("Raise Capital") || goals.has("Find Customers or Clients")
        ? [{ type: "Founder", label: role, storageKey: "Founder" }]
        : [];
    }

    if (role === "Creator / Influencer") {
      return goals.has("Find Brand Partners")
        ? [{ type: "Creator", label: role, storageKey: "Creator" }]
        : [];
    }

    if (role === "Investor") {
      return [{ type: role, label: role, storageKey: role }];
    }

    if (role === "Recruiter" || role === "Hiring Manager") {
      if (recruitingBlockAdded) return [];
      recruitingBlockAdded = true;

      const storageKey =
        primaryRole === "Recruiter"
          ? "Recruiter"
          : primaryRole === "Hiring Manager"
            ? "Hiring Manager"
            : "Recruiter";
      const label = hasRecruiter && hasHiringManager ? "Recruiter / Hiring Manager" : role;

      return [{ type: "Recruiter", label, storageKey }];
    }

    return [];
  });

  if (goals.has("Hire Talent") && !recruitingBlockAdded) {
    blocks.push({ type: "Recruiter", label: "Hiring", storageKey: "Recruiter" });
  }

  if (goals.has("Explore Career Opportunities")) {
    blocks.push({ type: "CareerSeeker", label: "Career seeker", storageKey: "CareerSeeker" });
  }

  return blocks;
}

export default function Page3RoleQuestions({
  formData,
  setFormData,
  onNext,
  onBack,
  nextLabel = "Continue",
  nextDisabled = false,
}: Page3RoleQuestionsProps) {
  const selectedGoals = new Set([formData.primaryGoal, ...formData.secondaryGoals].filter(Boolean));
  const questionBlocks = getQuestionBlocks(
    formData.roleType,
    formData.secondaryRoleTypes,
    formData.primaryGoal,
    formData.secondaryGoals,
  );
  const roleDetails = formData.roleDetails;

  const [investmentFocusMaxHit, setInvestmentFocusMaxHit] = useState(false);
  const [hiringFunctionsMaxHit, setHiringFunctionsMaxHit] = useState(false);
  const [contentCategoriesMaxHit, setContentCategoriesMaxHit] = useState(false);
  const [requiredErrors, setRequiredErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData((prev) => {
      const cleanedRoleDetails = cleanRoleDetailsForIdentities(
        prev.roleDetails,
        prev.roleType,
        prev.secondaryRoleTypes,
        prev.primaryGoal,
        prev.secondaryGoals,
      );

      return cleanedRoleDetails === prev.roleDetails ? prev : { ...prev, roleDetails: cleanedRoleDetails };
    });
  }, [formData.roleType, formData.secondaryRoleTypes, formData.primaryGoal, formData.secondaryGoals, setFormData]);

  // Writes straight into the selected role's namespace on every change so
  // answers survive Back navigation even if Continue is not clicked.
  const setDetail = (storageKey: string, key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      roleDetails: {
        ...prev.roleDetails,
        [storageKey]: {
          ...asRecord(prev.roleDetails[storageKey]),
          [key]: value,
        },
      },
    }));
  };

  const handleSkip = () => {
    const displayedKeys = new Set(questionBlocks.map((block) => block.storageKey));
    setFormData((prev) => {
      const nextRoleDetails = { ...prev.roleDetails };
      displayedKeys.forEach((key) => delete nextRoleDetails[key]);
      return { ...prev, roleDetails: nextRoleDetails };
    });
    onNext();
  };

  const validateRequiredQuestions = () => {
    const errors: Record<string, string> = {};

    questionBlocks.forEach((block) => {
      const details = asRecord(roleDetails[block.storageKey]);
      if (
        block.type === "Founder" &&
        selectedGoals.has("Raise Capital") &&
        !asString(details.fundraisingTimeline)
      ) {
        errors[`${block.storageKey}.fundraisingTimeline`] = "Select a fundraising timeline";
      }
      if (block.type === "Recruiter" && !asString(details.hiringTimeline)) {
        errors[`${block.storageKey}.hiringTimeline`] = "Select a hiring timeline";
      }
      if (block.type === "CareerSeeker" && !asString(details.searchStatus)) {
        errors[`${block.storageKey}.searchStatus`] = "Select your search status";
      }
    });

    setRequiredErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const hasRequiredQuestions = questionBlocks.some(
    (block) =>
      block.type === "Recruiter" ||
      block.type === "CareerSeeker" ||
      (block.type === "Founder" && selectedGoals.has("Raise Capital")),
  );

  const header = (
    <>
      <h1 className="text-3xl sm:text-4xl font-black">A few more details</h1>
      <p className="text-sm text-muted-foreground normal-case font-sans mt-2 mb-8">
        These help us find even better matches for you
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
      {!hasRequiredQuestions && (
        <button
          onClick={handleSkip}
          className="w-full sm:w-auto bg-card text-muted-foreground ooo-border px-8 py-3 shadow-card hover-lift font-label"
        >
          Skip for now
        </button>
      )}
      <button
        onClick={() => {
          if (validateRequiredQuestions()) onNext();
        }}
        disabled={nextDisabled}
        className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 shadow-card hover-lift font-label disabled:opacity-50"
      >
        {nextLabel}
      </button>
    </div>
  );

  const renderQuestionBlock = (block: QuestionBlock) => {
    const details = asRecord(roleDetails[block.storageKey]);

    if (block.type === "Founder") {
      const companyStage = asString(details.companyStage);
      const lookingForInvestors = asString(details.lookingForInvestors);
      const lookingToHire = asString(details.lookingToHire);
      const fundraisingTimeline = asString(details.fundraisingTimeline);
      const isRaisingCapital = selectedGoals.has("Raise Capital");
      return (
        <div className="space-y-8">
          <div>
            <label className={sectionLabel}>Company stage</label>
            <PillSelect
              options={COMPANY_STAGE_OPTIONS}
              selected={companyStage ? [companyStage] : []}
              singleSelect
              onChange={(next) => setDetail(block.storageKey, "companyStage", next[0] ?? "")}
            />
          </div>
          {isRaisingCapital ? (
            <div>
              <label className={sectionLabel}>
                What best describes your fundraising timeline? <span className="text-destructive">*</span>
              </label>
              <PillSelect
                options={FUNDRAISING_TIMELINE_OPTIONS}
                selected={fundraisingTimeline ? [fundraisingTimeline] : []}
                singleSelect
                onChange={(next) => {
                  setRequiredErrors((prev) => {
                    const nextErrors = { ...prev };
                    delete nextErrors[`${block.storageKey}.fundraisingTimeline`];
                    return nextErrors;
                  });
                  setDetail(block.storageKey, "fundraisingTimeline", next[0] ?? "");
                }}
              />
              {requiredErrors[`${block.storageKey}.fundraisingTimeline`] && (
                <p className={messageText}>{requiredErrors[`${block.storageKey}.fundraisingTimeline`]}</p>
              )}
            </div>
          ) : (
            <div>
              <label className={sectionLabel}>Looking for investors?</label>
              <PillSelect
                options={YES_NO_OPTIONS}
                selected={lookingForInvestors ? [lookingForInvestors] : []}
                singleSelect
                onChange={(next) => setDetail(block.storageKey, "lookingForInvestors", next[0] ?? "")}
              />
            </div>
          )}
          <div>
            <label className={sectionLabel}>Looking to hire?</label>
            <PillSelect
              options={YES_NO_OPTIONS}
              selected={lookingToHire ? [lookingToHire] : []}
              singleSelect
              onChange={(next) => setDetail(block.storageKey, "lookingToHire", next[0] ?? "")}
            />
          </div>
        </div>
      );
    }

    if (block.type === "Investor") {
      const checkSize = asString(details.checkSize);
      const investmentFocusAreas = asStringArray(details.investmentFocusAreas);
      return (
        <div className="space-y-8">
          <div>
            <label className={sectionLabel}>Typical check size</label>
            <PillSelect
              options={CHECK_SIZE_OPTIONS}
              selected={checkSize ? [checkSize] : []}
              singleSelect
              onChange={(next) => setDetail(block.storageKey, "checkSize", next[0] ?? "")}
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
                setDetail(block.storageKey, "investmentFocusAreas", next);
              }}
            />
            <p className={countText}>
              {investmentFocusAreas.length} of {MULTI_MAX} selected
            </p>
            {investmentFocusMaxHit && <p className={messageText}>Maximum {MULTI_MAX} selections</p>}
          </div>
        </div>
      );
    }

    if (block.type === "Recruiter") {
      const activelyHiring = asString(details.activelyHiring);
      const hiringFunctions = asStringArray(details.hiringFunctions);
      const hiringTimeline = asString(details.hiringTimeline);
      return (
        <div className="space-y-8">
          <div>
            <label className={sectionLabel}>
              What's your hiring timeline? <span className="text-destructive">*</span>
            </label>
            <PillSelect
              options={HIRING_TIMELINE_OPTIONS}
              selected={hiringTimeline ? [hiringTimeline] : []}
              singleSelect
              onChange={(next) => {
                setRequiredErrors((prev) => {
                  const nextErrors = { ...prev };
                  delete nextErrors[`${block.storageKey}.hiringTimeline`];
                  return nextErrors;
                });
                setDetail(block.storageKey, "hiringTimeline", next[0] ?? "");
              }}
            />
            {requiredErrors[`${block.storageKey}.hiringTimeline`] && (
              <p className={messageText}>{requiredErrors[`${block.storageKey}.hiringTimeline`]}</p>
            )}
          </div>
          <div>
            <label className={sectionLabel}>Actively hiring?</label>
            <PillSelect
              options={YES_NO_OPTIONS}
              selected={activelyHiring ? [activelyHiring] : []}
              singleSelect
              onChange={(next) => setDetail(block.storageKey, "activelyHiring", next[0] ?? "")}
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
                setDetail(block.storageKey, "hiringFunctions", next);
              }}
            />
            <p className={countText}>
              {hiringFunctions.length} of {MULTI_MAX} selected
            </p>
            {hiringFunctionsMaxHit && <p className={messageText}>Maximum {MULTI_MAX} selections</p>}
          </div>
        </div>
      );
    }

    if (block.type === "CareerSeeker") {
      const searchStatus = asString(details.searchStatus);
      return (
        <div>
          <label className={sectionLabel}>
            Are you actively exploring a new role? <span className="text-destructive">*</span>
          </label>
          <PillSelect
            options={CAREER_SEARCH_STATUS_OPTIONS}
            selected={searchStatus ? [searchStatus] : []}
            singleSelect
            onChange={(next) => {
              setRequiredErrors((prev) => {
                const nextErrors = { ...prev };
                delete nextErrors[`${block.storageKey}.searchStatus`];
                return nextErrors;
              });
              setDetail(block.storageKey, "searchStatus", next[0] ?? "");
            }}
          />
          {requiredErrors[`${block.storageKey}.searchStatus`] && (
            <p className={messageText}>{requiredErrors[`${block.storageKey}.searchStatus`]}</p>
          )}
        </div>
      );
    }

    const openToBrandPartnerships = asString(details.openToBrandPartnerships);
    const contentCategories = asStringArray(details.contentCategories);
    return (
      <div className="space-y-8">
        <div>
          <label className={sectionLabel}>Open to brand partnerships?</label>
          <PillSelect
            options={YES_NO_OPTIONS}
            selected={openToBrandPartnerships ? [openToBrandPartnerships] : []}
            singleSelect
            onChange={(next) => setDetail(block.storageKey, "openToBrandPartnerships", next[0] ?? "")}
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
              setDetail(block.storageKey, "contentCategories", next);
            }}
          />
          <p className={countText}>
            {contentCategories.length} of {MULTI_MAX} selected
          </p>
          {contentCategoriesMaxHit && <p className={messageText}>Maximum {MULTI_MAX} selections</p>}
        </div>
      </div>
    );
  };

  return (
    <div>
      {header}
      {questionBlocks.length > 0 ? (
        <div className="space-y-10">
          {questionBlocks.map((block) => (
            <section key={block.storageKey} className="space-y-6 border-b border-border pb-10 last:border-b-0 last:pb-0">
              <h2 className="text-xl font-black">{block.label}</h2>
              {renderQuestionBlock(block)}
            </section>
          ))}
        </div>
      ) : (
        <div className="ooo-card bg-warm p-6 text-center">
          <p className="normal-case font-sans text-sm leading-6">
            You're all set on this step. Complete your profile after setup to unlock even better matches.
          </p>
        </div>
      )}
      {navButtons}
    </div>
  );
}
