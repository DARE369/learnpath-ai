import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../../../hooks/useAuth";
import type { ClassDetail, RosterResponse, RosterStudent } from "../../../components/Teacher/types";
import { STATUS_LABEL, STATUS_TONE } from "../../../components/Teacher/types";
import { Card, Badge, InlineError, Select } from "../../../ui-v2/primitives";
import { color, font } from "../../../ui-v2/tokens";

const PAGE_SIZE = 25;

function badgeTone(t: "error" | "success" | "warning"): "danger" | "success" | "warning" {
  return t === "error" ? "danger" : t;
}

export default function ClassDetailPage() {
  const router = useRouter();
  const classId = typeof router.query.id === "string" ? router.query.id : "";
  const { accessToken } = useAuth();

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("progress");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const load = useCallback(async () => {
    if (!classId || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sort_by: sortBy, page: String(page), page_size: String(PAGE_SIZE) });
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      const [d, r] = await Promise.all([
        fetch(`/api/teachers/classes/${classId}`, { headers: auth }),
        fetch(`/api/teachers/classes/${classId}/roster?${params}`, { headers: auth }),
      ]);
      if (!d.ok || !r.ok) throw new Error();
      setDetail(await d.json());
      setRoster(await r.json());
    } catch {
      setError("Couldn't load this class.");
    } finally {
      setLoading(false);
    }
  }, [classId, accessToken, status, sortBy, search, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const viewStudent = (studentId: string) => router.push(`/teacher/students/${studentId}?class=${encodeURIComponent(classId)}`);

  async function exportCsv() {
    if (!classId || !accessToken) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/teachers/classes/${classId}/roster?page=1&page_size=1000&sort_by=name`, { headers: auth });
      const data: RosterResponse = await res.json();
      const rows: RosterStudent[] = data.roster || [];
      const header = ["Name", "Email", "Progress %", "Score %", "Status", "Last active"];
      const csv = [header.join(","), ...rows.map((s) => [s.name, s.email ?? "", s.progress, s.score, s.status, s.last_active ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${detail?.class_name || "roster"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Head><title>{detail?.class_name || "Class"} — LearnPath AI</title></Head>
      <div style={{ maxWidth: 1180, fontFamily: font.body }}>
        <Link href="/teacher/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#2B5FA8", textDecoration: "none", marginBottom: 16 }}>← Dashboard</Link>

        {loading && !detail ? (
          <div style={{ textAlign: "center", padding: 60, color: color.textFaint }}>Loading…</div>
        ) : error ? (
          <InlineError message={error} onRetry={load} />
        ) : detail ? (
          <>
            <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 26, margin: "0 0 6px" }}>{detail.class_name}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 13, color: color.textFaint, marginBottom: 20 }}>
              <span>{detail.student_count} students</span>·<span>{detail.avg_score}% avg score</span>·<span>{detail.avg_progress}% avg progress</span>·<span>{detail.active_this_week} active this week</span>
              {detail.at_risk_count > 0 && <Badge tone="danger">{detail.at_risk_count} at-risk</Badge>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 20 }}>
              <div>
                <Card padding="sm" style={{ marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    <Select label="Show" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                      <option value="all">All students</option><option value="good">On track</option><option value="caution">Caution</option><option value="at_risk">At-risk</option>
                    </Select>
                    <Select label="Sort by" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
                      <option value="progress">Progress</option><option value="score">Score</option><option value="activity">Activity</option><option value="name">Name</option>
                    </Select>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Search</div>
                      <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Find a student…" style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #CFCBC0", borderRadius: 6 }} />
                    </div>
                  </div>
                </Card>

                {roster && roster.roster.length > 0 ? (
                  <>
                    <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, padding: "11px 18px", fontSize: 11, fontWeight: 600, color: color.textFaint, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${color.border}` }}>
                        <div>Student</div><div>Progress</div><div>Score</div><div>Status</div><div>Last active</div>
                      </div>
                      {roster.roster.map((s) => (
                        <div key={s.student_id} onClick={() => viewStudent(s.student_id)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, padding: "11px 18px", alignItems: "center", borderBottom: `1px solid ${color.borderMuted}`, fontSize: 13.5, cursor: "pointer" }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            <div style={{ fontSize: 11.5, color: color.textFaint }}>{s.email}</div>
                          </div>
                          <div style={{ fontFamily: font.mono, fontSize: 13 }}>{s.progress}%</div>
                          <div style={{ fontFamily: font.mono, fontSize: 13, color: s.score < 60 ? color.danger.fg : color.ink }}>{s.score}%</div>
                          <div><Badge tone={badgeTone(STATUS_TONE[s.status])}>{STATUS_LABEL[s.status]}</Badge></div>
                          <div style={{ fontSize: 12, color: color.textFaint }}>{s.last_active ?? "Never"}</div>
                        </div>
                      ))}
                    </div>
                    {roster.pagination.pages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 13, marginTop: 14 }}>
                        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: "6px 12px", border: `1px solid ${color.border}`, borderRadius: 6, background: "#fff", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>Previous</button>
                        <span style={{ color: color.textFaint }}>Page {roster.pagination.page} of {roster.pagination.pages}</span>
                        <button disabled={page >= roster.pagination.pages} onClick={() => setPage((p) => p + 1)} style={{ padding: "6px 12px", border: `1px solid ${color.border}`, borderRadius: 6, background: "#fff", cursor: page >= roster.pagination.pages ? "not-allowed" : "pointer", opacity: page >= roster.pagination.pages ? 0.4 : 1 }}>Next</button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 10, padding: 40, textAlign: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>No students found</div>
                    <div style={{ fontSize: 12.5, color: color.textFaint, marginTop: 4 }}>No students match your filters yet.</div>
                  </div>
                )}
              </div>

              <div>
                <Card padding="md">
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Quick actions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button onClick={exportCsv} disabled={exporting} style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", color: color.ink, cursor: "pointer" }}>{exporting ? "Exporting…" : "Export roster (CSV)"}</button>
                    <button disabled title="Coming soon" style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 7, border: "none", background: "none", color: color.textFainter, cursor: "not-allowed", textAlign: "left" }}>Send class message</button>
                    <Link href={`/teacher/analytics/${classId}`} style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", color: color.ink, textDecoration: "none", textAlign: "center" }}>View analytics</Link>
                    <Link href={`/teacher/assignments?class=${classId}`} style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", color: color.ink, textDecoration: "none", textAlign: "center" }}>Assign homework</Link>
                    <button disabled title="Coming soon" style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 7, border: "none", background: "none", color: color.textFainter, cursor: "not-allowed", textAlign: "left" }}>Generate report</button>
                  </div>
                </Card>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
