import { useState } from "react";
import PillSelect from "./PillSelect";
import type { ProfileSetupPageProps } from "./types";

const GOAL_OPTIONS = [
  "Find Customers or Clients",
  "Build Business Partnerships",
  "Meet Investors",
  "Raise Capital",
  "Explore Investment Opportunities",
  "Hire Talent",
  "Explore Career Opportunities",
  "Find Brand Partners",
  "Find Sponsorship Opportunities",
  "Meet Collaborators",
  "Take On New Clients",
  "Find a Mentor",
  "Mentor Others",
  "Build Industry Relationships",
  "Build Community",
  "Find Advisory Opportunities",
  "Find Board Opportunities",
  "Find Speaking Opportunities",
  "Find Media / Press Opportunities",
  "Collaborate on Products",
  "Collaborate on Content",
  "Meet People in My City",
  "Meet People in a New City",
  "Make Social Connections",
  "Learn From Experts",
  "Gain Visibility",
  "Explore Opportunities Generally",
  "Meet Great People Without a Specific Ask",
  "I'm Not Currently Looking for New Opportunities",
];

const NEED_OPTIONS = [
  "Finding Customers",
  "Raising Capital",
  "Hiring Talent",
  "Finding a New Role",
  "Career Growth",
  "Building Partnerships",
  "Finding Brand Partners",
  "Brand Strategy",
  "Marketing",
  "Sales / Business Development",
  "Product Development",
  "Technology / Engineering",
  "Operations",
  "Recruiting",
  "Fundraising Strategy",
  "Investor Introductions",
  "Customer Introductions",
  "Partnership Introductions",
  "Job Referrals",
  "Talent Referrals",
  "Brand Opportunities",
  "Sponsorship Opportunities",
  "Media / Press Opportunities",
  "Speaking Opportunities",
  "Mentorship",
  "Strategic Advice",
  "Product Feedback",
  "Community Building",
  "Content Creation",
  "Social Media",
  "Creative Direction",
  "Design",
  "Data / Analytics",
  "Financial Strategy",
  "Legal / Compliance Guidance",
  "Event / Experience Strategy",
  "Entering a New Industry",
  "Entering a New Market",
  "Meeting People Locally",
  "Local City Knowledge",
  "Accountability / Peer Support",
  "Social Connection / Friendship",
];

const OFFER_OPTIONS = [
  "Career Advice",
  "Hiring Opportunities",
  "Talent Referrals",
  "Job Referrals",
  "Industry Knowledge",
  "Founder Advice",
  "Fundraising Advice",
  "Investment Capital",
  "Investor Introductions",
  "Customer Introductions",
  "Partnership Introductions",
  "Brand Opportunities",
  "Sponsorship Opportunities",
  "Media / Press Opportunities",
  "Speaking Opportunities",
  "Mentorship",
  "Strategic Advice",
  "Product Feedback",
  "Technical Expertise",
  "Marketing Expertise",
  "Brand Expertise",
  "Business Development Expertise",
  "Sales Expertise",
  "Product Expertise",
  "Operations Expertise",
  "Community Building",
  "Community Connections",
  "Content Creation",
  "Social Media Expertise",
  "Creative Direction",
  "Design Expertise",
  "Engineering Expertise",
  "Data / Analytics Expertise",
  "Financial Strategy",
  "Legal / Compliance Guidance",
  "Event / Experience Strategy",
  "Local City Knowledge",
  "Accountability / Peer Support",
  "Social Connection / Friendship",
];

const NO_OPPORTUNITIES_GOAL = "I'm Not Currently Looking for New Opportunities";

interface FieldErrors {
  goals?: string;
  needs?: string;
  offers?: string;
}

export default function Page2Goals({ formData, setFormData, onNext, onBack }: ProfileSetupPageProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [goalMaxHit, setGoalMaxHit] = useState(false);
  const [needsMaxHit, setNeedsMaxHit] = useState(false);
  const [offersMaxHit, setOffersMaxHit] = useState(false);

  const selectedGoals = [formData.primaryGoal, ...formData.secondaryGoals].filter(Boolean);
  const sectionLabel = "text-sm font-bold mb-2 block";
  const countText = "text-xs text-muted-foreground normal-case font-sans mt-2";
  const messageText = "text-xs text-destructive normal-case font-sans mt-2";

  const setGoals = (goals: string[]) => {
    const hadExclusiveGoal = selectedGoals.includes(NO_OPPORTUNITIES_GOAL);
    const normalizedGoals = goals.includes(NO_OPPORTUNITIES_GOAL)
      ? hadExclusiveGoal
        ? goals.filter((goal) => goal !== NO_OPPORTUNITIES_GOAL)
        : [NO_OPPORTUNITIES_GOAL]
      : goals;

    if (normalizedGoals.length > 3) {
      setGoalMaxHit(true);
      return;
    }

    setGoalMaxHit(false);

    setFormData((prev) => {
      const primaryGoal = normalizedGoals.includes(prev.primaryGoal)
        ? prev.primaryGoal
        : normalizedGoals[0] ?? "";
      return {
        ...prev,
        primaryGoal,
        secondaryGoals: normalizedGoals.filter((goal) => goal !== primaryGoal),
      };
    });
  };

  const setPrimaryGoal = (primaryGoal: string) => {
    setFormData((prev) => {
      const goals = [prev.primaryGoal, ...prev.secondaryGoals].filter(Boolean);
      return {
        ...prev,
        primaryGoal,
        secondaryGoals: goals.filter((goal) => goal !== primaryGoal),
      };
    });
  };

  const validate = () => {
    const next: FieldErrors = {};
    if (!formData.primaryGoal) next.goals = "Select at least 1 goal";
    if (formData.needs.length === 0) next.needs = "Select at least 1 way someone can help";
    if (formData.offers.length === 0) next.offers = "Select at least 1 thing you can offer";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-black">What are you looking to make happen?</h1>
      <p className="text-sm text-muted-foreground normal-case font-sans mt-2 mb-8">
        Tell us what you need and what you bring to the room
      </p>

      <div className="space-y-8">
        <div>
          <label className={sectionLabel}>
            What are you hoping to make happen right now? <span className="text-destructive">*</span>{" "}
            <span className="text-muted-foreground font-normal normal-case">(choose up to 3)</span>
          </label>
          <PillSelect
            options={GOAL_OPTIONS}
            selected={selectedGoals}
            onChange={setGoals}
          />
          {selectedGoals.length > 0 && (
            <div className="mt-3 space-y-2 ooo-border bg-warm p-3">
              <p className="text-xs font-bold normal-case font-sans">Choose your primary goal:</p>
              {selectedGoals.map((goal) => (
                <label key={goal} className="flex items-center gap-2 text-sm normal-case font-sans">
                  <input
                    type="radio"
                    name="primary-goal"
                    checked={formData.primaryGoal === goal}
                    onChange={() => setPrimaryGoal(goal)}
                    className="h-4 w-4 accent-primary"
                  />
                  {goal}
                </label>
              ))}
            </div>
          )}
          <p className={countText}>{selectedGoals.length} of 3 selected</p>
          {goalMaxHit && <p className={messageText}>Maximum 3 selections</p>}
          {errors.goals && <p className={messageText}>{errors.goals}</p>}
        </div>

        <div>
          <label className={sectionLabel}>
            Where could the right person be most helpful to you? <span className="text-destructive">*</span>
          </label>
          <PillSelect
            options={NEED_OPTIONS}
            selected={formData.needs}
            onChange={(needs) => {
              setNeedsMaxHit(false);
              setFormData((prev) => ({ ...prev, needs }));
            }}
            max={5}
            onMaxAttempt={() => setNeedsMaxHit(true)}
          />
          <p className={countText}>{formData.needs.length} of 5 selected</p>
          {needsMaxHit && <p className={messageText}>Maximum 5 selections</p>}
          {errors.needs && <p className={messageText}>{errors.needs}</p>}
        </div>

        <div>
          <label className={sectionLabel}>
            What can you offer the people you meet? <span className="text-destructive">*</span>
          </label>
          <PillSelect
            options={OFFER_OPTIONS}
            selected={formData.offers}
            onChange={(offers) => {
              setOffersMaxHit(false);
              setFormData((prev) => ({ ...prev, offers }));
            }}
            max={5}
            onMaxAttempt={() => setOffersMaxHit(true)}
          />
          <p className={countText}>{formData.offers.length} of 5 selected</p>
          {offersMaxHit && <p className={messageText}>Maximum 5 selections</p>}
          {errors.offers && <p className={messageText}>{errors.offers}</p>}
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <button onClick={onBack} className="w-full sm:w-auto bg-card text-foreground ooo-border px-8 py-3 shadow-card hover-lift font-label">
          Back
        </button>
        <button
          onClick={() => {
            if (validate()) onNext();
          }}
          className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 shadow-card hover-lift font-label"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
