import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "tertiary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-offrip-black text-offrip-white hover:bg-offrip-aqua",
  secondary: "border border-offrip-black bg-transparent text-offrip-black hover:bg-offrip-black hover:text-offrip-white",
  tertiary: "bg-transparent text-offrip-black hover:text-offrip-aqua",
};

export default function Button({
  variant = "primary",
  children,
  type = "button",
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1 px-5 py-3 font-offrip-display text-[11px] font-black uppercase tracking-widest transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
      {variant === "tertiary" && <span aria-hidden="true">→</span>}
    </button>
  );
}
