import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressIndicator from "@/components/profile-setup/ProgressIndicator";
import Page1BasicInfo from "@/components/profile-setup/Page1BasicInfo";
import Page2MatchingPrefs from "@/components/profile-setup/Page2MatchingPrefs";
import Page3RoleQuestions from "@/components/profile-setup/Page3RoleQuestions";
import Page4Terms from "@/components/profile-setup/Page4Terms";
import Page5EventSelection from "@/components/profile-setup/Page5EventSelection";
import SuccessScreen from "@/components/profile-setup/SuccessScreen";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "@/components/profile-setup/types";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/v2/AuthProvider";

// Page 3 (Page3RoleQuestions.tsx) only has real questions for these role
// types -- everyone else sees a static "you're all set" message with no
// fields at all, so role_details can never gain a key for them.
const ROLE_TYPES_WITH_PAGE3_QUESTIONS = new Set(["Founder", "Investor", "Recruiter", "Hiring Manager", "Creator"]);

function calculateCompletionScore(formData: ProfileSetupFormData): number {
  let score = 0;

  const mandatoryFilled =
    formData.fullName.trim().length > 0 &&
    formData.roleType.trim().length > 0 &&
    formData.whoToMeet.length >= 1 &&
    formData.desiredOutcomes.length >= 1 &&
    formData.matchingGoal.trim().length > 0;
  if (mandatoryFilled) score += 50;

  const optionalPage1Filled =
    formData.avatarUrl.trim().length > 0 ||
    formData.jobTitle.trim().length > 0 ||
    formData.company.trim().length > 0 ||
    formData.location.trim().length > 0 ||
    formData.linkedinUrl.trim().length > 0;
  if (optionalPage1Filled) score += 20;

  // Role types with no Page 3 questions have nothing to fill in, so they
  // get these 20 points automatically instead of it being permanently
  // unreachable for them.
  const hasPage3Questions = ROLE_TYPES_WITH_PAGE3_QUESTIONS.has(formData.roleType);
  const roleDetailsFilled = Object.keys(formData.roleDetails).length > 0;
  if (!hasPage3Questions || roleDetailsFilled) score += 20;

  if (formData.areasOfExpertise.length >= 1) score += 10;

  return Math.min(score, 100);
}

export default function ProfileSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState<ProfileSetupFormData>(initialProfileSetupFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  const onNext = () => setCurrentPage((page) => Math.min(page + 1, 4));
  const onBack = () => setCurrentPage((page) => Math.max(page - 1, 1));

  const onSubmit = async () => {
    if (!user) return;

    setSubmitError("");
    setIsSubmitting(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.fullName,
        avatar_url: formData.avatarUrl,
        title: formData.jobTitle,
        company: formData.company,
        location: formData.location,
        linkedin_url: formData.linkedinUrl,
        role_type: formData.roleType,
        who_to_meet: formData.whoToMeet,
        desired_outcomes: formData.desiredOutcomes,
        areas_of_expertise: formData.areasOfExpertise,
        matching_goal: formData.matchingGoal,
        role_details: formData.roleDetails as Json,
        profile_completed: true,
        profile_completion_score: calculateCompletionScore(formData),
      })
      .eq("id", user.id);

    setIsSubmitting(false);

    if (error) {
      setSubmitError("Something went wrong saving your profile. Please try again.");
      return;
    }

    setCurrentPage(5);
  };

  useEffect(() => {
    if (!isComplete) return;
    const timer = setTimeout(() => navigate("/v2"), 750);
    return () => clearTimeout(timer);
  }, [isComplete, navigate]);

  return (
    <div className="min-h-screen bg-aqua flex items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-xl">
        {!isComplete && <ProgressIndicator currentPage={currentPage} totalPages={5} />}
        {isComplete ? (
          <SuccessScreen />
        ) : (
          <div className="ooo-card bg-card p-6 sm:p-8">
            {currentPage === 1 && (
              <Page1BasicInfo formData={formData} setFormData={setFormData} onNext={onNext} onBack={onBack} />
            )}
            {currentPage === 2 && (
              <Page2MatchingPrefs formData={formData} setFormData={setFormData} onNext={onNext} onBack={onBack} />
            )}
            {currentPage === 3 && (
              <Page3RoleQuestions formData={formData} setFormData={setFormData} onNext={onNext} onBack={onBack} />
            )}
            {currentPage === 4 && (
              <Page4Terms
                formData={formData}
                setFormData={setFormData}
                onNext={onNext}
                onBack={onBack}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                submitError={submitError}
              />
            )}
            {currentPage === 5 && (
              <Page5EventSelection profileId={user!.id} onContinue={() => setIsComplete(true)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
