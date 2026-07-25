import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../../../hooks/useAuth";
import { STATUS_LABEL, STATUS_TONE, timeAgo, type StudentProfile } from "../../../components/Teacher/types";
import { Card, Badge, ProgressBar } from "../../../ui-v2/primitives";
import { color, font } from "../../../ui-v2/tokens";

function badgeTone(t: "error" | "success" | "warning"): "danger" | "success" | "warning" {
  return t === "error" ? "danger" : t;
}

export default function StudentProfilePage() {
  const router = useRouter();
  const studentId = typeof router.query.studentId === "string" ? router.query.studentId : "";
  const classId = typeof router.query.class === "string" ? router.query.class : "";
  const { accessToken } = useAuth();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !classId || !accessToken) return;
    setLoading(true);
    fetch(`/api/teachers/students/${studentId}?class_id=${encodeURIComponent(classId)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProfile)
      .catch(() => setError("Couldn't load this student."))
      .finally(() => setLoading(false));
  }, [studentId, classId, accessToken]);

  const backToClass = () => router.push(`/teacher/class/${classId}`);

  return (
    <>
      <Head><title>{profile?.student.name || "Student"} — LearnPath AI</title></Head>
      <div style={{ maxWidth: 980, fontFamily: font.body }}>
        <button onClick={backToClass} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#2B5FA8", background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}>← Back to class</button>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: color.textFaint }}>Loading…</div>
        ) : error || !profile ? (
          <Card padding="lg" style={{ textAlign: "center" }}>
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Student not found</div>
            <div style={{ fontSize: 13.5, color: color.textFaint }}>{error || "No data for this student."}</div>
          </Card>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 26, margin: 0 }}>{profile.student.name}</h1>
              <Badge tone={badgeTone(STATUS_TONE[profile.enrollment.status])}>{STATUS_LABEL[profile.enrollment.status]}</Badge>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13, color: color.textFaint, marginBottom: 22 }}>
              {profile.student.email && <span>{profile.student.email}</span>}
              <span>· {profile.enrollment.class_name}</span>
              {profile.enrollment.enrolled_at && <span>· Enrolled {new Date(profile.enrollment.enrolled_at).toLocaleDateString()}</span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
              <div>
                <Card padding="md" style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Performance</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Metric label="Current score" value={`${profile.performance.current_score}%`} pct={profile.performance.current_score} />
                    <Metric label="Path progress" value={`${profile.performance.progress_percent}%`} pct={profile.performance.progress_percent} tone="success" />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: color.textFaint }}>Time invested</span><b>{profile.performance.time_invested_hours}h</b></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: color.textFaint }}>Last activity</span><b>{timeAgo(profile.performance.last_active)}</b></div>
                  </div>
                </Card>

                <Card padding="md" style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Score breakdown</div>
                  <div style={{ fontSize: 11.5, color: color.textFaint, marginBottom: 14 }}>By concept · lowest first</div>
                  {profile.score_breakdown.length === 0 ? (
                    <p style={{ fontSize: 13, color: color.textFaint }}>No concept data yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {profile.score_breakdown.slice(0, 8).map((c, i) => (
                        <div key={c.name}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span>{c.name}{i === 0 && <span style={{ marginLeft: 6 }}><Badge tone="warning">focus area</Badge></span>}</span>
                            <span style={{ color: color.textFaint }}>{c.accuracy}%</span>
                          </div>
                          <ProgressBar value={c.accuracy} tone={c.accuracy < 50 ? "danger" : c.accuracy < 70 ? "warning" : "success"} />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card padding="md">
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Recent activity</div>
                  {profile.activity_timeline.length === 0 ? (
                    <p style={{ fontSize: 13, color: color.textFaint }}>No recent activity.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {profile.activity_timeline.map((t, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <span style={{ color: t.passed ? color.success.fg : color.danger.fg }}>{t.passed ? "✓" : "✗"}</span>
                          <div>
                            <div style={{ fontSize: 13 }}>{t.title}{t.score != null && ` (${t.score}%)`}</div>
                            <div style={{ fontSize: 11.5, color: color.textFaint }}>{timeAgo(t.occurred_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <div>
                <Card padding="md" style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Actions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button onClick={backToClass} style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", cursor: "pointer" }}>Back to class</button>
                    <button disabled title="Coming soon" style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 7, border: "none", background: "none", color: color.textFainter, cursor: "not-allowed", textAlign: "left" }}>Send message</button>
                    <button disabled title="Coming soon" style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 7, border: "none", background: "none", color: color.textFainter, cursor: "not-allowed", textAlign: "left" }}>Assign remedial</button>
                    <button disabled title="Coming soon" style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 7, border: "none", background: "none", color: color.textFainter, cursor: "not-allowed", textAlign: "left" }}>Create quiz</button>
                    <button disabled title="Coming soon" style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 7, border: "none", background: "none", color: color.textFainter, cursor: "not-allowed", textAlign: "left" }}>Flag for parent</button>
                  </div>
                </Card>

                <Card padding="md">
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Weak concepts</div>
                  {profile.weak_concepts.length === 0 ? (
                    <p style={{ fontSize: 13, color: color.textFaint }}>No weak concepts flagged.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {profile.weak_concepts.map((c) => (
                        <div key={c.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span>{c.name}</span>
                          <span style={{ fontWeight: 600, color: color.danger.fg }}>{c.accuracy}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Metric({ label, value, pct, tone }: { label: string; value: string; pct: number; tone?: "success" }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}><span style={{ color: color.textFaint }}>{label}</span><b>{value}</b></div>
      <ProgressBar value={pct} tone={tone || "accent"} />
    </div>
  );
}
