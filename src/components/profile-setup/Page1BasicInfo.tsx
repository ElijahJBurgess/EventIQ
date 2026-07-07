import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileSetupPageProps } from "./types";

const ROLE_TYPES = [
  "Founder",
  "Investor",
  "Recruiter",
  "Hiring Manager",
  "Creator",
  "Professional",
  "Brand Partner",
  "Community Builder",
  "Student",
  "Other",
];

const LINKEDIN_PATTERN = /^(https?:\/\/)?(www\.)?linkedin\.com/i;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type StringField = "fullName" | "jobTitle" | "company" | "location" | "linkedinUrl" | "roleType";

interface FieldErrors {
  fullName?: string;
  roleType?: string;
  linkedinUrl?: string;
}

export default function Page1BasicInfo({ formData, setFormData, onNext }: ProfileSetupPageProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputClass = "w-full ooo-border bg-card px-4 py-3 normal-case font-sans";
  const labelClass = "text-sm font-bold mb-1.5 block";
  const errorClass = "text-xs text-destructive mt-1.5 normal-case font-sans";

  const update = (field: StringField) => (value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    const next: FieldErrors = {};
    const trimmedName = formData.fullName.trim();

    if (!trimmedName) {
      next.fullName = "Full name is required";
    } else if (trimmedName.length < 2) {
      next.fullName = "Full name must be at least 2 characters";
    }

    if (!formData.roleType) {
      next.roleType = "Please select a role type";
    }

    if (formData.linkedinUrl.trim() && !LINKEDIN_PATTERN.test(formData.linkedinUrl.trim())) {
      next.linkedinUrl = "Enter a valid LinkedIn URL (e.g. linkedin.com/in/yourname)";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleContinue = () => {
    if (validate()) onNext();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPhotoError("");

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Please upload a JPG, PNG, or WEBP file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Image must be 5MB or smaller.");
      return;
    }

    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("profile-photos")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (error) {
      setPhotoError("Upload failed. Please try another image.");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("profile-photos").getPublicUrl(filePath);
    setFormData((prev) => ({ ...prev, avatarUrl: data.publicUrl }));
    setUploading(false);
  };

  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-black">Tell us about yourself</h1>
      <p className="text-sm text-muted-foreground normal-case font-sans mt-2 mb-8">
        This helps us create your profile and find the right matches for you
      </p>

      <div className="space-y-5">
        <div>
          <label className={labelClass}>
            Full name <span className="text-destructive">*</span>
          </label>
          <input
            className={inputClass}
            placeholder="Your full name"
            maxLength={100}
            value={formData.fullName}
            onChange={(e) => update("fullName")(e.target.value)}
          />
          {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
        </div>

        <div>
          <label className={labelClass}>
            Profile photo{" "}
            <span className="text-muted-foreground font-normal normal-case">(optional)</span>
          </label>
          <div className="flex items-center gap-4">
            {formData.avatarUrl && (
              <img
                src={formData.avatarUrl}
                alt="Profile preview"
                className="h-16 w-16 rounded-full object-cover ooo-border"
              />
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="ooo-border bg-card px-4 py-3 shadow-card hover-lift disabled:opacity-50 font-label text-xs inline-flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : formData.avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>
          {photoError && <p className={errorClass}>{photoError}</p>}
        </div>

        <div>
          <label className={labelClass}>
            Job title{" "}
            <span className="text-muted-foreground font-normal normal-case">(optional)</span>
          </label>
          <input
            className={inputClass}
            placeholder="What do you do?"
            maxLength={100}
            value={formData.jobTitle}
            onChange={(e) => update("jobTitle")(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>
            Company or organization{" "}
            <span className="text-muted-foreground font-normal normal-case">(optional)</span>
          </label>
          <input
            className={inputClass}
            placeholder="Where do you work or build?"
            maxLength={100}
            value={formData.company}
            onChange={(e) => update("company")(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>
            Location{" "}
            <span className="text-muted-foreground font-normal normal-case">(optional)</span>
          </label>
          <input
            className={inputClass}
            placeholder="City, State"
            maxLength={100}
            value={formData.location}
            onChange={(e) => update("location")(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>
            LinkedIn URL{" "}
            <span className="text-muted-foreground font-normal normal-case">(optional)</span>
          </label>
          <input
            className={inputClass}
            placeholder="linkedin.com/in/yourname"
            value={formData.linkedinUrl}
            onChange={(e) => update("linkedinUrl")(e.target.value)}
          />
          {errors.linkedinUrl && <p className={errorClass}>{errors.linkedinUrl}</p>}
        </div>

        <div>
          <label className={labelClass}>
            Role type <span className="text-destructive">*</span>
          </label>
          <select
            className={inputClass}
            value={formData.roleType}
            onChange={(e) => update("roleType")(e.target.value)}
          >
            <option value="">Select your role</option>
            {ROLE_TYPES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {errors.roleType && <p className={errorClass}>{errors.roleType}</p>}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
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
