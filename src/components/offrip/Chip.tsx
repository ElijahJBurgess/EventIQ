import type { ReactNode } from "react";

type ChipColor = "aqua" | "orange" | "lime" | "blue" | "black" | "light-gray";

interface ChipProps {
  children: ReactNode;
  color: ChipColor;
}

const COLOR_CLASSES: Record<ChipColor, string> = {
  aqua: "bg-offrip-aqua text-offrip-black",
  orange: "bg-offrip-orange text-offrip-white",
  lime: "bg-offrip-lime text-offrip-black",
  blue: "bg-offrip-blue text-offrip-white",
  black: "bg-offrip-black text-offrip-white",
  "light-gray": "bg-offrip-light-gray text-offrip-black",
};

export default function Chip({ children, color }: ChipProps) {
  return (
    <span className={`inline-flex px-2.5 py-1 font-offrip-display text-[10px] font-bold uppercase tracking-wide ${COLOR_CLASSES[color]}`}>
      {children}
    </span>
  );
}
