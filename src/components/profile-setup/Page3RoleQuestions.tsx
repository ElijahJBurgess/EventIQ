import type { ProfileSetupPageProps } from "./types";

export default function Page3RoleQuestions({ onNext, onBack }: ProfileSetupPageProps) {
  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-black">Page 3 — Role Questions coming soon</h1>
      <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <button
          onClick={onBack}
          className="w-full sm:w-auto bg-card text-foreground ooo-border px-8 py-3 shadow-card hover-lift font-label"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 shadow-card hover-lift font-label"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
