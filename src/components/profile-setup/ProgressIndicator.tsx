interface ProgressIndicatorProps {
  currentPage: number;
  totalPages?: number;
}

export default function ProgressIndicator({ currentPage, totalPages = 4 }: ProgressIndicatorProps) {
  return (
    <div className="mb-6">
      <p className="font-label text-xs text-muted-foreground mb-2">
        Step {currentPage} of {totalPages}
      </p>
      <div className="flex gap-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              step < currentPage
                ? "bg-primary"
                : step === currentPage
                  ? "bg-vermillion"
                  : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
