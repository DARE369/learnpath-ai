import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Badge, ProgressBar, Button } from "../ui";
import { RosterStudent, STATUS_LABEL, STATUS_TONE, timeAgo } from "./types";

function scoreColor(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-error";
}

export default function ClassRosterTable({
  roster,
  onView,
}: {
  roster: RosterStudent[];
  onView: (studentId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-elevated text-left text-xs uppercase tracking-wide text-white/40">
          <tr>
            <th className="px-4 py-3 font-semibold">Student</th>
            <th className="px-4 py-3 font-semibold">Progress</th>
            <th className="px-4 py-3 font-semibold">Score</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Last active</th>
            <th className="px-4 py-3 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {roster.map((s) => (
            <tr key={s.student_id} className="transition-colors hover:bg-surface-elevated/60">
              <td className="px-4 py-3">
                <p className="font-medium text-white">{s.name}</p>
                {s.email && <p className="text-xs text-white/40">{s.email}</p>}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <ProgressBar value={s.progress} size="sm" className="max-w-[120px]" />
                  <span className="tabular-nums text-white/50">{s.progress}%</span>
                </div>
              </td>
              <td className={`px-4 py-3 font-semibold tabular-nums ${scoreColor(s.score)}`}>{s.score}%</td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
              </td>
              <td className="px-4 py-3 text-white/50">{timeAgo(s.last_active)}</td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="secondary" onClick={() => onView(s.student_id)} rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}>
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
