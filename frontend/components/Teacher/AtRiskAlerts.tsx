import React from "react";
import { AlertTriangle, TrendingDown, Clock, CircleSlash, CheckCircle2 } from "lucide-react";
import { Card, Badge, Button, SectionHeader } from "../ui";
import type { TeacherAlert } from "./types";

const REASON: Record<string, { label: string; icon: React.ReactNode }> = {
  low_score: { label: "Low score", icon: <TrendingDown className="h-3.5 w-3.5" /> },
  inactive: { label: "Inactive", icon: <Clock className="h-3.5 w-3.5" /> },
  no_attempts: { label: "No attempts", icon: <CircleSlash className="h-3.5 w-3.5" /> },
};

export default function AtRiskAlerts({
  alerts,
  onViewProfile,
}: {
  alerts: TeacherAlert[];
  onViewProfile: (classId: string) => void;
}) {
  if (!alerts.length) {
    return (
      <Card className="border-success/30 bg-success-muted">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div>
            <p className="text-sm font-medium text-white">No at-risk students</p>
            <p className="text-xs text-white/50">Everyone&apos;s on track right now.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <SectionHeader
        title="At-risk alerts"
        subtitle={`${alerts.length} student${alerts.length === 1 ? "" : "s"} need attention`}
      />
      <div className="space-y-3">
        {alerts.map((a) => {
          const r = REASON[a.reason] || { label: a.reason, icon: <AlertTriangle className="h-3.5 w-3.5" /> };
          return (
            <Card key={a.alert_id} padding="md" className="border-error/20 bg-error-muted/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white">{a.student_name}</p>
                  <p className="text-xs text-white/40">{a.class_name}</p>
                </div>
                <Badge tone="error" icon={r.icon}>{r.label}</Badge>
              </div>

              <p className="mt-2 text-xs text-white/50">
                {a.current_score != null && <>Score <span className="font-semibold text-error">{a.current_score}%</span></>}
                {a.current_score != null && a.days_inactive != null && " · "}
                {a.days_inactive != null && <>Inactive <span className="font-semibold">{a.days_inactive}d</span></>}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => onViewProfile(a.class_id)}>View class</Button>
                <Button size="sm" variant="ghost" disabled title="Coming soon">Message</Button>
                <Button size="sm" variant="ghost" disabled title="Coming soon">Assign remedial</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
