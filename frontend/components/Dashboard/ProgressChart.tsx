"use client";
import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c1c1c] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-white/40 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-xs text-white/70 capitalize">{entry.dataKey}:</span>
          <span className="text-xs font-semibold text-white">
            {entry.dataKey === "minutes"
              ? `${entry.value}m`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const RANGE_LABELS: Record<Range, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
};

export default function ProgressChart({ data }: { data: DataPoint[] }) {
  const [range, setRange] = useState<Range>("7d");
  const [metric, setMetric] = useState<"minutes" | "videos">("minutes");

  return (
    <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Learning Activity</h3>
          <p className="text-xs text-white/30 mt-0.5">Your study sessions over time</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Metric toggle */}
          <div className="flex rounded-lg bg-white/[0.04] p-0.5">
            {(["minutes", "videos"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  metric === m
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {m === "minutes" ? "Minutes" : "Videos"}
              </button>
            ))}
          </div>
          {/* Range selector */}
          <div className="flex rounded-lg bg-white/[0.04] p-0.5">
            {(["7d", "30d", "90d"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  range === r
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradMinutes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradVideos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="transparent"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="transparent"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
          {metric === "minutes" ? (
            <Area
              type="monotone"
              dataKey="minutes"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#gradMinutes)"
              dot={false}
              activeDot={{ r: 4, fill: "#6366f1", stroke: "#1c1c1c", strokeWidth: 2 }}
            />
          ) : (
            <Area
              type="monotone"
              dataKey="videos"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gradVideos)"
              dot={false}
              activeDot={{ r: 4, fill: "#10b981", stroke: "#1c1c1c", strokeWidth: 2 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
