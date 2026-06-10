import React, { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  GraduationCap,
  HelpCircle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../components/ui";
import SchoolLayout from "../../components/School/SchoolLayout";

// ── Types ──────────────────────────────────────────────────────────────────

interface HealthMetrics {
  teachers: { total: number; active: number; max: number; active_pct: number; trend: number };
  students: { total: number; enrolled: number; max: number; enrolled_pct: number; trend: number };
  classes: { total: number; active: number; active_pct: number };
  engagement: {
    teachers_active_today_pct: number;
    students_active_today_pct: number;
    assignments_created_today: number;
    assignments_submitted_today: number;
  };
  performance: { avg_student_score: number; at_risk_count: number };
  storage: { used_gb: number; max_gb: number; pct_used: number };
}

interface Alert {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  actions: Array<{ action: string; label?: string; url?: string }>;
  created_at: string;
}

interface ActivityItem {
  timestamp: string;
  message: string;
  action: string;
}

interface TrendRow {
  this_week: number;
  last_week: number;
  change: number;
  change_pct?: number;
}

interface ChecklistItem {
  key: string;
  item: string;
  completed: boolean;
  action_url: string;
  optional?: boolean;
}

interface DashboardData {
  school: { id: string; name: string; logo_url: string | null; timezone: string };
  principal: { name: string; last_login: string | null };
  health_metrics: HealthMetrics;
  alerts: Alert[];
  engagement_heatmap: {
    teachers_active_pct: number;
    students_active_pct: number;
    classes_active_pct: number;
    assignments_submission_pct: number;
    last_updated: string;
  };
  activity_timeline: ActivityItem[];
  weekly_trends: Record<string, TrendRow>;
  onboarding: { active: boolean; progress_pct: number; checklist: ChecklistItem[] };
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    priority: number;
    action_url: string | null;
  }>;
  last_updated: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  trend,
  cta,
  icon: Icon,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
  cta?: { label: string; href: string };
  icon: React.ElementType;
  warn?: boolean;
}) {
  return (
    <Card padding="md" className="flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-xs text-white/50">{label}</p>
        <Icon
          className={`h-4 w-4 ${warn ? "text-red-400" : "text-indigo-400"}`}
        />
      </div>
      <p className={`text-2xl font-bold ${warn ? "text-red-300" : "text-white"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
      {trend !== undefined && (
        <div className="flex items-center gap-1">
          {trend > 0 ? (
            <TrendingUp className="h-3 w-3 text-emerald-400" />
          ) : trend < 0 ? (
            <TrendingDown className="h-3 w-3 text-red-400" />
          ) : null}
          <span
            className={`text-xs ${trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-white/30"}`}
          >
            {trend > 0 ? "+" : ""}
            {trend.toFixed(1)}% WoW
          </span>
        </div>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="mt-auto flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
        >
          {cta.label} <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </Card>
  );
}

function HeatBar({ label, pct }: { label: string; pct: number }) {
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  const color =
    p >= 70 ? "bg-emerald-500" : p >= 40 ? "bg-indigo-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-xs text-white/60">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-white/10" style={{ height: 6 }}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-medium text-white">{p}%</span>
    </div>
  );
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-amber-400",
  low: "text-white/40",
};
const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-white/20",
};

function AlertItem({
  alert,
  onDismiss,
  onResolve,
  schoolId,
  token,
}: {
  alert: Alert;
  onDismiss: (id: string) => void;
  onResolve: (id: string) => void;
  schoolId: string;
  token: string;
}) {
  const [busy, setBusy] = useState(false);

  async function act(type: "dismiss" | "resolve") {
    setBusy(true);
    const endpoint =
      type === "dismiss"
        ? `/api/school-admin/${schoolId}/alerts/${alert.id}/dismiss`
        : `/api/school-admin/${schoolId}/alerts/${alert.id}/resolve`;
    await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    type === "dismiss" ? onDismiss(alert.id) : onResolve(alert.id);
    setBusy(false);
  }

  return (
    <div className="flex items-start gap-3 py-3">
      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[alert.severity]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{alert.title}</p>
        {alert.description && (
          <p className="mt-0.5 text-xs text-white/40">{alert.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            onClick={() => act("resolve")}
            disabled={busy}
            className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
          >
            Resolve
          </button>
          <button
            onClick={() => act("dismiss")}
            disabled={busy}
            className="text-xs text-white/30 hover:text-white/60 disabled:opacity-40"
          >
            Mute
          </button>
        </div>
      </div>
      <span className={`shrink-0 text-xs font-medium capitalize ${SEVERITY_COLOR[alert.severity]}`}>
        {alert.severity}
      </span>
    </div>
  );
}

function TrendDelta({ row, invert = false }: { row?: TrendRow; invert?: boolean }) {
  if (!row) return <td className="px-3 py-2 text-xs text-white/30">—</td>;
  const up = row.change > 0;
  const isGood = invert ? !up : up;
  return (
    <td
      className={`px-3 py-2 text-xs font-medium tabular-nums ${isGood ? "text-emerald-400" : row.change < 0 ? "text-red-400" : "text-white/40"}`}
    >
      {row.change > 0 ? "↑" : row.change < 0 ? "↓" : "→"}{" "}
      {Math.abs(row.change_pct ?? row.change)}
      {row.change_pct !== undefined ? "%" : ""}
    </td>
  );
}

// ── Invite modal ───────────────────────────────────────────────────────────

function InviteModal({
  schoolId,
  token,
  onClose,
}: {
  schoolId: string;
  token: string;
  onClose: () => void;
}) {
  const [emails, setEmails] = useState("");
  const [busy, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; errors: string[] } | null>(null);

  async function send() {
    setSending(true);
    const lines = emails
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const teachers = lines.map((email) => ({ email }));

    const res = await fetch(`/api/school-admin/${schoolId}/invite-teachers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ teachers }),
    });
    const d = await res.json();
    setResult({ sent: d.sent ?? 0, errors: d.errors ?? [] });
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
        <h3 className="mb-1 text-base font-semibold text-white">Invite Teachers</h3>
        <p className="mb-4 text-xs text-white/40">
          Enter emails separated by commas or new lines.
        </p>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-400">{result.sent} invitation{result.sent !== 1 ? "s" : ""} sent ✓</p>
            {result.errors.length > 0 && (
              <div className="rounded-lg bg-red-500/10 p-3">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">{e}</p>
                ))}
              </div>
            )}
            <Button onClick={onClose} className="w-full">Close</Button>
          </div>
        ) : (
          <>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={5}
              placeholder={"john@school.edu\njane@school.edu"}
              className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex gap-3">
              <Button onClick={send} disabled={busy || !emails.trim()} className="flex-1">
                {busy ? "Sending…" : "Send invites"}
              </Button>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Upload modal ───────────────────────────────────────────────────────────

function UploadModal({
  schoolId,
  token,
  onClose,
}: {
  schoolId: string;
  token: string;
  onClose: () => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; existing: number; errors: unknown[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) || "");
    reader.readAsText(f);
  }

  async function upload() {
    setBusy(true);
    const res = await fetch(`/api/school-admin/${schoolId}/upload-students`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ csv_text: csvText }),
    });
    const d = await res.json();
    setResult({ created: d.created ?? 0, existing: d.existing ?? 0, errors: d.errors ?? [] });
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
        <h3 className="mb-1 text-base font-semibold text-white">Upload Student Roster</h3>
        <p className="mb-4 text-xs text-white/40">
          CSV columns: <span className="font-mono text-white/60">email, name, grade</span>
        </p>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-400">{result.created} students created ✓</p>
            {result.existing > 0 && (
              <p className="text-xs text-white/50">{result.existing} already had accounts</p>
            )}
            {result.errors.length > 0 && (
              <p className="text-xs text-red-400">{result.errors.length} rows had errors</p>
            )}
            <Button onClick={onClose} className="w-full">Close</Button>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 py-6 text-sm text-white/40 hover:border-indigo-500 hover:text-white/70"
              >
                <Upload className="h-4 w-4" />
                {csvText ? "File loaded — ready to upload" : "Click to select CSV file"}
              </button>
            </div>
            <div className="flex gap-3">
              <Button onClick={upload} disabled={busy || !csvText} className="flex-1">
                {busy ? "Uploading…" : "Upload students"}
              </Button>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────

export default function SchoolDashboardPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [expandMedium, setExpandMedium] = useState(false);
  const [hideOnboarding, setHideOnboarding] = useState(false);

  const fetchDashboard = useCallback(
    async (sid: string) => {
      try {
        const res = await fetch(`/api/school-admin/${sid}/dashboard`, { headers: auth });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    },
    [token] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const sid =
      typeof window !== "undefined"
        ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id")
        : null;
    if (!sid) { setLoading(false); return; }
    setSchoolId(sid);
    fetchDashboard(sid);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    if (!schoolId) return;
    setRefreshing(true);
    await fetch(`/api/school-admin/${schoolId}/refresh-metrics`, {
      method: "POST",
      headers: auth,
    });
    await fetchDashboard(schoolId);
    setRefreshing(false);
  }

  function removeAlert(id: string) {
    setData((d) =>
      d ? { ...d, alerts: d.alerts.filter((a) => a.id !== id) } : d
    );
  }

  if (!schoolId && !loading) {
    return (
      <SchoolLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <p className="text-white/50">No school linked to your account.</p>
          <Button onClick={() => router.push("/school/onboarding")}>
            Set up school
          </Button>
        </div>
      </SchoolLayout>
    );
  }

  if (loading) {
    return (
      <SchoolLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </SchoolLayout>
    );
  }

  if (!data) {
    return (
      <SchoolLayout>
        <p className="text-white/40">Failed to load dashboard.</p>
      </SchoolLayout>
    );
  }

  const { health_metrics: hm, alerts, engagement_heatmap: heat, activity_timeline, weekly_trends: trends, onboarding, recommendations } = data;

  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const highAlerts = alerts.filter((a) => a.severity === "high");
  const mediumAlerts = alerts.filter((a) => a.severity === "medium");

  return (
    <SchoolLayout>
      <Head><title>{data.school.name} — Dashboard</title></Head>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{data.school.name}</h1>
          <p className="mt-0.5 text-xs text-white/40">
            Principal Dashboard
            {data.principal.last_login &&
              ` · Last login ${new Date(data.principal.last_login).toLocaleString()}`}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh metrics"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:text-white disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Onboarding checklist */}
      {onboarding.active && !hideOnboarding && (
        <Card padding="md" className="mb-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Getting started · {onboarding.progress_pct}% complete
            </h2>
            <button
              onClick={() => setHideOnboarding(true)}
              className="text-xs text-white/30 hover:text-white/60"
            >
              Hide
            </button>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${onboarding.progress_pct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {onboarding.checklist.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <div className="h-4 w-4 shrink-0 rounded-full border border-white/20" />
                )}
                <span className={`text-xs ${item.completed ? "text-white/40 line-through" : "text-white/70"}`}>
                  {item.item}
                </span>
                {!item.completed && (
                  <Link href={item.action_url} className="ml-auto text-xs text-indigo-400 hover:text-indigo-300">
                    Go →
                  </Link>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => router.push("/school/onboarding")}>
              Continue setup
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setHideOnboarding(true)}>
              Skip for now
            </Button>
          </div>
        </Card>
      )}

      {/* Health metric cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricCard
          label="Teachers Active"
          value={`${hm.teachers.active} / ${hm.teachers.total}`}
          sub={`${hm.teachers.active_pct}% active today`}
          trend={hm.teachers.trend}
          icon={Users}
          cta={{ label: "Manage teachers", href: "/school/teachers" }}
        />
        <MetricCard
          label="Students Enrolled"
          value={`${hm.students.enrolled} / ${hm.students.total}`}
          sub={`${hm.students.enrolled_pct}% enrolled`}
          trend={hm.students.trend}
          icon={GraduationCap}
          cta={{ label: "View students", href: "/school/students" }}
        />
        <MetricCard
          label="Active Classes"
          value={`${hm.classes.active} / ${hm.classes.total}`}
          sub={`${hm.classes.active_pct}% with activity today`}
          icon={Database}
          cta={{ label: "View classes", href: "/school/classes" }}
        />
        <MetricCard
          label="Avg Student Score"
          value={`${hm.performance.avg_student_score}%`}
          icon={Zap}
        />
        <MetricCard
          label="Storage Used"
          value={`${hm.storage.used_gb} GB`}
          sub={`of ${hm.storage.max_gb} GB · ${hm.storage.pct_used}%`}
          icon={Database}
          warn={hm.storage.pct_used >= 85}
        />
        <MetricCard
          label="At-Risk Students"
          value={hm.performance.at_risk_count}
          sub="scoring below 60%"
          icon={AlertTriangle}
          warn={hm.performance.at_risk_count > 0}
          cta={{ label: "View students", href: "/school/students?filter=at_risk" }}
        />
      </div>

      {/* Engagement heatmap */}
      <Card padding="md" className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Engagement Heatmap</h2>
          <span className="text-xs text-white/30">
            Updated {new Date(heat.last_updated).toLocaleTimeString()}
          </span>
        </div>
        <div className="space-y-2.5">
          <HeatBar label="Teachers active" pct={heat.teachers_active_pct} />
          <HeatBar label="Students active" pct={heat.students_active_pct} />
          <HeatBar label="Classes in use" pct={heat.classes_active_pct} />
          <HeatBar label="Assignments submitted" pct={heat.assignments_submission_pct} />
        </div>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card padding="md" className="mb-5">
          <h2 className="mb-1 text-sm font-semibold text-white">
            Alerts ({alerts.length})
          </h2>

          {criticalAlerts.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-semibold text-red-400">🔴 CRITICAL</p>
              <div className="divide-y divide-white/5">
                {criticalAlerts.map((a) => (
                  <AlertItem
                    key={a.id}
                    alert={a}
                    onDismiss={removeAlert}
                    onResolve={removeAlert}
                    schoolId={schoolId!}
                    token={token}
                  />
                ))}
              </div>
            </div>
          )}

          {highAlerts.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-semibold text-orange-400">
                🟠 HIGH ({highAlerts.length})
              </p>
              <div className="divide-y divide-white/5">
                {highAlerts.map((a) => (
                  <AlertItem
                    key={a.id}
                    alert={a}
                    onDismiss={removeAlert}
                    onResolve={removeAlert}
                    schoolId={schoolId!}
                    token={token}
                  />
                ))}
              </div>
            </div>
          )}

          {mediumAlerts.length > 0 && (
            <div>
              <button
                onClick={() => setExpandMedium((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-amber-400"
              >
                🟡 MEDIUM ({mediumAlerts.length})
                {expandMedium ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
              {expandMedium && (
                <div className="mt-1 divide-y divide-white/5">
                  {mediumAlerts.map((a) => (
                    <AlertItem
                      key={a.id}
                      alert={a}
                      onDismiss={removeAlert}
                      onResolve={removeAlert}
                      schoolId={schoolId!}
                      token={token}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Quick actions */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Invite Teachers
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowUpload(true)}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Students
        </Button>
        <Button size="sm" variant="secondary" onClick={() => router.push("/school/students?filter=at_risk")}>
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> View At-Risk
        </Button>
        <Button size="sm" variant="secondary" onClick={() => router.push("/school/analytics")}>
          <Zap className="mr-1.5 h-3.5 w-3.5" /> Analytics
        </Button>
      </div>

      {/* Activity timeline */}
      {activity_timeline.length > 0 && (
        <Card padding="md" className="mb-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Activity (last 24h)</h2>
          <div className="space-y-2">
            {activity_timeline.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-14 shrink-0 text-xs tabular-nums text-white/30">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-xs text-white/70">{item.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Week-over-week trends */}
      {Object.keys(trends).length > 0 && (
        <Card padding="md" className="mb-5 overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-white">Week-over-Week Trends</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left font-medium text-white/50">Metric</th>
                <th className="px-3 py-2 text-right font-medium text-white/50">This Week</th>
                <th className="px-3 py-2 text-right font-medium text-white/50">Last Week</th>
                <th className="px-3 py-2 text-right font-medium text-white/50">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                ["Active Teachers", "active_teachers", false],
                ["Active Students", "active_students", false],
                ["Assignments Set", "assignments_created", false],
                ["Avg Score", "avg_score", false],
                ["At-Risk Count", "at_risk_count", true],
              ].map(([label, key, invert]) => {
                const row = trends[key as string] as TrendRow | undefined;
                return (
                  <tr key={key as string}>
                    <td className="px-3 py-2 text-white/60">{label as string}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-white">{row?.this_week ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/40">{row?.last_week ?? "—"}</td>
                    <TrendDelta row={row} invert={invert as boolean} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card padding="md">
          <h2 className="mb-3 text-sm font-semibold text-white">Recommendations</h2>
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.id} className="flex items-start gap-3">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{rec.title}</p>
                  {rec.description && (
                    <p className="mt-0.5 text-xs text-white/40">{rec.description}</p>
                  )}
                </div>
                {rec.action_url && (
                  <Link href={rec.action_url} className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300">
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modals */}
      {showInvite && schoolId && (
        <InviteModal schoolId={schoolId} token={token} onClose={() => setShowInvite(false)} />
      )}
      {showUpload && schoolId && (
        <UploadModal schoolId={schoolId} token={token} onClose={() => setShowUpload(false)} />
      )}
    </SchoolLayout>
  );
}
