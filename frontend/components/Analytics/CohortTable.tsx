import React from "react";

interface CohortRow {
  signup_month: string;
  total_users: number;
  still_active: number;
  retention_percentage: number;
}

interface CohortTableProps {
  cohorts: CohortRow[];
  className?: string;
}

function retentionColor(pct: number): string {
  if (pct >= 80) return "bg-success/20 text-success";
  if (pct >= 60) return "bg-accent-muted text-accent-light";
  if (pct >= 40) return "bg-warning/20 text-warning";
  return "bg-error-muted text-error";
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export default function CohortTable({ cohorts, className = "" }: CohortTableProps) {
  if (!cohorts || cohorts.length === 0) {
    return (
      <div className={`bg-surface-elevated border border-border rounded-2xl p-6 text-center ${className}`}>
        <p className="text-sm text-white/30">No cohort data yet</p>
      </div>
    );
  }

  return (
    <div className={`bg-surface-elevated border border-border rounded-2xl overflow-hidden ${className}`}>
      <div className="px-6 py-5 border-b border-border">
        <h3 className="text-sm font-semibold text-white">User Retention Cohorts</h3>
        <p className="text-xs text-white/40 mt-0.5">Users still active since signup</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-6 py-3 text-xs font-medium text-white/40">Signup Month</th>
              <th className="px-4 py-3 text-xs font-medium text-white/40 text-right">Total</th>
              <th className="px-4 py-3 text-xs font-medium text-white/40 text-right">Active</th>
              <th className="px-4 py-3 text-xs font-medium text-white/40 text-right">Retention</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((row, idx) => (
              <tr key={row.signup_month} className="border-t border-border/40 hover:bg-surface-hover/20 transition-colors">
                <td className="px-6 py-3 font-medium text-white">{fmtMonth(row.signup_month)}</td>
                <td className="px-4 py-3 text-right text-white/60 tabular-nums">{row.total_users.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-white/60 tabular-nums">{row.still_active.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${retentionColor(row.retention_percentage)}`}>
                    {row.retention_percentage.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
