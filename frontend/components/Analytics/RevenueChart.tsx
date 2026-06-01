import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RevenuePoint {
  month: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenuePoint[];
  className?: string;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated border border-border rounded-xl px-4 py-3 shadow-card">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white">
        NGN {payload[0].value.toLocaleString()}
      </p>
    </div>
  );
}

export default function RevenueChart({ data, className = "" }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`bg-surface-elevated border border-border rounded-2xl p-6 flex items-center justify-center h-48 ${className}`}>
        <p className="text-sm text-white/30">No revenue data yet</p>
      </div>
    );
  }

  return (
    <div className={`bg-surface-elevated border border-border rounded-2xl p-6 ${className}`}>
      <h3 className="text-sm font-semibold text-white mb-5">Revenue Trend</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            name="Revenue"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
