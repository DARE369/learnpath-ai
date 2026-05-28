import React from "react";

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: "blue" | "green" | "purple" | "orange";
  sublabel?: string;
}

const colorMap = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    iconBg: "bg-blue-500/15",
    iconText: "text-blue-400",
    trendPositive: "text-blue-400",
    accent: "#3b82f6",
  },
  green: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-400",
    trendPositive: "text-emerald-400",
    accent: "#10b981",
  },
  purple: {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    iconBg: "bg-indigo-500/15",
    iconText: "text-indigo-400",
    trendPositive: "text-indigo-400",
    accent: "#6366f1",
  },
  orange: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    iconBg: "bg-orange-500/15",
    iconText: "text-orange-400",
    trendPositive: "text-orange-400",
    accent: "#f97316",
  },
};

export default function StatsCard({ icon, label, value, trend, color, sublabel }: StatsCardProps) {
  const c = colorMap[color];

  return (
    <div
      className={`relative rounded-2xl border ${c.bg} ${c.border} p-5 overflow-hidden group hover:scale-[1.02] transition-transform duration-200`}
    >
      {/* Subtle glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${c.accent}10 0%, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-2 tabular-nums leading-none">{value}</p>
          {sublabel && <p className="text-xs text-white/30 mt-1">{sublabel}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.isPositive ? "text-emerald-400" : "text-rose-400"}`}>
              <svg
                className={`w-3 h-3 ${trend.isPositive ? "" : "rotate-180"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {trend.value}% this week
            </div>
          )}
        </div>
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center ${c.iconText}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
