import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ArrowLeft, Mail, Clock, Target, CheckCircle2, XCircle, TrendingDown } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Button, Badge, ProgressBar, SectionHeader, Skeleton, EmptyState } from "../../../components/ui";
import { StudentProfile, STATUS_LABEL, STATUS_TONE, timeAgo } from "../../../components/Teacher/types";

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
    fetch(`/api/teachers/students/${studentId}?class_id=${encodeURIComponent(classId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProfile)
      .catch(() => setError("Couldn't load this student."))
      .finally(() => setLoading(false));
  }, [studentId, classId, accessToken]);

  const backToClass = () => router.push(`/teacher/class/${classId}`);

  return (
    <>
      <Head><title>{profile?.student.name || "Student"} — LearnPath AI</title></Head>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <button onClick={backToClass} className="mb-4 inline-flex items-center gap-1.5 text-sm text-accent-light hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to class
        </button>

        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : error || !profile ? (
          <EmptyState title="Student not found" description={error || "No data for this student."} />
        ) : (
          <>
            {/* Header */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{profile.student.name}</h1>
                <Badge tone={STATUS_TONE[profile.enrollment.status]}>{STATUS_LABEL[profile.enrollment.status]}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/50">
                {profile.student.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{profile.student.email}</span>}
                <span>·</span><span>{profile.enrollment.class_name}</span>
                {profile.enrollment.enrolled_at && <><span>·</span><span>Enrolled {new Date(profile.enrollment.enrolled_at).toLocaleDateString()}</span></>}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                {/* Performance */}
                <Card padding="md">
                  <SectionHeader title="Performance" />
                  <div className="space-y-4">
                    <Metric label="Current score" value={`${profile.performance.current_score}%`} pct={profile.performance.current_score} />
                    <Metric label="Path progress" value={`${profile.performance.progress_percent}%`} pct={profile.performance.progress_percent} color="success" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 text-white/50"><Clock className="h-4 w-4" />Time invested</span>
                      <span className="font-semibold text-white">{profile.performance.time_invested_hours}h</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Last activity</span>
                      <span className="font-semibold text-white">{timeAgo(profile.performance.last_active)}</span>
                    </div>
                  </div>
                </Card>

                {/* Score breakdown */}
                <Card padding="md">
                  <SectionHeader title="Score breakdown" subtitle="By concept · lowest first" />
                  {profile.score_breakdown.length === 0 ? (
                    <p className="text-sm text-white/40">No concept data yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {profile.score_breakdown.slice(0, 8).map((c, i) => (
                        <div key={c.name}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-white/70">
                              {c.name}{i === 0 && <Badge tone="warning" className="ml-1">focus area</Badge>}
                            </span>
                            <span className="tabular-nums text-white/50">{c.accuracy}%</span>
                          </div>
                          <ProgressBar value={c.accuracy} color={c.accuracy < 50 ? "error" : c.accuracy < 70 ? "warning" : "success"} size="sm" />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Activity timeline */}
                <Card padding="md">
                  <SectionHeader title="Recent activity" />
                  {profile.activity_timeline.length === 0 ? (
                    <p className="text-sm text-white/40">No recent activity.</p>
                  ) : (
                    <ul className="space-y-3">
                      {profile.activity_timeline.map((t, i) => (
                        <li key={i} className="flex items-start gap-3">
                          {t.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 text-error" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white">{t.title}{t.score != null && ` (${t.score}%)`}</p>
                            <p className="text-xs text-white/40">{timeAgo(t.occurred_at)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card padding="md">
                  <h3 className="mb-3 text-sm font-semibold text-white">Actions</h3>
                  <div className="space-y-2">
                    <Button fullWidth size="sm" variant="secondary" onClick={backToClass}>Back to class</Button>
                    <Button fullWidth size="sm" variant="ghost" disabled title="Coming soon">Send message</Button>
                    <Button fullWidth size="sm" variant="ghost" disabled title="Coming soon">Assign remedial</Button>
                    <Button fullWidth size="sm" variant="ghost" disabled title="Coming soon">Create quiz</Button>
                    <Button fullWidth size="sm" variant="ghost" disabled title="Coming soon">Flag for parent</Button>
                  </div>
                </Card>

                <Card padding="md">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><TrendingDown className="h-4 w-4 text-error" />Weak concepts</h3>
                  {profile.weak_concepts.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm text-white/40"><Target className="h-4 w-4" />No weak concepts flagged.</p>
                  ) : (
                    <ul className="space-y-2">
                      {profile.weak_concepts.map((c) => (
                        <li key={c.name} className="flex items-center justify-between text-sm">
                          <span className="text-white/70">{c.name}</span>
                          <span className="font-semibold text-error tabular-nums">{c.accuracy}%</span>
                        </li>
                      ))}
                    </ul>
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

function Metric({ label, value, pct, color }: { label: string; value: string; pct: number; color?: "accent" | "success" }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-white/50">{label}</span>
        <span className="font-semibold text-white tabular-nums">{value}</span>
      </div>
      <ProgressBar value={pct} color={color || "accent"} />
    </div>
  );
}
