import type { Page4Props } from "./types";

const cardClass = "ooo-card bg-card p-6";

export default function Page4Terms({ formData, setFormData, onBack, onSubmit, isSubmitting, submitError }: Page4Props) {
  const toggleAgree = () => setFormData((prev) => ({ ...prev, agreedToTerms: !prev.agreedToTerms }));

  const canSubmit = formData.agreedToTerms && !isSubmitting;

  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-black">Almost there</h1>
      <p className="text-sm text-muted-foreground normal-case font-sans mt-2 mb-8">
        Review and agree to continue
      </p>

      <div className="space-y-5">
        <div className={cardClass}>
          <p className="font-black mb-2">Terms of Service</p>
          <p className="text-sm text-muted-foreground normal-case font-sans leading-6">
            Please review our terms of service before continuing.
          </p>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-xs normal-case font-sans text-primary underline"
          >
            Terms of Service
          </a>
        </div>

        <label className="flex items-start gap-3 ooo-card bg-warm p-5 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.agreedToTerms}
            onChange={toggleAgree}
            className="mt-1 h-6 w-6 shrink-0 accent-primary"
          />
          <span className="text-sm normal-case font-sans leading-6">
            I agree to the Terms of Service.
          </span>
        </label>
      </div>

      {submitError && <p className="text-xs text-destructive normal-case font-sans mt-4">{submitError}</p>}

      <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="w-full sm:w-auto bg-card text-foreground ooo-border px-8 py-3 shadow-card hover-lift font-label disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`w-full sm:w-auto px-8 py-3 shadow-card font-label ooo-border bg-primary text-primary-foreground ${
            canSubmit ? "hover-lift cursor-pointer" : "opacity-50 cursor-not-allowed"
          }`}
        >
          {isSubmitting ? "Setting up your profile..." : "Complete Setup"}
        </button>
      </div>
    </div>
  );
}
