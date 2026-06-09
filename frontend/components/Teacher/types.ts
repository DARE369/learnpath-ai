export interface TeacherClass {
  class_id: string;
  class_name: string;
  subject: string | null;
  student_count: number;
  avg_score: number;
  active_this_week: number;
  at_risk_count: number;
  completion_rate: number;
}

export interface TeacherAlert {
  alert_id: string;
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  reason: "low_score" | "inactive" | "no_attempts" | string;
  current_score: number | null;
  days_inactive: number | null;
}

export interface TeacherMetrics {
  total_students: number;
  avg_score: number;
  active_this_week: number;
  completion_rate: number;
}

export interface TeacherActivity {
  type: string;
  student_name: string;
  class_name: string;
  description: string;
  occurred_at: string;
}

export interface TeacherDashboard {
  teacher: { id: string; name: string; email: string };
  classes: TeacherClass[];
  alerts: TeacherAlert[];
  metrics: TeacherMetrics;
  recent_activity: TeacherActivity[];
  timestamp: string;
}

// ── ADMIN-1.2: roster + student profile ──────────────────────────────────────

export type StudentStatus = "good" | "caution" | "at_risk";

export interface ClassDetail {
  class_id: string;
  class_name: string;
  subject: string | null;
  student_count: number;
  avg_score: number;
  avg_progress: number;
  active_this_week: number;
  at_risk_count: number;
}

export interface RosterStudent {
  student_id: string;
  name: string;
  email: string | null;
  progress: number;
  score: number;
  status: StudentStatus;
  last_active: string | null;
}

export interface RosterResponse {
  roster: RosterStudent[];
  pagination: { page: number; page_size: number; total: number; pages: number };
}

export interface ConceptScore {
  name: string;
  accuracy: number;
}

export interface TimelineItem {
  type: string;
  title: string;
  score: number | null;
  passed: boolean;
  occurred_at: string;
}

export interface StudentProfile {
  student: { id: string; name: string; email: string | null };
  enrollment: { class_id: string; class_name: string; teacher_name: string; enrolled_at: string | null; status: StudentStatus };
  performance: { current_score: number; progress_percent: number; time_invested_hours: number; last_active: string | null };
  score_breakdown: ConceptScore[];
  weak_concepts: ConceptScore[];
  activity_timeline: TimelineItem[];
}

export const STATUS_LABEL: Record<StudentStatus, string> = {
  good: "On track",
  caution: "Caution",
  at_risk: "At-risk",
};
export const STATUS_TONE: Record<StudentStatus, "success" | "warning" | "error"> = {
  good: "success",
  caution: "warning",
  at_risk: "error",
};

export function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 60) return `${Math.max(0, m)}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
