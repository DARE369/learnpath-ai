import React from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
