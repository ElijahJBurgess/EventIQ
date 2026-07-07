import type { ProfileSetupPageProps } from "./types";

export default function Page4Terms({ onBack }: ProfileSetupPageProps) {
  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-black">Page 4 — Terms and AI Consent coming soon</h1>
      <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <button
          onClick={onBack}
          className="w-full sm:w-auto bg-card text-foreground ooo-border px-8 py-3 shadow-card hover-lift font-label"
        >
          Back
        </button>
        <button
          onClick={() => console.log("Setup complete - submit will go here")}
          className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 shadow-card hover-lift font-label"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
