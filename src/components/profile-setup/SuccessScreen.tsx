import { useEffect, useState } from "react";

const STEPS = ["Profile saved", "Preferences locked in", "Match engine warming up"];
const STEP_DELAY_MS = 400;

export default function SuccessScreen() {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers = STEPS.map((_, index) =>
      setTimeout(() => setVisibleCount((count) => Math.max(count, index + 1)), STEP_DELAY_MS * (index + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="ooo-card bg-card p-8 sm:p-10 text-center">
      <div className="flex justify-center gap-2 mb-8">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full bg-primary animate-pulse-soft"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <h1 className="text-3xl sm:text-4xl font-black">Building your matches...</h1>
      <p className="text-sm text-muted-foreground normal-case font-sans mt-3 mb-8">
        We're setting up your personalized match recommendations. This only takes a moment.
      </p>
      <ul className="space-y-3 text-left max-w-xs mx-auto min-h-[84px]">
        {STEPS.map(
          (step, index) =>
            index < visibleCount && (
              <li key={step} className="animate-fade-in text-sm font-bold normal-case font-sans">
                ✓ {step}
              </li>
            ),
        )}
      </ul>
    </div>
  );
}
