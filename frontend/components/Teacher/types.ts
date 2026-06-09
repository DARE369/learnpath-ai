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
