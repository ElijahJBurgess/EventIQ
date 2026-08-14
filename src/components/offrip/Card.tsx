import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
}

export default function Card({ children, className = "", interactive = false, ...rest }: CardProps) {
  return (
    <div
      className={`border-2 border-offrip-black bg-offrip-white ${interactive ? "cursor-pointer transition-all hover:shadow-offrip-hard" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
