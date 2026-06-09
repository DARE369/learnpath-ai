import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ArrowLeft, Search, Download, Users } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Button, Skeleton, Badge, EmptyState } from "../../../components/ui";
import ClassRosterTable from "../../../components/Teacher/ClassRosterTable";
import type { ClassDetail, RosterResponse, RosterStudent } from "../../../components/Teacher/types";

const PAGE_SIZE = 25;

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

  const viewStudent = (studentId: string) =>
    router.push(`/teacher/students/${studentId}?class=${encodeURIComponent(classId)}`);

  async function exportCsv() {
    if (!classId || !accessToken) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/teachers/classes/${classId}/roster?page=1&page_size=1000&sort_by=name`, { headers: auth });
      const data: RosterResponse = await res.json();
      const rows: RosterStudent[] = data.roster || [];
      const header = ["Name", "Email", "Progress %", "Score %", "Status", "Last active"];
      const csv = [
        header.join(","),
        ...rows.map((s) =>
          [s.name, s.email ?? "", s.progress, s.score, s.status, s.last_active ?? ""]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        ),
      ].join("\n");
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
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <button onClick={() => router.push("/teacher/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-accent-light hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </button>

        {loading && !detail ? (
          <Skeleton className="h-72 w-full" />
        ) : error ? (
          <Card><p className="text-sm text-error">{error}</p><Button className="mt-3" size="sm" variant="secondary" onClick={load}>Retry</Button></Card>
        ) : detail ? (
          <>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">{detail.class_name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/50">
                <span>{detail.student_count} students</span>
                <span>·</span><span>{detail.avg_score}% avg score</span>
                <span>·</span><span>{detail.avg_progress}% avg progress</span>
                <span>·</span><span>{detail.active_this_week} active this week</span>
                {detail.at_risk_count > 0 && <Badge tone="error">{detail.at_risk_count} at-risk</Badge>}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-4">
              <div className="space-y-4 lg:col-span-3">
                {/* Filters */}
                <Card padding="sm">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Select label="Show" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
                      options={[["all", "All students"], ["good", "On track"], ["caution", "Caution"], ["at_risk", "At-risk"]]} />
                    <Select label="Sort by" value={sortBy} onChange={(v) => { setSortBy(v); setPage(1); }}
                      options={[["progress", "Progress"], ["score", "Score"], ["activity", "Activity"], ["name", "Name"]]} />
                    <div>
                      <label className="mb-1 block text-xs text-white/40">Search</label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                          placeholder="Find a student…" className="input-field pl-9" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Roster */}
                {roster && roster.roster.length > 0 ? (
                  <>
                    <ClassRosterTable roster={roster.roster} onView={viewStudent} />
                    {roster.pagination.pages > 1 && (
                      <div className="flex items-center justify-center gap-3 text-sm">
                        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                        <span className="text-white/50">Page {roster.pagination.page} of {roster.pagination.pages}</span>
                        <Button size="sm" variant="secondary" disabled={page >= roster.pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState icon={<Users className="h-5 w-5" />} title="No students found" description="No students match your filters yet." />
                )}
              </div>

              {/* Quick actions */}
              <div>
                <Card padding="md">
                  <h3 className="mb-3 text-sm font-semibold text-white">Quick actions</h3>
                  <div className="space-y-2">
                    <Button fullWidth size="sm" variant="secondary" onClick={exportCsv} loading={exporting} leftIcon={<Download className="h-4 w-4" />}>
                      Export roster (CSV)
                    </Button>
                    <Button fullWidth size="sm" variant="ghost" disabled title="Coming soon">Send class message</Button>
                    <Button fullWidth size="sm" variant="secondary" href={`/teacher/assignments?class=${classId}`}>Assign homework</Button>
                    <Button fullWidth size="sm" variant="ghost" disabled title="Coming soon">Generate report</Button>
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

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-white/40">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
