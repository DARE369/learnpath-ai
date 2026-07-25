// Orphaned by the ui-v2 Dashboard migration — no charts appeared in the new
// design until now. Re-homed on dashboard.tsx alongside TopicsChart.
"use client";
import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "../../ui-v2/primitives";
import { color } from "../../ui-v2/tokens";
import { chartColor } from "../../ui-v2/charts";

interface DataPoint {
  date: string;
  videos: number;
  minutes: number;
}

type Range = "7d" | "30d" | "90d";

interface TooltipEntry {
  dataKey: string;
  value: number;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: chartColor.tooltipBg, border: `1px solid ${chartColor.tooltipBorder}`, borderRadius: 8, padding: "10px 14px", boxShadow: "0 8px 24px rgba(20,23,31,0.12)" }}>
      <div style={{ fontSize: 11.5, color: color.textFaint, marginBottom: 6 }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color }} />
          <span style={{ fontSize: 12, color: color.textFaint, textTransform: "capitalize" }}>{entry.dataKey}:</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: color.ink }}>{entry.dataKey === "minutes" ? `${entry.value}m` : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

const RANGE_LABELS: Record<Range, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };

function PillToggle<T extends string>({ options, value, onChange, labels }: { options: T[]; value: T; onChange: (v: T) => void; labels?: Record<T, string> }) {
  return (
    <div style={{ display: "flex", gap: 2, background: color.surfaceElevated, borderRadius: 7, padding: 3 }}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 5, cursor: "pointer", border: "none", background: value === o ? "#fff" : "transparent", color: value === o ? color.ink : color.textFaint }}
        >
          {labels ? labels[o] : o}
        </button>
      ))}
    </div>
  );
}

export default function ProgressChart({ data }: { data: DataPoint[] }) {
  const [range, setRange] = useState<Range>("7d");
  const [metric, setMetric] = useState<"minutes" | "videos">("minutes");

  return (
    <Card padding="md">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: color.ink }}>Learning Activity</div>
          <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>Your study sessions over time</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <PillToggle options={["minutes", "videos"] as const} value={metric} onChange={setMetric} labels={{ minutes: "Minutes", videos: "Videos" }} />
          <PillToggle options={["7d", "30d", "90d"] as Range[]} value={range} onChange={setRange} labels={RANGE_LABELS} />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradMinutes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor.accentLine} stopOpacity={0.35} />
              <stop offset="100%" stopColor={chartColor.accentLine} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradVideos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor.successLine} stopOpacity={0.35} />
              <stop offset="100%" stopColor={chartColor.successLine} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColor.grid} vertical={false} />
          <XAxis dataKey="date" stroke="transparent" tick={{ fill: chartColor.tickText, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis stroke="transparent" tick={{ fill: chartColor.tickText, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: chartColor.grid, strokeWidth: 1 }} />
          {metric === "minutes" ? (
            <Area type="monotone" dataKey="minutes" stroke={chartColor.accentLine} strokeWidth={2} fill="url(#gradMinutes)" dot={false} activeDot={{ r: 4, fill: chartColor.accentLine, stroke: color.surface, strokeWidth: 2 }} />
          ) : (
            <Area type="monotone" dataKey="videos" stroke={chartColor.successLine} strokeWidth={2} fill="url(#gradVideos)" dot={false} activeDot={{ r: 4, fill: chartColor.successLine, stroke: color.surface, strokeWidth: 2 }} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
