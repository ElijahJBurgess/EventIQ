import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressIndicator from "@/components/profile-setup/ProgressIndicator";
import Page1BasicInfo from "@/components/profile-setup/Page1BasicInfo";
import Page2Goals from "@/components/profile-setup/Page2Goals";
import Page3WhoAndFilters from "@/components/profile-setup/Page3WhoAndFilters";
import Page3RoleQuestions from "@/components/profile-setup/Page3RoleQuestions";
import Page4Terms from "@/components/profile-setup/Page4Terms";
import Page5EventSelection from "@/components/profile-setup/Page5EventSelection";
import SuccessScreen from "@/components/profile-setup/SuccessScreen";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "@/components/profile-setup/types";
import { buildProfileUpdatePayload } from "@/components/profile-setup/profileUpdate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/v2/AuthProvider";

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
        ...buildProfileUpdatePayload(formData),
        profile_completed: true,
      })
      .eq("id", user.id);

    setIsSubmitting(false);

    if (error) {
      setSubmitError("Something went wrong saving your profile. Please try again.");
      return;
    }

    setCurrentPage(6);
  };

  useEffect(() => {
    if (!isComplete) return;
    const timer = setTimeout(() => navigate("/v2"), 750);
    return () => clearTimeout(timer);
  }, [isComplete, navigate]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-black px-6 sm:px-8 py-4">
        <div className="font-display text-xl tracking-tight normal-case">OFFRIP</div>
      </header>
      <div className="w-full max-w-xl mx-auto px-6 py-10">
        {!isComplete && currentPage <= 5 && <ProgressIndicator currentPage={currentPage} totalPages={5} />}
        {isComplete ? (
          <SuccessScreen />
        ) : (
          <div className="bg-white">
            {currentPage === 1 && (
              <Page1BasicInfo userId={user!.id} formData={formData} setFormData={setFormData} onNext={onNext} onBack={onBack} />
            )}
            {currentPage === 2 && (
              <Page2Goals formData={formData} setFormData={setFormData} onNext={onNext} onBack={onBack} />
            )}
            {currentPage === 3 && (
              <Page3WhoAndFilters formData={formData} setFormData={setFormData} onNext={onNext} onBack={onBack} />
            )}
            {currentPage === 4 && (
              <Page3RoleQuestions
                formData={formData}
                setFormData={setFormData}
                onNext={() => setCurrentPage(5)}
                onBack={onBack}
              />
            )}
            {currentPage === 5 && (
              <Page4Terms
                formData={formData}
                setFormData={setFormData}
                onNext={onNext}
                onBack={() => setCurrentPage(4)}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                submitError={submitError}
              />
            )}
            {currentPage === 6 && (
              <Page5EventSelection profileId={user!.id} onContinue={() => setIsComplete(true)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
