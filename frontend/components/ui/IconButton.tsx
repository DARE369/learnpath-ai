import React from "react";
import { cn } from "./cn";

const SIZES = { sm: "h-8 w-8", md: "h-9 w-9", lg: "h-10 w-10" } as const;

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // required for accessibility
  size?: keyof typeof SIZES;
}

export function IconButton({ label, size = "md", className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-surface-elevated hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
