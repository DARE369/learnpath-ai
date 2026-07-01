import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "../ui/Skeleton";

export interface TopicsData {
  completed: number;
  inProgress: number;
  notStarted: number;
}

interface TopicsChartProps {
  data: TopicsData | null;
  isLoading?: boolean;
}

interface TooltipPayload {
  name: string;
  value: number;
}

function ChartTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-[#1c1c1c] border border-white/10 rounded-xl px-3 py-2 shadow-2xl text-xs">
      <p className="text-white/50 mb-0.5">{name}</p>
      <p className="font-semibold text-white">
        {value}{" "}
        <span className="text-white/40">
          ({total > 0 ? Math.round((value / total) * 100) : 0}%)
        </span>
      </p>
    </div>
  );
}

const SEGMENTS = [
  { key: "completed" as const, label: "Completed", color: "#10b981" },
  { key: "inProgress" as const, label: "In Progress", color: "#6366f1" },
  { key: "notStarted" as const, label: "Not Started", color: "rgba(255,255,255,0.07)" },
];

export default function TopicsChart({ data, isLoading }: TopicsChartProps) {
  if (isLoading) {
    return (
      <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-6 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-[180px] w-full rounded-xl" />
      </div>
    );
  }

  const completed = data?.completed ?? 0;
  const inProgress = data?.inProgress ?? 0;
  const notStarted = data?.notStarted ?? 0;
  const total = completed + inProgress + notStarted;

  if (total === 0) {
    return (
      <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-6 flex flex-col justify-center min-h-[260px]">
        <h3 className="text-sm font-semibold text-white mb-1">Course Progress</h3>
        <p className="text-xs text-white/30 mt-1">
          Start a course to see your progress breakdown.
        </p>
      </div>
    );
  }

  const chartData = SEGMENTS.map((s) => ({
    name: s.label,
    value: data?.[s.key] ?? 0,
    color: s.color,
  })).filter((d) => d.value > 0);

  return (
    <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-6">
      <h3 className="text-sm font-semibold text-white">Course Progress</h3>
      <p className="text-xs text-white/30 mt-0.5 mb-4">Breakdown by completion status</p>

      <div className="relative h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={76}
              dataKey="value"
              strokeWidth={2}
              stroke="#141414"
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => (
                <ChartTooltip
                  active={active}
                  payload={payload as unknown as TooltipPayload[]}
                  total={total}
                />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center total — absolutely positioned over the donut hole */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold text-white tabular-nums">{total}</p>
            <p className="text-[10px] text-white/30">courses</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {SEGMENTS.filter((s) => (data?.[s.key] ?? 0) > 0).map((s) => {
          const value = data?.[s.key] ?? 0;
          return (
            <div key={s.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-xs text-white/50">{s.label}</span>
              </div>
              <span className="text-xs font-medium text-white/80 tabular-nums">
                {value}{" "}
                <span className="text-white/30">
                  ({Math.round((value / total) * 100)}%)
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
