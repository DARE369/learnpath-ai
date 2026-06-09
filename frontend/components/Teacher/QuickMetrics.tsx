import React from "react";
import { Card, ProgressBar } from "../ui";
import type { TeacherMetrics } from "./types";

export default function QuickMetrics({ metrics }: { metrics: TeacherMetrics }) {
  return (
    <Card padding="md">
      <h3 className="mb-4 text-sm font-semibold text-white">Quick metrics</h3>
      <div className="space-y-4">
        <Line label="Total students" value={String(metrics.total_students)} />
        <div>
          <Line label="Average score" value={`${metrics.avg_score}%`} />
          <ProgressBar value={metrics.avg_score} size="sm" className="mt-1.5" />
        </div>
        <Line label="Active this week" value={`${metrics.active_this_week}/${metrics.total_students}`} />
        <div>
          <Line label="Completion rate" value={`${metrics.completion_rate}%`} />
          <ProgressBar value={metrics.completion_rate} color="success" size="sm" className="mt-1.5" />
        </div>
      </div>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/50">{label}</span>
      <span className="font-semibold text-white tabular-nums">{value}</span>
    </div>
  );
}
