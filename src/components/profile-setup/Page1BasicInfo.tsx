import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createProfilePhotoPath,
  isAllowedProfilePhotoType,
  MAX_PROFILE_PHOTO_BYTES,
  PROFILE_PHOTO_BUCKET,
} from "@/lib/profilePhotoStorage";
import PillSelect from "./PillSelect";
import type { ProfileSetupPageProps } from "./types";

const ROLE_TYPES = [
  "Founder / Co-founder",
  "Investor",
  "Recruiter",
  "Hiring Manager",
  "Corporate Professional",
  "Entrepreneur / Small Business Owner",
  "Creator / Influencer",
  "Consultant / Service Provider",
  "Brand / Partnership Leader",
  "Community Builder",
  "Nonprofit Leader",
  "Executive",
  "Student / Recent Graduate",
  "Press / Media",
  "Speaker / Thought Leader",
  "Other",
];

const FUNCTION_TYPES = [
  "Executive Leadership",
  "Business Development",
  "Partnerships",
  "Marketing",
  "Brand",
  "Communications / Public Relations",
  "Sales",
  "Product",
  "Engineering",
  "Design / Creative",
  "Data / Analytics",
  "Operations",
  "Strategy",
  "Finance",
  "Investing / Venture Capital",
  "Human Resources / People",
  "Recruiting / Talent Acquisition",
  "Customer Success",
  "Legal / Compliance",
  "Community",
  "Events / Experiences",
  "Content / Media",
  "Consulting / Professional Services",
  "Other",
];

const SENIORITY_OPTIONS = [
  "Student",
  "Recent Graduate",
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
  "Independent / Self-employed",
];

const LINKEDIN_PATTERN = /^(https?:\/\/)?(www\.)?linkedin\.com/i;
type StringField = "fullName" | "jobTitle" | "company" | "location" | "linkedinUrl" | "roleType";

interface FieldErrors {
  fullName?: string;
  roleType?: string;
  primaryFunction?: string;
  seniority?: string;
  location?: string;
  linkedinUrl?: string;
}

interface CitySearchResult {
  id: number;
  city: string;
  state_code: string;
  display_name: string;
}

export default function Page1BasicInfo({
  formData,
  setFormData,
  onNext,
  userId,
}: ProfileSetupPageProps & { userId: string }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [identityLimitReached, setIdentityLimitReached] = useState(false);
  const [functionLimitReached, setFunctionLimitReached] = useState(false);
  const [locationQuery, setLocationQuery] = useState(formData.location);
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [showCityResults, setShowCityResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationSearchRef = useRef<HTMLDivElement>(null);
  const initializedExistingLocationRef = useRef(false);

  const inputClass = "w-full border border-black/20 bg-white px-4 py-3 text-sm normal-case font-offrip-body outline-none focus:border-black transition-colors";
  const labelClass = "text-[10px] tracking-widest font-display text-black/40 mb-1 block";
  const errorClass = "text-xs text-destructive mt-1.5 normal-case font-sans";

  const update = (field: StringField) => (value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (initializedExistingLocationRef.current) return;
    initializedExistingLocationRef.current = true;
    if (!formData.location || formData.locationSelectionType) return;

    const [city = formData.location, stateCode = ""] = formData.location
      .split(",")
      .map((part) => part.trim());
    setFormData((prev) => ({
      ...prev,
      locationCity: city,
      locationStateCode: stateCode,
      locationSelectionType: "existing",
    }));
  }, [formData.location, formData.locationSelectionType, setFormData]);

  useEffect(() => {
    const closeResults = (event: MouseEvent) => {
      if (!locationSearchRef.current?.contains(event.target as Node)) {
        setShowCityResults(false);
      }
    };

    document.addEventListener("mousedown", closeResults);
    return () => document.removeEventListener("mousedown", closeResults);
  }, []);

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 2 || formData.locationSelectionType) {
      setCityResults([]);
      setIsSearchingCities(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchingCities(true);
      const { data, error } = await supabase.rpc("search_us_cities", {
        search_query: query,
        result_limit: 10,
      });

      if (cancelled) return;
      setCityResults(error ? [] : (data as CitySearchResult[]));
      setIsSearchingCities(false);
      setShowCityResults(true);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [formData.locationSelectionType, locationQuery]);

  const updateLocationQuery = (value: string) => {
    setLocationQuery(value);
    setShowCityResults(value.trim().length >= 2);
    setIsSearchingCities(value.trim().length >= 2);
    setErrors((prev) => ({ ...prev, location: undefined }));
    setFormData((prev) => ({
      ...prev,
      location: value,
      locationCity: "",
      locationStateCode: "",
      locationSelectionType: "",
    }));
  };

  const selectCity = (city: CitySearchResult) => {
    setLocationQuery(city.display_name);
    setShowCityResults(false);
    setCityResults([]);
    setFormData((prev) => ({
      ...prev,
      location: city.display_name,
      locationCity: city.city,
      locationStateCode: city.state_code,
      locationSelectionType: "database",
    }));
  };

  const useCustomLocation = () => {
    const location = locationQuery.trim();
    const [city = location, stateCode = ""] = location.split(",").map((part) => part.trim());
    setLocationQuery(location);
    setShowCityResults(false);
    setFormData((prev) => ({
      ...prev,
      location,
      locationCity: city,
      locationStateCode: stateCode,
      locationSelectionType: "custom",
    }));
  };

  const selectedIdentities = [formData.roleType, ...formData.secondaryRoleTypes].filter(Boolean);
  const selectedFunctions = [formData.primaryFunction, ...formData.additionalFunctions].filter(Boolean);

  const updateIdentities = (identities: string[]) => {
    setIdentityLimitReached(false);
    setFormData((prev) => ({
      ...prev,
      roleType: identities.includes(prev.roleType) ? prev.roleType : identities[0] ?? "",
      secondaryRoleTypes: identities.filter((identity) => identity !== (identities.includes(prev.roleType) ? prev.roleType : identities[0] ?? "")),
    }));
  };

  const setPrimaryIdentity = (identity: string) => {
    setFormData((prev) => {
      const identities = [prev.roleType, ...prev.secondaryRoleTypes].filter(Boolean);
      return {
        ...prev,
        roleType: identity,
        secondaryRoleTypes: identities.filter((item) => item !== identity),
      };
    });
  };

  const updateFunctions = (functions: string[]) => {
    setFunctionLimitReached(false);
    setFormData((prev) => {
      const primaryFunction = functions.includes(prev.primaryFunction)
        ? prev.primaryFunction
        : functions[0] ?? "";
      return {
        ...prev,
        primaryFunction,
        additionalFunctions: functions.filter((item) => item !== primaryFunction),
      };
    });
  };

  const setPrimaryFunction = (primaryFunction: string) => {
    setFormData((prev) => {
      const functions = [prev.primaryFunction, ...prev.additionalFunctions].filter(Boolean);
      return {
        ...prev,
        primaryFunction,
        additionalFunctions: functions.filter((item) => item !== primaryFunction),
      };
    });
  };

  const validate = () => {
    const next: FieldErrors = {};
    const trimmedName = formData.fullName.trim();

    if (!trimmedName) {
      next.fullName = "Full name is required";
    } else if (trimmedName.length < 2) {
      next.fullName = "Full name must be at least 2 characters";
    }

    if (!formData.roleType) {
      next.roleType = "Select at least 1 identity";
    }

    if (!formData.primaryFunction) {
      next.primaryFunction = "Select at least 1 function";
    }

    if (!formData.seniority) {
      next.seniority = "Select your current level of seniority";
    }

    if (formData.location.trim() && !formData.locationSelectionType) {
      next.location = "Select a city from the results or use the custom location option";
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

    if (!isAllowedProfilePhotoType(file.type)) {
      setPhotoError("Please upload a JPG, PNG, or WEBP file.");
      return;
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      setPhotoError("Image must be 5MB or smaller.");
      return;
    }

    setUploading(true);
    const filePath = createProfilePhotoPath(userId, file.type);
    const { error } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .upload(filePath, file, { cacheControl: "3600", contentType: file.type, upsert: false });

    if (error) {
      setPhotoError("Upload failed. Please try another image.");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(filePath);
    setFormData((prev) => ({ ...prev, avatarUrl: data.publicUrl }));
    setUploading(false);
  };

  return (
    <div>
      <h1 className="text-4xl font-black">Start with you.</h1>
      <p className="text-sm text-black/50 normal-case font-offrip-body mt-2 mb-8">
        Give the room a little context on who they're meeting.
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

        <div ref={locationSearchRef} className="relative">
          <label className={labelClass}>
            Location{" "}
            <span className="text-muted-foreground font-normal normal-case">(optional)</span>
          </label>
          <input
            className={inputClass}
            placeholder="Search for a US city"
            maxLength={100}
            value={locationQuery}
            onChange={(e) => updateLocationQuery(e.target.value)}
            onFocus={() => {
              if (locationQuery.trim().length >= 2 && !formData.locationSelectionType) {
                setShowCityResults(true);
              }
            }}
            autoComplete="off"
            role="combobox"
            aria-expanded={showCityResults}
            aria-controls="city-search-results"
          />
          {showCityResults && (
            <div
              id="city-search-results"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto ooo-border bg-card shadow-card"
            >
              {isSearchingCities ? (
                <p className="px-4 py-3 text-sm text-muted-foreground normal-case font-sans">
                  Searching cities…
                </p>
              ) : cityResults.length > 0 ? (
                cityResults.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    className="block w-full px-4 py-3 text-left text-sm normal-case font-sans hover:bg-muted"
                    onClick={() => selectCity(city)}
                  >
                    {city.display_name}
                  </button>
                ))
              ) : (
                <div className="p-3">
                  <p className="text-sm text-muted-foreground normal-case font-sans">
                    No matching US cities found.
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-sm font-bold normal-case underline"
                    onClick={useCustomLocation}
                  >
                    I don't see my city — use “{locationQuery.trim()}”
                  </button>
                </div>
              )}
            </div>
          )}
          {errors.location && <p className={errorClass}>{errors.location}</p>}
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
            Which identities best describe you? <span className="text-destructive">*</span>{" "}
            <span className="text-muted-foreground font-normal normal-case">(choose up to 3)</span>
          </label>
          <PillSelect
            options={ROLE_TYPES}
            selected={selectedIdentities}
            onChange={updateIdentities}
            max={3}
            onMaxAttempt={() => setIdentityLimitReached(true)}
          />
          {selectedIdentities.length > 0 && (
            <div className="mt-3 space-y-2 ooo-border bg-warm p-3">
              <p className="text-xs font-bold normal-case font-sans">Choose your primary identity:</p>
              {selectedIdentities.map((identity) => (
                <label key={identity} className="flex items-center gap-2 text-sm normal-case font-sans">
                  <input
                    type="radio"
                    name="primary-identity"
                    checked={formData.roleType === identity}
                    onChange={() => setPrimaryIdentity(identity)}
                    className="h-4 w-4 accent-primary"
                  />
                  {identity}
                </label>
              ))}
            </div>
          )}
          {identityLimitReached && <p className={errorClass}>Choose up to 3 identities.</p>}
          {errors.roleType && <p className={errorClass}>{errors.roleType}</p>}
        </div>

        <div>
          <label className={labelClass}>
            Which functions best describe your work? <span className="text-destructive">*</span>{" "}
            <span className="text-muted-foreground font-normal normal-case">(choose up to 3)</span>
          </label>
          <PillSelect
            options={FUNCTION_TYPES}
            selected={selectedFunctions}
            onChange={updateFunctions}
            max={3}
            onMaxAttempt={() => setFunctionLimitReached(true)}
          />
          {selectedFunctions.length > 0 && (
            <div className="mt-3 space-y-2 ooo-border bg-warm p-3">
              <p className="text-xs font-bold normal-case font-sans">Choose your primary function:</p>
              {selectedFunctions.map((workFunction) => (
                <label key={workFunction} className="flex items-center gap-2 text-sm normal-case font-sans">
                  <input
                    type="radio"
                    name="primary-function"
                    checked={formData.primaryFunction === workFunction}
                    onChange={() => setPrimaryFunction(workFunction)}
                    className="h-4 w-4 accent-primary"
                  />
                  {workFunction}
                </label>
              ))}
            </div>
          )}
          {functionLimitReached && <p className={errorClass}>Choose up to 3 functions.</p>}
          {errors.primaryFunction && <p className={errorClass}>{errors.primaryFunction}</p>}
        </div>

        <div>
          <label className={labelClass}>
            What is your current level of seniority? <span className="text-destructive">*</span>
          </label>
          <select
            className={inputClass}
            value={formData.seniority}
            onChange={(event) => setFormData((prev) => ({ ...prev, seniority: event.target.value }))}
          >
            <option value="">Select your seniority</option>
            {SENIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {errors.seniority && <p className={errorClass}>{errors.seniority}</p>}
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
