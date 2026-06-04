import React from "react";
import { cn } from "./cn";

type Tone = "accent" | "success" | "warning" | "error" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  accent: "bg-accent-muted text-accent-light",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  error: "bg-error-muted text-error",
  info: "bg-info-muted text-info",
  neutral: "bg-white/8 text-white/60",
};

interface BadgeProps {
  tone?: Tone;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ tone = "neutral", icon, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
