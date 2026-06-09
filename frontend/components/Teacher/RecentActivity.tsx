import React from "react";
import { CheckCircle2, LogIn, Activity } from "lucide-react";
import { Card, SectionHeader, EmptyState } from "../ui";
import type { TeacherActivity } from "./types";

function icon(type: string) {
  if (type === "quiz_submitted") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (type === "active") return <LogIn className="h-4 w-4 text-info" />;
  return <Activity className="h-4 w-4 text-white/50" />;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 60) return `${Math.max(0, m)}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function RecentActivity({ activities }: { activities: TeacherActivity[] }) {
  if (!activities.length) {
    return (
      <div>
        <SectionHeader title="Recent activity" />
        <EmptyState icon={<Activity className="h-5 w-5" />} title="No recent activity" description="Activity from your students will show up here." />
      </div>
    );
  }
  return (
    <div>
      <SectionHeader title="Recent activity" subtitle="Last 7 days" />
      <Card padding="none">
        <ul className="divide-y divide-border">
          {activities.map((a, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5">{icon(a.type)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">{a.description}</p>
                <p className="mt-0.5 text-xs text-white/40">
                  {a.student_name}{a.class_name ? ` · ${a.class_name}` : ""} · {timeAgo(a.occurred_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
