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

const INDUSTRY_PREFERENCE_OPTIONS = [
  "Primarily show me people in my industry",
  "Primarily show me people outside my industry",
  "Show me a mix of both",
  "No preference",
];

const LOCATION_PREFERENCE_OPTIONS = {
  "Prioritize people based in my city": "prioritize_city",
  "Prioritize people outside my city": "prioritize_outside_city",
  "Show me a mix": "mix",
  "Location does not matter": "no_preference",
} as const;

const CAREER_LEVEL_OPTIONS = [
  "Student / Recent Graduate",
  "Early Career",
  "Individual Contributor",
  "Manager",
  "Senior Manager",
  "Director",
  "Senior Director",
  "Vice President",
  "C-Suite / Executive",
  "Founder / Owner",
  "Partner",
  "No Preference",
];

const CONNECTION_PREFERENCE_OPTIONS = [
  "Quick Introduction",
  "One-on-One Conversation",
  "Scheduled Meeting",
  "Group Connection",
  "Ongoing Professional Relationship",
  "Mentorship Relationship",
  "Social Connection",
  "No Preference",
];

const NO_PREFERENCE = "No Preference";

interface FieldErrors {
  whoToMeet?: string;
  industryPreference?: string;
  locationPreference?: string;
}

function normalizeNoPreference(current: string[], next: string[]): string[] {
  const hadNoPreference = current.includes(NO_PREFERENCE);
  if (!next.includes(NO_PREFERENCE)) return next;
  return hadNoPreference ? next.filter((item) => item !== NO_PREFERENCE) : [NO_PREFERENCE];
}

export default function Page3WhoAndFilters({ formData, setFormData, onNext, onBack }: ProfileSetupPageProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [whoMaxHit, setWhoMaxHit] = useState(false);
  const [careerMaxHit, setCareerMaxHit] = useState(false);

  const sectionLabel = "text-sm font-bold mb-2 block";
  const countText = "text-xs text-muted-foreground normal-case font-sans mt-2";
  const messageText = "text-xs text-destructive normal-case font-sans mt-2";

  const validate = () => {
    const next: FieldErrors = {};
    if (formData.whoToMeet.length === 0) next.whoToMeet = "Select at least 1 option";
    if (!formData.industryPreference) next.industryPreference = "Select an industry preference";
    if (!formData.locationPreference) next.locationPreference = "Select a location preference";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-black">Who should we introduce you to?</h1>
      <p className="text-sm text-muted-foreground normal-case font-sans mt-2 mb-8">
        Set the preferences that shape your matches
      </p>

      <div className="space-y-8">
        <div>
          <label className={sectionLabel}>
            Who would you most like to meet? <span className="text-destructive">*</span>
          </label>
          <PillSelect
            options={WHO_TO_MEET_OPTIONS}
            selected={formData.whoToMeet}
            onChange={(whoToMeet) => {
              setWhoMaxHit(false);
              setFormData((prev) => ({ ...prev, whoToMeet }));
            }}
            max={5}
            onMaxAttempt={() => setWhoMaxHit(true)}
          />
          <p className={countText}>{formData.whoToMeet.length} of 5 selected</p>
          {whoMaxHit && <p className={messageText}>Maximum 5 selections</p>}
          {errors.whoToMeet && <p className={messageText}>{errors.whoToMeet}</p>}
        </div>

        <div>
          <label className={sectionLabel}>
            How should industry influence your matches? <span className="text-destructive">*</span>
          </label>
          <PillSelect
            options={INDUSTRY_PREFERENCE_OPTIONS}
            selected={formData.industryPreference ? [formData.industryPreference] : []}
            singleSelect
            onChange={(next) => setFormData((prev) => ({ ...prev, industryPreference: next[0] ?? "" }))}
          />
          {errors.industryPreference && <p className={messageText}>{errors.industryPreference}</p>}
        </div>

        <div>
          <label className={sectionLabel}>
            How should location influence your matches? <span className="text-destructive">*</span>
          </label>
          <PillSelect
            options={Object.keys(LOCATION_PREFERENCE_OPTIONS)}
            selected={
              Object.entries(LOCATION_PREFERENCE_OPTIONS)
                .filter(([, value]) => value === formData.locationPreference)
                .map(([label]) => label)
            }
            singleSelect
            onChange={(next) =>
              setFormData((prev) => ({
                ...prev,
                locationPreference: next[0]
                  ? LOCATION_PREFERENCE_OPTIONS[next[0] as keyof typeof LOCATION_PREFERENCE_OPTIONS]
                  : "",
              }))
            }
          />
          {errors.locationPreference && <p className={messageText}>{errors.locationPreference}</p>}
        </div>

        <div>
          <label className={sectionLabel}>
            Are there career levels you would like us to prioritize?{" "}
            <span className="text-muted-foreground font-normal normal-case">(optional, choose up to 3)</span>
          </label>
          <PillSelect
            options={CAREER_LEVEL_OPTIONS}
            selected={formData.careerLevelPreference}
            onChange={(next) => {
              const careerLevelPreference = normalizeNoPreference(formData.careerLevelPreference, next);
              if (careerLevelPreference.length > 3) {
                setCareerMaxHit(true);
                return;
              }

              setCareerMaxHit(false);
              setFormData((prev) => ({
                ...prev,
                careerLevelPreference,
              }));
            }}
          />
          <p className={countText}>{formData.careerLevelPreference.length} of 3 selected</p>
          {careerMaxHit && <p className={messageText}>Maximum 3 selections</p>}
        </div>

        <div>
          <label className={sectionLabel}>
            How would you prefer to connect?{" "}
            <span className="text-muted-foreground font-normal normal-case">(optional)</span>
          </label>
          <PillSelect
            options={CONNECTION_PREFERENCE_OPTIONS}
            selected={formData.connectionPreference}
            onChange={(next) =>
              setFormData((prev) => ({
                ...prev,
                connectionPreference: normalizeNoPreference(prev.connectionPreference, next),
              }))
            }
          />
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
