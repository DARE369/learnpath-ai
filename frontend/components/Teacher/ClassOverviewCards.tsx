import React from "react";
import { Users, ArrowUpRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, Badge, ProgressBar, SectionHeader, EmptyState, Button } from "../ui";
import type { TeacherClass } from "./types";

export default function ClassOverviewCards({
  classes,
  onView,
}: {
  classes: TeacherClass[];
  onView: (classId: string) => void;
}) {
  if (!classes.length) {
    return (
      <div>
        <SectionHeader title="Your classes" />
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No classes yet"
          description="Create your first class to start tracking students."
        />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Your classes" subtitle={`${classes.length} class${classes.length === 1 ? "" : "es"}`} />
      <div className="grid gap-4 md:grid-cols-2">
        {classes.map((c) => (
          <Card key={c.class_id} padding="md" className="flex flex-col">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-white">{c.class_name}</h3>
                <p className="text-xs text-white/40">{c.subject || "—"} · {c.student_count} students</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onView(c.class_id)} rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}>
                View
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Avg score" value={`${c.avg_score}%`} />
              <Stat label="Active" value={`${c.active_this_week}/${c.student_count}`} />
              <Stat label="Done" value={`${c.completion_rate}%`} />
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-white/40">
                <span>Completion</span>
                <span className="tabular-nums">{c.completion_rate}%</span>
              </div>
              <ProgressBar value={c.completion_rate} size="sm" />
            </div>

            <div className="mt-4 pt-3 border-t border-border">
              {c.at_risk_count > 0 ? (
                <Badge tone="error" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                  {c.at_risk_count} need{c.at_risk_count === 1 ? "s" : ""} attention
                </Badge>
              ) : (
                <Badge tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                  All on track
                </Badge>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-elevated p-2.5 text-center">
      <p className="text-base font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-white/40">{label}</p>
    </div>
  );
}
