import React, { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../../hooks/useAuth";
import { Card, Badge, Button, Modal, ModalTitle, Textarea, ProgressBar, InlineError, type BadgeTone } from "../../ui-v2/primitives";
import { ThresholdRing } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";

// ── Types (mirrors backend /api/school-admin/{id}/dashboard response) ──────

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
  recommendations: Array<{ id: string; title: string; description: string; priority: number; action_url: string | null }>;
  last_updated: string;
}

const SEVERITY_TONE: Record<Alert["severity"], BadgeTone> = {
  critical: "danger",
  high: "warning",
  medium: "neutral",
  low: "neutral",
};

// ── Small pieces ─────────────────────────────────────────────────────────

function MetricTile({ value, label, trend, trendGood, href }: { value: string | number; label: string; trend?: string; trendGood?: boolean; href?: string }) {
  const router = useRouter();
  return (
    <Card padding="md" style={{ cursor: href ? "pointer" : undefined }} onClick={href ? () => router.push(href) : undefined}>
      <div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 12, color: color.textFaint, marginTop: 4 }}>{label}</div>
      {trend && <div style={{ fontSize: 11.5, color: trendGood ? color.success.fg : color.danger.fg, marginTop: 6 }}>{trend}</div>}
    </Card>
  );
}

function HeatRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div style={{ fontFamily: font.mono, fontSize: 19, fontWeight: 600 }}>{pct}%</div>
      <div style={{ fontSize: 11.5, color: color.textFaint, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AlertRow({ alert, busy, onResolve, onDismiss }: { alert: Alert; busy: boolean; onResolve: () => void; onDismiss: () => void }) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderLeft: `3px solid ${color.danger.fg}`, borderRadius: 8, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.severity.toUpperCase()}</Badge>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5 }}>{alert.title}</div>
        {alert.description && <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>{alert.description}</div>}
      </div>
      <Button variant="secondary" size="sm" disabled={busy} onClick={onResolve}>Resolve</Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onDismiss}>Dismiss</Button>
    </div>
  );
}

// ── Invite modal ─────────────────────────────────────────────────────────

function InviteModal({ schoolId, token, onClose }: { schoolId: string; token: string; onClose: () => void }) {
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sent: number; errors: string[] } | null>(null);

  async function send() {
    setBusy(true);
    const teachers = emails.split(/[\n,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean).map((email) => ({ email }));
    const res = await fetch(`/api/school-admin/${schoolId}/invite-teachers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ teachers }),
    });
    const d = await res.json();
    setResult({ sent: d.sent ?? 0, errors: d.errors ?? [] });
    setBusy(false);
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Invite teachers</ModalTitle>
      <p style={{ fontSize: 12.5, color: color.textFaint, marginBottom: 16 }}>Enter emails separated by commas or new lines.</p>
      {result ? (
        <div>
          <p style={{ fontSize: 13.5, color: color.success.fg, marginBottom: 10 }}>{result.sent} invitation{result.sent !== 1 ? "s" : ""} sent</p>
          {result.errors.length > 0 && (
            <div style={{ background: color.danger.bg, borderRadius: 8, padding: 12, marginBottom: 14 }}>
              {result.errors.map((e, i) => <p key={i} style={{ fontSize: 12, color: color.danger.fg, margin: 0 }}>{e}</p>)}
            </div>
          )}
          <Button fullWidth onClick={onClose}>Close</Button>
        </div>
      ) : (
        <>
          <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={5} placeholder={"jane@school.edu\njohn@school.edu"} style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <Button fullWidth disabled={busy || !emails.trim()} onClick={send}>{busy ? "Sending…" : "Send invites"}</Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Upload modal ─────────────────────────────────────────────────────────

function UploadModal({ schoolId, token, onClose }: { schoolId: string; token: string; onClose: () => void }) {
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
    <Modal onClose={onClose}>
      <ModalTitle>Upload student roster</ModalTitle>
      <p style={{ fontSize: 12.5, color: color.textFaint, marginBottom: 16 }}>CSV columns: <span style={{ fontFamily: font.mono }}>email, name, grade</span></p>
      {result ? (
        <div>
          <p style={{ fontSize: 13.5, color: color.success.fg, marginBottom: 6 }}>{result.created} students created</p>
          {result.existing > 0 && <p style={{ fontSize: 12, color: color.textFaint, marginBottom: 6 }}>{result.existing} already had accounts</p>}
          {result.errors.length > 0 && <p style={{ fontSize: 12, color: color.danger.fg, marginBottom: 10 }}>{result.errors.length} rows had errors</p>}
          <Button fullWidth onClick={onClose}>Close</Button>
        </div>
      ) : (
        <>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            style={{ width: "100%", padding: "22px 12px", marginBottom: 16, border: `1px dashed #CFCBC0`, borderRadius: 8, background: "transparent", fontSize: 13, color: color.textFaint, cursor: "pointer" }}
          >
            {csvText ? "File loaded — ready to upload" : "Click to select CSV file"}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <Button fullWidth disabled={busy || !csvText} onClick={upload}>{busy ? "Uploading…" : "Upload students"}</Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Main page ────────────────────────────────────────────────────────────

export default function SchoolDashboardPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [busyAlert, setBusyAlert] = useState<string | null>(null);
  const [hideOnboarding, setHideOnboarding] = useState(false);

  const fetchDashboard = useCallback(async (sid: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/school-admin/${sid}/dashboard`, { headers: auth });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
    } catch {
      setError("Couldn't load the school dashboard.");
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sid = typeof window !== "undefined" ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id") : null;
    if (!sid) { setLoading(false); return; }
    setSchoolId(sid);
    fetchDashboard(sid);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    if (!schoolId) return;
    setRefreshing(true);
    await fetch(`/api/school-admin/${schoolId}/refresh-metrics`, { method: "POST", headers: auth });
    await fetchDashboard(schoolId);
    setRefreshing(false);
  }

  async function actOnAlert(alertId: string, type: "resolve" | "dismiss") {
    if (!schoolId) return;
    setBusyAlert(alertId);
    await fetch(`/api/school-admin/${schoolId}/alerts/${alertId}/${type}`, { method: "POST", headers: auth });
    setData((d) => (d ? { ...d, alerts: d.alerts.filter((a) => a.id !== alertId) } : d));
    setBusyAlert(null);
  }

  if (!schoolId && !loading) {
    return (
      <Card padding="lg" style={{ textAlign: "center", maxWidth: 480, margin: "60px auto" }}>
        <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, marginBottom: 8 }}>No school linked to your account</div>
        <Button onClick={() => router.push("/school/onboarding")}>Set up school</Button>
      </Card>
    );
  }

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: color.textFaint }}>Loading…</div>;
  if (error || !data) return <InlineError message={error || "Failed to load dashboard."} onRetry={schoolId ? () => fetchDashboard(schoolId) : undefined} />;

  const { school, principal, health_metrics: hm, alerts, engagement_heatmap: heat, activity_timeline, weekly_trends: trends, onboarding, recommendations } = data;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  return (
    <>
      <Head><title>{school.name} — Dashboard</title></Head>
      <div style={{ maxWidth: 1240, fontFamily: font.body }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>School Dashboard</h1>
          <Button variant="secondary" size="sm" disabled={refreshing} onClick={handleRefresh}>{refreshing ? "Refreshing…" : "Refresh metrics"}</Button>
        </div>
        <div style={{ fontSize: 13, color: color.textFaint, marginBottom: 22 }}>
          {school.name}{principal.last_login && ` · Last login ${new Date(principal.last_login).toLocaleString()}`}
        </div>

        {/* Onboarding checklist */}
        {onboarding.active && !hideOnboarding && (
          <Card padding="md" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Getting started · {onboarding.progress_pct}% complete</div>
              <button onClick={() => setHideOnboarding(true)} style={{ fontSize: 12, color: color.textFaint, background: "none", border: "none", cursor: "pointer" }}>Hide</button>
            </div>
            <ProgressBar value={onboarding.progress_pct} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
              {onboarding.checklist.map((item) => (
                <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span style={{ color: item.completed ? color.success.fg : color.textFainter }}>{item.completed ? "✓" : "○"}</span>
                  <span style={{ color: item.completed ? color.textFaint : color.ink, textDecoration: item.completed ? "line-through" : "none" }}>{item.item}</span>
                  {!item.completed && <a href={item.action_url} style={{ marginLeft: "auto", fontSize: 12, color: "#2B5FA8" }}>Go →</a>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Button size="sm" onClick={() => router.push("/school/onboarding")}>Continue setup</Button>
              <Button size="sm" variant="secondary" onClick={() => setHideOnboarding(true)}>Skip for now</Button>
            </div>
          </Card>
        )}

        {/* Health + metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20, marginBottom: 24 }}>
          <div style={{ background: color.chromeBg, borderRadius: 12, padding: 26, display: "flex", alignItems: "center", gap: 20 }}>
            <ThresholdRing pct={hm.performance.avg_student_score} threshold={80} size={90} dark />
            <div style={{ color: color.chromeText }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.chromeTextFaint, marginBottom: 6 }}>School health</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{criticalCount} critical alert{criticalCount !== 1 ? "s" : ""}</div>
              <div style={{ fontSize: 12.5, color: color.chromeTextMuted, marginTop: 2 }}>Resolve below to clear</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            <MetricTile value={hm.teachers.total} label="Teachers" trend={`${hm.teachers.trend >= 0 ? "+" : ""}${hm.teachers.trend} this month`} trendGood={hm.teachers.trend >= 0} href="/school/teachers" />
            <MetricTile value={hm.students.total} label="Students" trend={`${hm.students.trend >= 0 ? "+" : ""}${hm.students.trend} this month`} trendGood={hm.students.trend >= 0} href="/school/students" />
            <MetricTile value={`${hm.performance.avg_student_score}%`} label="Avg. student score" />
            <MetricTile value={hm.performance.at_risk_count} label="At-risk students" trend="vs last month" trendGood={false} href="/school/students?filter=at_risk" />
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Alerts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.map((a) => (
                <AlertRow key={a.id} alert={a} busy={busyAlert === a.id} onResolve={() => actOnAlert(a.id, "resolve")} onDismiss={() => actOnAlert(a.id, "dismiss")} />
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 24 }}>
          {/* Engagement */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Engagement this week</div>
            <Card padding="md" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
              <HeatRow label="Teachers active" pct={heat.teachers_active_pct} />
              <HeatRow label="Students active" pct={heat.students_active_pct} />
              <HeatRow label="Classes in use" pct={heat.classes_active_pct} />
              <HeatRow label="Assignments submitted" pct={heat.assignments_submission_pct} />
            </Card>
          </div>

          {/* Quick actions */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Quick actions</div>
            <Card padding="sm">
              <QuickAction label="Invite teachers" onClick={() => setShowInvite(true)} />
              <QuickAction label="Upload student roster (CSV)" onClick={() => setShowUpload(true)} />
              <QuickAction label="View at-risk students" onClick={() => router.push("/school/students?filter=at_risk")} />
              <QuickAction label="View classes" onClick={() => router.push("/school/classes")} />
            </Card>
          </div>
        </div>

        {/* Activity timeline */}
        {activity_timeline.length > 0 && (
          <Card padding="md" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Activity (last 24h)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activity_timeline.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, fontSize: 12.5 }}>
                  <span style={{ width: 56, flexShrink: 0, fontFamily: font.mono, color: color.textFaint }}>{new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span>{item.message}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Weekly trends */}
        {Object.keys(trends).length > 0 && (
          <Card padding="md" style={{ marginBottom: 24, overflowX: "auto" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Week-over-week trends</div>
            <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${color.border}` }}>
                  <th style={{ textAlign: "left", padding: "6px 10px", color: color.textFaint, fontWeight: 500 }}>Metric</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", color: color.textFaint, fontWeight: 500 }}>This week</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", color: color.textFaint, fontWeight: 500 }}>Last week</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", color: color.textFaint, fontWeight: 500 }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["Active teachers", "active_teachers", false],
                  ["Active students", "active_students", false],
                  ["Assignments set", "assignments_created", false],
                  ["Avg score", "avg_score", false],
                  ["At-risk count", "at_risk_count", true],
                ] as const).map(([label, key, invert]) => {
                  const row = trends[key];
                  const up = row ? row.change > 0 : false;
                  const isGood = row ? (invert ? !up : up) : false;
                  return (
                    <tr key={key} style={{ borderBottom: `1px solid ${color.borderMuted}` }}>
                      <td style={{ padding: "8px 10px", color: color.ink }}>{label}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: font.mono }}>{row?.this_week ?? "—"}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: font.mono, color: color.textFaint }}>{row?.last_week ?? "—"}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: font.mono, color: !row ? color.textFainter : row.change === 0 ? color.textFaint : isGood ? color.success.fg : color.danger.fg }}>
                        {row ? `${row.change > 0 ? "↑" : row.change < 0 ? "↓" : "→"} ${Math.abs(row.change_pct ?? row.change)}${row.change_pct !== undefined ? "%" : ""}` : "—"}
                      </td>
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
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Recommendations</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recommendations.map((rec) => (
                <div key={rec.id} style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{rec.title}</div>
                    {rec.description && <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>{rec.description}</div>}
                  </div>
                  {rec.action_url && <a href={rec.action_url} style={{ fontSize: 12, color: "#2B5FA8", flexShrink: 0 }}>View →</a>}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {showInvite && schoolId && <InviteModal schoolId={schoolId} token={token} onClose={() => setShowInvite(false)} />}
      {showUpload && schoolId && <UploadModal schoolId={schoolId} token={token} onClose={() => setShowUpload(false)} />}
    </>
  );
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 7, fontSize: 13.5, fontWeight: 500, background: "none", border: "none", color: color.ink, cursor: "pointer", textAlign: "left" }}>
      {label}
    </button>
  );
}
