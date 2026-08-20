interface ProgressIndicatorProps {
  currentPage: number;
  totalPages?: number;
}

export default function ProgressIndicator({ currentPage, totalPages = 4 }: ProgressIndicatorProps) {
  return (
    <div className="mb-8">
      <p className="font-display text-[10px] tracking-widest text-black/30 mb-3">
        Step {currentPage} of {totalPages}
      </p>
      <div className="flex gap-1.5">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={`h-1 flex-1 transition-colors ${
              step < currentPage
                ? "bg-primary"
                : step === currentPage
                  ? "bg-primary"
                  : "bg-black/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
