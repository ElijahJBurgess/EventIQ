import { useState } from "react";
import ProgressIndicator from "@/components/profile-setup/ProgressIndicator";
import Page1BasicInfo from "@/components/profile-setup/Page1BasicInfo";
import Page2MatchingPrefs from "@/components/profile-setup/Page2MatchingPrefs";
import Page3RoleQuestions from "@/components/profile-setup/Page3RoleQuestions";
import Page4Terms from "@/components/profile-setup/Page4Terms";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "@/components/profile-setup/types";

export default function ProfileSetup() {
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState<ProfileSetupFormData>(initialProfileSetupFormData);

  const onNext = () => setCurrentPage((page) => Math.min(page + 1, 4));
  const onBack = () => setCurrentPage((page) => Math.max(page - 1, 1));

  return (
    <div className="min-h-screen bg-aqua flex items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-xl">
        <ProgressIndicator currentPage={currentPage} />
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
            <Page4Terms formData={formData} setFormData={setFormData} onNext={onNext} onBack={onBack} />
          )}
        </div>
      </div>
    </div>
  );
}
