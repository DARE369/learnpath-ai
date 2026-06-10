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

// ── ADMIN-1.3: assignments ────────────────────────────────────────────────────

export const ASSIGNMENT_TYPES: [string, string][] = [
  ["quick_quiz", "Quick quiz"],
  ["custom_quiz", "Custom quiz"],
  ["video", "Video"],
  ["path", "Learning path"],
  ["document", "Document"],
  ["discussion", "Discussion"],
  ["external_link", "External link"],
];
export const ASSIGNMENT_TYPE_LABEL: Record<string, string> = Object.fromEntries(ASSIGNMENT_TYPES);

export interface AssignmentListItem {
  id: string;
  name: string;
  assignment_type: string;
  class_id: string;
  class_name: string;
  due_date: string | null;
  total: number;
  submitted: number;
  graded: number;
  created_at: string;
}

export interface ResponseRow {
  submission_id: string;
  student_id: string;
  student_name: string;
  student_email: string | null;
  status: "assigned" | "submitted" | "pending_manual" | "graded" | string;
  score: number | null;
  teacher_notes: string | null;
  is_late: boolean;
  submitted_at: string | null;
}

export interface AssignmentResponses {
  assignment: { id: string; name: string; assignment_type: string; due_date: string | null; description: string | null };
  stats: { assigned: number; submitted: number; pending_manual: number; graded: number; total: number };
  responses: ResponseRow[];
  pagination: { page: number; page_size: number; total: number; pages: number };
}

export const SUBMISSION_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  graded: "success",
  submitted: "warning",
  pending_manual: "warning",
  assigned: "neutral",
};

// ── ADMIN-1.4: class analytics ────────────────────────────────────────────────

export interface ClassAnalytics {
  class_id: string;
  class_name: string;
  date_range: { from: string; to: string };
  view: string;
  student_count: number;
  score_breakdown: { topic: string; score: number }[];
  score_trends: { topic: string; current: number; previous: number | null; trend: number | null }[];
  distribution: { at_risk: number; developing: number; proficient: number; advanced: number };
  weekly_trend: { week: string; avg_score: number }[];
  engagement: {
    active_this_week: number;
    total_students: number;
    assignment_submission_percent: number | null;
    video_completion_percent: number | null;
    avg_logins_per_week: number | null;
  };
  forecast: { current_completion: number; estimated_date: string | null; confidence: number; note: string | null };
  at_risk: {
    student_id: string;
    student_name: string;
    current_score: number;
    predicted_score: number;
    trend_per_session: number;
    risk_level: string;
    reason: string;
  }[];
  recommendations: { topic: string; current_score: number }[];
  comparison: { classes?: { class_id: string; class_name: string; avg_score: number; avg_progress: number; is_current: boolean }[] };
}

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
