import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className = "", id, ...rest }: InputProps) {
  return (
    <label className="block font-offrip-body text-offrip-black" htmlFor={id}>
      {label && (
        <span className="mb-2 block font-offrip-display text-[11px] font-bold uppercase tracking-wide">
          {label}
        </span>
      )}
      <input
        id={id}
        className={`w-full border-2 border-offrip-black bg-offrip-white px-4 py-3 font-offrip-body text-offrip-black outline-none transition-colors duration-150 placeholder:text-offrip-medium-gray focus:border-offrip-aqua disabled:bg-offrip-light-gray disabled:opacity-50 ${className}`}
        {...rest}
      />
    </label>
  );
}
