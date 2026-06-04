import React from "react";
import { cn } from "./cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const PAD = { none: "", sm: "p-4", md: "p-5", lg: "p-6" } as const;

export function Card({
  padding = "md",
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface rounded-2xl border border-border",
        PAD[padding],
        interactive && "transition-colors hover:border-white/15 hover:bg-surface-elevated/60",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
