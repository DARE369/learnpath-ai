// The <TopicsChart> component is orphaned by the ui-v2 Dashboard migration
// (no chart in the new design) — but `useDashboardData` still imports the
// `TopicsData` type from this file and still fetches /api/dashboard/progress
// unconditionally. Keep the file until that's revisited; safe to delete the
// component itself once TopicsData moves to a smaller shared types file.
import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, Skeleton } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";
import { chartColor } from "../../ui-v2/charts";

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

function ChartTooltip({ active, payload, total }: { active?: boolean; payload?: TooltipPayload[]; total: number }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{ background: chartColor.tooltipBg, border: `1px solid ${chartColor.tooltipBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 8px 24px rgba(20,23,31,0.12)" }}>
      <div style={{ color: color.textFaint, marginBottom: 2 }}>{name}</div>
      <div style={{ fontWeight: 600, color: color.ink }}>
        {value} <span style={{ color: color.textFaint }}>({total > 0 ? Math.round((value / total) * 100) : 0}%)</span>
      </div>
    </div>
  );
}

const SEGMENTS = [
  { key: "completed" as const, label: "Completed", color: chartColor.categorical[0] },
  { key: "inProgress" as const, label: "In Progress", color: chartColor.categorical[1] },
  { key: "notStarted" as const, label: "Not Started", color: chartColor.categorical[2] },
];

export default function TopicsChart({ data, isLoading }: TopicsChartProps) {
  if (isLoading) {
    return (
      <Card padding="md" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton style={{ height: 16, width: 128 }} />
        <Skeleton style={{ height: 12, width: 192 }} />
        <Skeleton style={{ height: 180, width: "100%", borderRadius: 12 }} />
      </Card>
    );
  }

  const completed = data?.completed ?? 0;
  const inProgress = data?.inProgress ?? 0;
  const notStarted = data?.notStarted ?? 0;
  const total = completed + inProgress + notStarted;

  if (total === 0) {
    return (
      <Card padding="md" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 260 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: color.ink }}>Course Progress</div>
        <div style={{ fontSize: 12, color: color.textFaint, marginTop: 4 }}>Start a course to see your progress breakdown.</div>
      </Card>
    );
  }

  const chartData = SEGMENTS.map((s) => ({ name: s.label, value: data?.[s.key] ?? 0, color: s.color })).filter((d) => d.value > 0);

  return (
    <Card padding="md">
      <div style={{ fontSize: 13, fontWeight: 600, color: color.ink }}>Course Progress</div>
      <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2, marginBottom: 14 }}>Breakdown by completion status</div>

      <div style={{ position: "relative", height: 180, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={52} outerRadius={76} dataKey="value" strokeWidth={2} stroke={color.surface}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => <ChartTooltip active={active} payload={payload as unknown as TooltipPayload[]} total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600, color: color.ink }}>{total}</div>
            <div style={{ fontSize: 10, color: color.textFaint }}>courses</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {SEGMENTS.filter((s) => (data?.[s.key] ?? 0) > 0).map((s) => {
          const value = data?.[s.key] ?? 0;
          return (
            <div key={s.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: color.textFaint }}>{s.label}</span>
              </div>
              <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 500, color: color.ink }}>
                {value} <span style={{ color: color.textFaint }}>({Math.round((value / total) * 100)}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
