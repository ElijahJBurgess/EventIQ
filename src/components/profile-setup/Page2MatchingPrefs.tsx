import { useState } from "react";
import PillSelect from "./PillSelect";
import type { ProfileSetupPageProps } from "./types";

const WHO_TO_MEET_OPTIONS = [
  "Founders",
  "Investors",
  "Recruiters",
  "Hiring Managers",
  "Professionals",
  "Creators",
  "Brand Partners",
  "Speakers",
  "Press / Media",
  "Service Providers",
  "Community Builders",
  "Students",
];

const OUTCOME_OPTIONS = [
  "Career Opportunities",
  "Clients / Customers",
  "Partnerships",
  "Investors / Funding",
  "Brand Deals",
  "Hiring Talent",
  "Mentorship",
  "Collaboration Opportunities",
  "Speaking Opportunities",
  "Product Feedback",
  "Business Development",
  "Friendship & Community",
];

const EXPERTISE_OPTIONS = [
  "Business Development",
  "Marketing",
  "Brand Strategy",
  "Partnerships",
  "Sales",
  "Product",
  "Operations",
  "Community Building",
  "Content Creation",
  "Social Media",
  "Design",
  "Engineering",
  "Finance",
  "Fundraising",
  "Recruiting",
  "Venture Capital",
  "People Operations",
  "Customer Success",
  "Strategy",
];

const GOAL_OPTIONS = [
  "Meet Investors",
  "Meet Customers",
  "Find Talent",
  "Build Community",
  "Meet Collaborators",
  "Meet Mentors",
  "General Networking",
  "Learn From Industry Leaders",
  "Explore New Opportunities",
  "Build Friendships",
];

const WHO_TO_MEET_MAX = 5;
const OUTCOME_MAX = 3;
const EXPERTISE_MAX = 5;

interface FieldErrors {
  whoToMeet?: string;
  desiredOutcomes?: string;
  matchingGoal?: string;
}

export default function Page2MatchingPrefs({ formData, setFormData, onNext, onBack }: ProfileSetupPageProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [whoToMeetMaxHit, setWhoToMeetMaxHit] = useState(false);
  const [outcomesMaxHit, setOutcomesMaxHit] = useState(false);
  const [expertiseMaxHit, setExpertiseMaxHit] = useState(false);

  const sectionLabel = "text-sm font-bold mb-2 block";
  const countText = "text-xs text-muted-foreground normal-case font-sans mt-2";
  const messageText = "text-xs text-destructive normal-case font-sans mt-2";

  const validate = () => {
    const next: FieldErrors = {};
    if (formData.whoToMeet.length === 0) next.whoToMeet = "Select at least 1 option";
    if (formData.desiredOutcomes.length === 0) next.desiredOutcomes = "Select at least 1 option";
    if (!formData.matchingGoal) next.matchingGoal = "Select your primary goal";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleContinue = () => {
    if (validate()) onNext();
  };

  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-black">How can we find your best matches?</h1>
      <p className="text-sm text-muted-foreground normal-case font-sans mt-2 mb-8">
        These answers power your AI match recommendations
      </p>

      <div className="space-y-8">
        <div>
          <label className={sectionLabel}>
            Who do you want to meet? <span className="text-destructive">*</span>
          </label>
          <PillSelect
            options={WHO_TO_MEET_OPTIONS}
            selected={formData.whoToMeet}
            max={WHO_TO_MEET_MAX}
            onMaxAttempt={() => setWhoToMeetMaxHit(true)}
            onChange={(next) => {
              setWhoToMeetMaxHit(false);
              setFormData((prev) => ({ ...prev, whoToMeet: next }));
            }}
          />
          <p className={countText}>
            {formData.whoToMeet.length} of {WHO_TO_MEET_MAX} selected
          </p>
          {whoToMeetMaxHit && <p className={messageText}>Maximum {WHO_TO_MEET_MAX} selections</p>}
          {errors.whoToMeet && <p className={messageText}>{errors.whoToMeet}</p>}
        </div>

        <div>
          <label className={sectionLabel}>
            What outcome are you looking for? <span className="text-destructive">*</span>
          </label>
          <PillSelect
            options={OUTCOME_OPTIONS}
            selected={formData.desiredOutcomes}
            max={OUTCOME_MAX}
            onMaxAttempt={() => setOutcomesMaxHit(true)}
            onChange={(next) => {
              setOutcomesMaxHit(false);
              setFormData((prev) => ({ ...prev, desiredOutcomes: next }));
            }}
          />
          <p className={countText}>
            {formData.desiredOutcomes.length} of {OUTCOME_MAX} selected
          </p>
          {outcomesMaxHit && <p className={messageText}>Maximum {OUTCOME_MAX} selections</p>}
          {errors.desiredOutcomes && <p className={messageText}>{errors.desiredOutcomes}</p>}
        </div>

        <div>
          <label className={sectionLabel}>Areas of expertise (optional)</label>
          <PillSelect
            options={EXPERTISE_OPTIONS}
            selected={formData.areasOfExpertise}
            max={EXPERTISE_MAX}
            onMaxAttempt={() => setExpertiseMaxHit(true)}
            onChange={(next) => {
              setExpertiseMaxHit(false);
              setFormData((prev) => ({ ...prev, areasOfExpertise: next }));
            }}
          />
          <p className={countText}>
            {formData.areasOfExpertise.length} of {EXPERTISE_MAX} selected
          </p>
          {expertiseMaxHit && <p className={messageText}>Maximum {EXPERTISE_MAX} selections</p>}
        </div>

        <div>
          <label className={sectionLabel}>
            Primary goal for this event <span className="text-destructive">*</span>
          </label>
          <PillSelect
            options={GOAL_OPTIONS}
            selected={formData.matchingGoal ? [formData.matchingGoal] : []}
            singleSelect
            onChange={(next) => setFormData((prev) => ({ ...prev, matchingGoal: next[0] ?? "" }))}
          />
          {errors.matchingGoal && <p className={messageText}>{errors.matchingGoal}</p>}
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <button
          onClick={onBack}
          className="w-full sm:w-auto bg-card text-foreground ooo-border px-8 py-3 shadow-card hover-lift font-label"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 shadow-card hover-lift font-label"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
