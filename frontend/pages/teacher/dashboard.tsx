import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../../hooks/useAuth";
import type { TeacherDashboard } from "../../components/Teacher/types";
import { timeAgo } from "../../components/Teacher/types";
import { Card, InlineError, Badge } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [data, setData] = useState<TeacherDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teachers/dashboard", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
    } catch {
      setError("Couldn't load your dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = (user?.fullName || user?.email || "").split(/[\s@]/)[0];
  const viewClass = (classId: string) => router.push(`/teacher/class/${classId}`);

  return (
    <>
      <Head><title>Teacher Dashboard — LearnPath AI</title></Head>
      <div style={{ maxWidth: 1180, fontFamily: font.body }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>Teacher Dashboard</h1>
        <p style={{ fontSize: 13.5, color: color.textFaint, marginTop: 4, marginBottom: 22 }}>{firstName ? `Welcome back, ${firstName}. ` : ""}Manage your classes and students at a glance.</p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: color.textFaint }}>Loading…</div>
        ) : error ? (
          <InlineError message={error} onRetry={load} />
        ) : data ? (
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>At-risk students — needs attention today</div>
              <Card padding="md" style={{ marginBottom: 24 }}>
                {data.alerts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: color.success.fg }}>No at-risk students</div>
                    <div style={{ fontSize: 12.5, color: color.textFaint, marginTop: 4 }}>Everyone&apos;s on track right now.</div>
                  </div>
                ) : (
                  data.alerts.slice(0, 5).map((a, i) => (
                    <div key={a.alert_id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < Math.min(data.alerts.length, 5) - 1 ? `1px solid ${color.borderMuted}` : "none" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: color.surfaceElevated, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600, color: color.inkSoft, flexShrink: 0 }}>{a.student_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.student_name} <span style={{ fontWeight: 400, color: color.textFaint }}>· {a.class_name}</span></div>
                        <div style={{ fontSize: 12, color: color.danger.fg, marginTop: 2 }}>{a.reason === "no_attempts" ? "Zero attempts" : a.reason === "low_score" ? `Score ${a.current_score}%` : `Inactive ${a.days_inactive}d`}</div>
                      </div>
                      <button onClick={() => viewClass(a.class_id)} style={{ padding: "6px 12px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: "1px solid #2B3A67", background: "#fff", color: "#2B3A67", cursor: "pointer", flexShrink: 0 }}>View</button>
                    </div>
                  ))
                )}
              </Card>

              <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Recent activity</div>
              <Card padding="md">
                {data.recent_activity.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>No recent activity</div>
                    <div style={{ fontSize: 12.5, color: color.textFaint, marginTop: 4 }}>Activity from your students will show up here.</div>
                  </div>
                ) : (
                  data.recent_activity.slice(0, 15).map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < Math.min(data.recent_activity.length, 15) - 1 ? `1px solid ${color.borderMuted}` : "none", fontSize: 13 }}>
                      <span style={{ flex: 1 }}>{a.description}</span>
                      <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.textFaint, flexShrink: 0 }}>{timeAgo(a.occurred_at)}</span>
                    </div>
                  ))
                )}
              </Card>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Your classes</div>
              {data.classes.length === 0 ? (
                <Card padding="md" style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>No classes yet</div>
                  <div style={{ fontSize: 12.5, color: color.textFaint, marginTop: 4 }}>Create your first class to start tracking students.</div>
                </Card>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {data.classes.map((c) => (
                    <Card key={c.class_id} padding="md" style={{ cursor: "pointer" }} onClick={() => viewClass(c.class_id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{c.class_name}</div>
                        {c.at_risk_count > 0 && <Badge tone="danger">{c.at_risk_count} at-risk</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: color.textFaint, marginBottom: 8 }}>{c.subject || "—"} · {c.student_count} students</div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span>Avg score: <b>{c.avg_score}%</b></span>
                        <span>Active this week: <b>{c.active_this_week}</b></span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
                <Card padding="md"><div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600 }}>{data.metrics.total_students}</div><div style={{ fontSize: 11.5, color: color.textFaint, marginTop: 4 }}>Total students</div></Card>
                <Card padding="md"><div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600 }}>{data.metrics.avg_score}%</div><div style={{ fontSize: 11.5, color: color.textFaint, marginTop: 4 }}>Average score</div></Card>
                <Card padding="md"><div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600 }}>{data.metrics.active_this_week}</div><div style={{ fontSize: 11.5, color: color.textFaint, marginTop: 4 }}>Active this week</div></Card>
                <Card padding="md"><div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600 }}>{data.metrics.completion_rate}%</div><div style={{ fontSize: 11.5, color: color.textFaint, marginTop: 4 }}>Completion rate</div></Card>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Quick actions</div>
              <Card padding="sm">
                <QuickAction label="Create assignment" onClick={() => router.push("/teacher/assignments")} />
                <QuickAction label="Message a student" soon />
                <QuickAction label="Assign content" soon />
                <QuickAction label="View analytics" onClick={() => router.push("/teacher/analytics")} />
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function QuickAction({ label, onClick, soon }: { label: string; onClick?: () => void; soon?: boolean }) {
  return (
    <button onClick={onClick} disabled={soon} title={soon ? "Coming soon" : undefined} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderRadius: 7, fontSize: 13.5, background: "none", border: "none", color: soon ? color.textFainter : color.ink, cursor: soon ? "not-allowed" : "pointer", textAlign: "left" }}>
      <span>{label}</span>
      {soon && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", color: color.textFainter }}>soon</span>}
    </button>
  );
}
