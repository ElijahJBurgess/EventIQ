interface PillSelectProps {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  singleSelect?: boolean;
  onMaxAttempt?: () => void;
}

export default function PillSelect({
  options,
  selected,
  onChange,
  max,
  singleSelect = false,
  onMaxAttempt,
}: PillSelectProps) {
  const toggle = (option: string) => {
    if (singleSelect) {
      onChange(selected[0] === option ? [] : [option]);
      return;
    }

    const isSelected = selected.includes(option);
    if (isSelected) {
      onChange(selected.filter((item) => item !== option));
      return;
    }

    if (max && selected.length >= max) {
      onMaxAttempt?.();
      return;
    }

    onChange([...selected, option]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            type="button"
            key={option}
            onClick={() => toggle(option)}
            className={`rounded-full border-2 border-primary px-4 py-2 text-xs font-bold normal-case font-sans transition ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-warm"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
