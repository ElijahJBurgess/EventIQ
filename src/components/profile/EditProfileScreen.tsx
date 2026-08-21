import { useEffect, useState } from "react";
import Page1BasicInfo from "@/components/profile-setup/Page1BasicInfo";
import Page2Goals from "@/components/profile-setup/Page2Goals";
import Page3WhoAndFilters from "@/components/profile-setup/Page3WhoAndFilters";
import Page3RoleQuestions from "@/components/profile-setup/Page3RoleQuestions";
import ProgressIndicator from "@/components/profile-setup/ProgressIndicator";
import { cleanRoleDetailsForIdentities } from "@/components/profile-setup/roleDetailsUtils";
import { initialProfileSetupFormData, type ProfileSetupFormData } from "@/components/profile-setup/types";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getOwnedProfilePhotoPath, PROFILE_PHOTO_BUCKET } from "@/lib/profilePhotoStorage";

interface EditProfileScreenProps {
  userId: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRoleDetails(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default function EditProfileScreen({ userId, onClose, onSaved }: EditProfileScreenProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState<ProfileSetupFormData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [persistedAvatarUrl, setPersistedAvatarUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,avatar_url,title,company,location,linkedin_url,role_type,secondary_role_types,primary_function,additional_functions,seniority,primary_goal,matching_goal,secondary_goals,needs,offers,areas_of_expertise,who_to_meet,industry_preference,location_preference,career_level_preference,connection_preference,role_details")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setLoadError(true);
        return;
      }

      setFormData({
        ...initialProfileSetupFormData,
        fullName: data.full_name ?? "",
        avatarUrl: data.avatar_url ?? "",
        jobTitle: data.title ?? "",
        company: data.company ?? "",
        location: data.location ?? "",
        linkedinUrl: data.linkedin_url ?? "",
        roleType: data.role_type ?? "",
        secondaryRoleTypes: asStringArray(data.secondary_role_types),
        primaryFunction: data.primary_function ?? "",
        additionalFunctions: asStringArray(data.additional_functions),
        seniority: data.seniority ?? "",
        primaryGoal: data.primary_goal ?? data.matching_goal ?? "",
        secondaryGoals: asStringArray(data.secondary_goals),
        needs: asStringArray(data.needs),
        offers:
          asStringArray(data.offers).length > 0
            ? asStringArray(data.offers)
            : asStringArray(data.areas_of_expertise),
        whoToMeet: asStringArray(data.who_to_meet),
        industryPreference: data.industry_preference ?? "",
        locationPreference: data.location_preference ?? "",
        careerLevelPreference: asStringArray(data.career_level_preference),
        connectionPreference: asStringArray(data.connection_preference),
        roleDetails: asRoleDetails(data.role_details),
      });
      setPersistedAvatarUrl(data.avatar_url ?? "");
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveChanges = async () => {
    if (!formData || isSaving) return;

    setSaveError("");
    setIsSaving(true);
    const cleanedRoleDetails = cleanRoleDetailsForIdentities(
      formData.roleDetails,
      formData.roleType,
      formData.secondaryRoleTypes,
      formData.primaryGoal,
      formData.secondaryGoals,
    );
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
        secondary_role_types: formData.secondaryRoleTypes,
        primary_function: formData.primaryFunction,
        additional_functions: formData.additionalFunctions,
        seniority: formData.seniority,
        primary_goal: formData.primaryGoal,
        secondary_goals: formData.secondaryGoals,
        needs: formData.needs,
        offers: formData.offers,
        areas_of_expertise: formData.offers,
        matching_goal: formData.primaryGoal,
        who_to_meet: formData.whoToMeet,
        industry_preference: formData.industryPreference,
        location_preference: formData.locationPreference,
        career_level_preference: formData.careerLevelPreference,
        connection_preference: formData.connectionPreference,
        role_details: cleanedRoleDetails as Json,
      })
      .eq("id", userId);

    setIsSaving(false);
    if (error) {
      setSaveError("Something went wrong saving your changes. Please try again.");
      return;
    }

    if (persistedAvatarUrl && persistedAvatarUrl !== formData.avatarUrl) {
      const previousOwnedPath = getOwnedProfilePhotoPath(persistedAvatarUrl, userId);
      if (previousOwnedPath) {
        const { error: cleanupError } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([previousOwnedPath]);
        if (cleanupError) console.warn("Previous profile photo cleanup failed");
      }
    }

    await onSaved();
    onClose();
  };

  if (loadError) {
    return (
      <section className="ooo-card bg-card p-6">
        <h2 className="text-xl">Edit profile</h2>
        <p className="mt-3 normal-case font-sans text-sm text-muted-foreground">
          We couldn't load your profile. Please try again.
        </p>
        <button onClick={onClose} className="mt-5 ooo-border bg-card px-5 py-3 font-label text-xs">
          Back to profile
        </button>
      </section>
    );
  }

  if (!formData) {
    return <div className="ooo-card bg-card p-6 font-label text-sm">Loading profile…</div>;
  }

  const onNext = () => setCurrentPage((page) => Math.min(page + 1, 4));
  const onBack = () => setCurrentPage((page) => Math.max(page - 1, 1));

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="mb-4 flex justify-end">
        <button onClick={onClose} className="ooo-border bg-card px-5 py-3 font-label text-xs">
          Cancel
        </button>
      </div>
      <ProgressIndicator currentPage={currentPage} totalPages={4} />
      <div className="ooo-card bg-card p-6 sm:p-8">
        {currentPage === 1 && (
          <Page1BasicInfo userId={userId} formData={formData} setFormData={setFormData} onNext={onNext} onBack={onBack} />
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
            onNext={saveChanges}
            onBack={onBack}
            nextLabel={isSaving ? "Saving…" : "Save Changes"}
            nextDisabled={isSaving}
          />
        )}
        {saveError && <p className="mt-4 text-sm normal-case font-sans text-destructive">{saveError}</p>}
      </div>
    </div>
  );
}
