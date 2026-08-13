const STEPS = ["Profile saved", "Preferences saved", "Ready to explore events"];

export default function SuccessScreen() {
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
      <h1 className="text-3xl sm:text-4xl font-black">Your profile is ready</h1>
      <p className="text-sm text-muted-foreground normal-case font-sans mt-3 mb-8">
        You're ready to discover events and meet the right people.
      </p>
      <ul className="space-y-3 text-left max-w-xs mx-auto">
        {STEPS.map((step) => (
          <li key={step} className="text-sm font-bold normal-case font-sans">
            ✓ {step}
          </li>
        ))}
      </ul>
    </div>
  );
}
