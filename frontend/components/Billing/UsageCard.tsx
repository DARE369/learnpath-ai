import React from "react";
import { PlayCircle, Clock, MessageCircle } from "lucide-react";

const UNLIMITED = 999999;

interface UsageItemProps {
  label: string;
  icon: React.ReactNode;
  used: number;
  limit: number;
  percentage: number;
  remaining: number;
  resetLabel: string;
}

function pctColor(pct: number): string {
  if (pct >= 90) return "bg-error";
  if (pct >= 70) return "bg-warning";
  return "bg-gradient-accent";
}

function pctTextColor(pct: number): string {
  if (pct >= 90) return "text-error";
  if (pct >= 70) return "text-warning";
  return "text-accent-light";
}

function UsageItem({ label, icon, used, limit, percentage, remaining, resetLabel }: UsageItemProps) {
  const unlimited = limit >= UNLIMITED;
  const display_pct = unlimited ? 0 : Math.min(100, percentage);
  const color = unlimited ? "bg-gradient-accent" : pctColor(percentage);
  const textColor = unlimited ? "text-accent-light" : pctTextColor(percentage);

  return (
    <div className="bg-surface-elevated border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center text-accent-light">
            {icon}
          </div>
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <span className={`text-xs font-semibold ${textColor}`}>
          {unlimited ? "Unlimited" : `${display_pct.toFixed(0)}%`}
        </span>
      </div>

      <div className="h-2 rounded-full bg-surface-hover overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${unlimited ? 100 : display_pct}%`, opacity: unlimited ? 0.3 : 1 }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50">
          {unlimited ? (
            "Unlimited access"
          ) : (
            <>
              <span className="text-white font-medium">{used}</span>
              {" / "}
              <span>{limit}</span>
            </>
          )}
        </span>
        <span className="text-white/30">{resetLabel}</span>
      </div>

      {!unlimited && remaining <= 2 && remaining > 0 && (
        <p className="mt-2 text-xs text-warning">
          Only {remaining} remaining
        </p>
      )}
    </div>
  );
}

export interface UsageData {
  plan_type: string;
  videos_watched: number;
  videos_limit: number;
  videos_percentage: number;
  videos_remaining: number;
  hours_learned: number;
  hours_limit: number;
  hours_percentage: number;
  hours_remaining: number;
  questions_today: number;
  questions_day_limit: number;
  questions_percentage: number;
  questions_remaining: number;
  month: string;
  reset_date: string;
}

interface UsageCardProps {
  data: UsageData;
  className?: string;
}

export default function UsageCard({ data, className = "" }: UsageCardProps) {
  const resetLabel = `Resets ${data.reset_date || "next month"}`;
  const todayLabel = "Resets tomorrow";

  return (
    <div className={`space-y-3 ${className}`}>
      <UsageItem
        label="Videos this month"
        icon={<PlayCircle size={16} />}
        used={data.videos_watched}
        limit={data.videos_limit}
        percentage={data.videos_percentage}
        remaining={data.videos_remaining}
        resetLabel={resetLabel}
      />
      <UsageItem
        label="Hours this month"
        icon={<Clock size={16} />}
        used={Math.round(data.hours_learned * 10) / 10}
        limit={data.hours_limit}
        percentage={data.hours_percentage}
        remaining={data.hours_remaining}
        resetLabel={resetLabel}
      />
      <UsageItem
        label="Questions today"
        icon={<MessageCircle size={16} />}
        used={data.questions_today}
        limit={data.questions_day_limit}
        percentage={data.questions_percentage}
        remaining={data.questions_remaining}
        resetLabel={todayLabel}
      />
    </div>
  );
}
