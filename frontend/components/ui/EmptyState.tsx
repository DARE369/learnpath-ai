import React from "react";
import { cn } from "./cn";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-12 text-center", className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated text-white/50">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs text-white/40">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
