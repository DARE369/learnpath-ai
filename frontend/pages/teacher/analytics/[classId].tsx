import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { ArrowLeft, ArrowUp, ArrowDown, Minus, Download, Printer, TrendingDown, Compass } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Button, Skeleton, Badge, SectionHeader, EmptyState } from "../../../components/ui";
import type { ClassAnalytics } from "../../../components/Teacher/types";

const C = { accent: "#6366f1", success: "#10b981", warning: "#f59e0b", error: "#ef4444", info: "#38bdf8" };
const DIST_COLORS = [C.error, C.warning, C.info, C.success];

function isoDaysAgo(weeks: number) {
  const d = new Date();
  d.setDate(d.getDate() - weeks * 7);
  return d.toISOString().slice(0, 10);
}

export default function ClassAnalyticsPage() {
  const router = useRouter();
  const classId = typeof router.query.classId === "string" ? router.query.classId : "";
  const { accessToken } = useAuth();

  const [data, setData] = useState<ClassAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState(isoDaysAgo(8));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState("absolute");

  const load = useCallback(async () => {
    if (!classId || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ date_from: from, date_to: to, view });
      const res = await fetch(`/api/teachers/classes/${classId}/analytics?${p}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("Couldn't load analytics.");
    } finally {
      setLoading(false);
    }
  }, [classId, accessToken, from, to, view]);

  useEffect(() => { void load(); }, [load]);

  const distData = useMemo(() => data ? [
    { name: "At-risk (<50)", value: data.distribution.at_risk },
    { name: "Developing (50–70)", value: data.distribution.developing },
    { name: "Proficient (70–85)", value: data.distribution.proficient },
    { name: "Advanced (85+)", value: data.distribution.advanced },
  ] : [], [data]);

  function exportCsv() {
    if (!data) return;
    const lines = ["Metric,Value"];
    data.score_breakdown.forEach((b) => lines.push(`"${b.topic} score","${b.score}%"`));
    lines.push(`"At-risk","${data.distribution.at_risk}"`, `"Developing","${data.distribution.developing}"`,
      `"Proficient","${data.distribution.proficient}"`, `"Advanced","${data.distribution.advanced}"`);
    lines.push(`"Active this week","${data.engagement.active_this_week}/${data.engagement.total_students}"`);
    lines.push(`"Assignment submission %","${data.engagement.assignment_submission_percent ?? "N/A"}"`);
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${data.class_name}-analytics.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Head><title>{data?.class_name || "Analytics"} — LearnPath AI</title></Head>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <button onClick={() => router.push("/teacher/analytics")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-accent-light hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Analytics
        </button>

        {loading && !data ? (
          <Skeleton className="h-80 w-full" />
        ) : error || !data ? (
          <EmptyState title="Couldn't load" description={error || "No data."} />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">{data.class_name}</h1>
                <p className="mt-1 text-sm text-white/40">{data.student_count} students · {data.date_range.from} → {data.date_range.to}</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field" /></Field>
                <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-field" /></Field>
                <Field label="View">
                  <select value={view} onChange={(e) => setView(e.target.value)} className="input-field">
                    <option value="absolute">Absolute</option>
                    <option value="vs_my_classes">vs my classes</option>
                  </select>
                </Field>
                <Button size="sm" variant="secondary" onClick={exportCsv} leftIcon={<Download className="h-4 w-4" />}>CSV</Button>
                <Button size="sm" variant="secondary" onClick={() => window.print()} leftIcon={<Printer className="h-4 w-4" />}>Print</Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Score breakdown */}
              <Card padding="md">
                <SectionHeader title="Score by topic" />
                {data.score_breakdown.length === 0 ? <p className="text-sm text-white/40">No quiz data in this range.</p> : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.score_breakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="topic" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                        <Bar dataKey="score" fill={C.accent} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-1">
                      {data.score_trends.map((t) => (
                        <div key={t.topic} className="flex items-center justify-between text-sm">
                          <span className="text-white/60">{t.topic}</span>
                          <span className="flex items-center gap-1.5 tabular-nums">
                            <span className="text-white">{t.current}%</span>
                            {t.trend != null && (
                              <span className={`inline-flex items-center ${t.trend > 0 ? "text-success" : t.trend < 0 ? "text-error" : "text-white/40"}`}>
                                {t.trend > 0 ? <ArrowUp className="h-3 w-3" /> : t.trend < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                {Math.abs(t.trend)}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>

              {/* Distribution */}
              <Card padding="md">
                <SectionHeader title="Student distribution" />
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={distData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                      {distData.map((_, i) => <Cell key={i} fill={DIST_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {distData.map((d, i) => (
                    <span key={d.name} className="flex items-center gap-1.5 text-white/60">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DIST_COLORS[i] }} />{d.name}: <span className="text-white">{d.value}</span>
                    </span>
                  ))}
                </div>
              </Card>

              {/* Weekly trend */}
              <Card padding="md" className="lg:col-span-2">
                <SectionHeader title="Weekly score trend" />
                {data.weekly_trend.length < 2 ? <p className="text-sm text-white/40">Not enough data to chart a trend yet.</p> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.weekly_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                      <Line type="monotone" dataKey="avg_score" stroke={C.accent} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                {data.forecast.estimated_date ? (
                  <p className="mt-2 text-sm text-white/50">Forecast: ~100% by <span className="text-white">{data.forecast.estimated_date}</span> ({data.forecast.confidence}% confidence)</p>
                ) : (
                  <p className="mt-2 text-sm text-white/40">{data.forecast.note}</p>
                )}
              </Card>

              {/* Engagement */}
              <Card padding="md">
                <SectionHeader title="Engagement" />
                <div className="space-y-2.5 text-sm">
                  <Row label="Active this week" value={`${data.engagement.active_this_week}/${data.engagement.total_students}`} />
                  <Row label="Assignment submission" value={data.engagement.assignment_submission_percent != null ? `${data.engagement.assignment_submission_percent}%` : "N/A"} />
                  <Row label="Video completion" value="N/A" muted />
                  <Row label="Logins / week" value="N/A" muted />
                </div>
              </Card>

              {/* At-risk forecast */}
              <Card padding="md">
                <SectionHeader title="At-risk forecast" />
                {data.at_risk.length === 0 ? <p className="text-sm text-white/40">No students forecast to drop below 60%.</p> : (
                  <ul className="space-y-2.5">
                    {data.at_risk.map((s) => (
                      <li key={s.student_id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 text-white/80"><TrendingDown className="h-4 w-4 text-error" />{s.student_name}</span>
                        <span className="text-white/50">{s.current_score}% → <span className="text-error font-semibold">{s.predicted_score}%</span> · {s.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Recommendations */}
              {data.recommendations.length > 0 && (
                <Card padding="md" className="lg:col-span-2">
                  <SectionHeader title="Recommendations" subtitle="Weakest topics — find content to assign" />
                  <div className="flex flex-wrap gap-3">
                    {data.recommendations.map((r) => (
                      <div key={r.topic} className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3">
                        <Badge tone="warning">{r.current_score}%</Badge>
                        <span className="text-sm text-white">{r.topic}</span>
                        <Button size="sm" variant="ghost" href={`/explore?q=${encodeURIComponent(r.topic)}&autorun=1`} leftIcon={<Compass className="h-3.5 w-3.5" />}>Find content</Button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Comparison */}
              {view === "vs_my_classes" && data.comparison.classes && (
                <Card padding="md" className="lg:col-span-2">
                  <SectionHeader title="Vs your other classes" />
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.comparison.classes}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="class_name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                      <Bar dataKey="avg_score" radius={[6, 6, 0, 0]}>
                        {data.comparison.classes.map((c, i) => <Cell key={i} fill={c.is_current ? C.accent : "rgba(255,255,255,0.2)"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs text-white/40">{label}</label>{children}</div>;
}
function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span className={`font-semibold tabular-nums ${muted ? "text-white/30" : "text-white"}`}>{value}</span>
    </div>
  );
}
