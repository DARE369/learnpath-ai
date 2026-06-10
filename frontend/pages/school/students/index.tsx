import React, { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  AlertTriangle,
  CheckSquare,
  Download,
  GraduationCap,
  MoreHorizontal,
  RefreshCw,
  Search,
  Square,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../../components/ui";
import SchoolLayout from "../../../components/School/SchoolLayout";

// ── Types ──────────────────────────────────────────────────────────────────

interface StudentRow {
  student_id: string;
  name: string;
  email: string;
  grade: number | null;
  classes_display: string;
  status: string;
  enrollment_status: string;
  score: number;
  risk_level: string;
  last_active: string | null;
}

interface Pagination { page: number; page_size: number; total: number; pages: number }

const RISK_BADGE: Record<string, string> = {
  none: "text-white/30",
  low: "text-blue-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

// ── Main ───────────────────────────────────────────────────────────────────

export default function StudentsListPage() {
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [uploadResult, setUploadResult] = useState<{ created: number; errors: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const sid = typeof window !== "undefined"
      ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id")
      : null;
    if (sid) setSchoolId(sid);
  }, []);

  const fetchStudents = useCallback(async (sid: string, pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), page_size: "50" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (riskFilter) params.set("risk", riskFilter);
      if (gradeFilter) params.set("grade", gradeFilter);
      const res = await fetch(`/api/school-admin/${sid}/students?${params}`, { headers: auth });
      if (res.ok) {
        const d = await res.json();
        setStudents(d.students ?? []);
        setPagination(d.pagination ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, riskFilter, gradeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (schoolId) { setPage(1); fetchStudents(schoolId, 1); }
  }, [schoolId, search, statusFilter, riskFilter, gradeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deactivate(studentId: string) {
    if (!schoolId || !confirm("Deactivate this student?")) return;
    setBusyId(studentId);
    await fetch(`/api/school-admin/${schoolId}/students/${studentId}/deactivate`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Admin deactivation" }),
    });
    setBusyId(null);
    setActionMenu(null);
    fetchStudents(schoolId, page);
  }

  async function reactivate(studentId: string) {
    if (!schoolId) return;
    setBusyId(studentId);
    await fetch(`/api/school-admin/${schoolId}/students/${studentId}/reactivate`, {
      method: "POST", headers: auth,
    });
    setBusyId(null);
    setActionMenu(null);
    fetchStudents(schoolId, page);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (selected.size === students.length) setSelected(new Set());
    else setSelected(new Set(students.map((s) => s.student_id)));
  }

  async function bulkDeactivate() {
    if (!schoolId || selected.size === 0 || !confirm(`Deactivate ${selected.size} students?`)) return;
    await fetch(`/api/school-admin/${schoolId}/students/bulk-deactivate`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setSelected(new Set());
    fetchStudents(schoolId, page);
  }

  async function exportCsv() {
    if (!schoolId) return;
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/school-admin/${schoolId}/students/export?${params}`, { headers: auth });
    if (!res.ok) return;
    const text = await res.text();
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) || "");
    reader.readAsText(f);
  }

  async function uploadCsv() {
    if (!schoolId || !csvText) return;
    setUploading(true);
    const res = await fetch(`/api/school-admin/${schoolId}/upload-students`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ csv_text: csvText }),
    });
    const d = await res.json();
    setUploadResult({ created: d.created ?? 0, errors: (d.errors ?? []).length });
    setUploading(false);
    fetchStudents(schoolId, 1);
  }

  return (
    <SchoolLayout>
      <Head><title>Students — School Admin</title></Head>

      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Students</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Bulk upload
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
            <option value="">All risk levels</option>
            <option value="none">No risk</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
            <option value="">All grades</option>
            {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
          <button onClick={() => schoolId && fetchStudents(schoolId, page)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </Card>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-indigo-600/15 px-4 py-2">
          <span className="text-xs text-indigo-300">{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={bulkDeactivate}>Bulk deactivate</Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-white/40 hover:text-white">Clear</button>
        </div>
      )}

      {/* Upload panel */}
      {showUpload && (
        <Card padding="md" className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Bulk Upload Students</h3>
            <button onClick={() => { setShowUpload(false); setCsvText(""); setUploadResult(null); }}>
              <X className="h-4 w-4 text-white/30" />
            </button>
          </div>
          {uploadResult ? (
            <div className="space-y-2">
              <p className="text-sm text-emerald-400">{uploadResult.created} students created ✓</p>
              {uploadResult.errors > 0 && <p className="text-xs text-amber-400">{uploadResult.errors} rows had errors</p>}
              <Button size="sm" onClick={() => { setShowUpload(false); setCsvText(""); setUploadResult(null); }}>Close</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-2.5 text-sm text-white/40 hover:border-indigo-500 hover:text-white/70">
                <Upload className="h-4 w-4" />
                {csvText ? "CSV loaded" : "Select CSV file"}
              </button>
              <Button size="sm" onClick={uploadCsv} disabled={uploading || !csvText}>
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : students.length === 0 ? (
        <Card padding="md">
          <div className="flex flex-col items-center gap-3 py-8">
            <GraduationCap className="h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">No students found</p>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-4 py-3 text-left">
                    <button onClick={toggleAll} className="text-white/40 hover:text-white">
                      {selected.size === students.length && students.length > 0
                        ? <CheckSquare className="h-4 w-4" />
                        : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Classes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white/50">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Risk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Last active</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/50">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map((s) => (
                  <tr key={s.student_id} className={`transition-colors hover:bg-white/[0.02] ${selected.has(s.student_id) ? "bg-indigo-600/5" : ""}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(s.student_id)} className="text-white/40 hover:text-white">
                        {selected.has(s.student_id) ? <CheckSquare className="h-4 w-4 text-indigo-400" /> : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/school/students/${s.student_id}`} className="font-medium text-white hover:text-indigo-300">
                        {s.name}
                      </Link>
                      <p className="text-xs text-white/30">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/60">{s.grade ? `Grade ${s.grade}` : "—"}</td>
                    <td className="px-4 py-3 max-w-32 truncate text-xs text-white/50">{s.classes_display}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        s.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}>{s.enrollment_status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium tabular-nums ${s.score < 60 ? "text-red-400" : s.score < 75 ? "text-amber-400" : "text-emerald-400"}`}>
                        {s.score}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.risk_level !== "none" && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className={`h-3 w-3 ${RISK_BADGE[s.risk_level]}`} />
                          <span className={`text-xs capitalize ${RISK_BADGE[s.risk_level]}`}>{s.risk_level}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40">{s.last_active ?? "Never"}</td>
                    <td className="relative px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link href={`/school/students/${s.student_id}`}
                          className="rounded px-2 py-1 text-xs text-indigo-400 hover:bg-indigo-600/10">View</Link>
                        <button onClick={() => setActionMenu(actionMenu === s.student_id ? null : s.student_id)}
                          className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                      {actionMenu === s.student_id && (
                        <div className="absolute right-4 top-full z-20 mt-1 w-36 rounded-xl border border-white/10 bg-[#1f1f1f] py-1 shadow-xl">
                          {s.status === "inactive" ? (
                            <button onClick={() => reactivate(s.student_id)} disabled={busyId === s.student_id}
                              className="flex w-full px-3 py-2 text-xs text-emerald-400 hover:bg-white/5">Reactivate</button>
                          ) : (
                            <button onClick={() => deactivate(s.student_id)} disabled={busyId === s.student_id}
                              className="flex w-full px-3 py-2 text-xs text-red-400 hover:bg-white/5">Deactivate</button>
                          )}
                          <Link href={`/school/students/${s.student_id}`}
                            className="flex w-full px-3 py-2 text-xs text-white/60 hover:bg-white/5">View profile</Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-white/40">
          <span>{pagination.total} students · page {pagination.page} of {pagination.pages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => { setPage(page - 1); schoolId && fetchStudents(schoolId, page - 1); }}
              className="rounded px-3 py-1.5 hover:bg-white/5 disabled:opacity-30">← Prev</button>
            <button disabled={page === pagination.pages} onClick={() => { setPage(page + 1); schoolId && fetchStudents(schoolId, page + 1); }}
              className="rounded px-3 py-1.5 hover:bg-white/5 disabled:opacity-30">Next →</button>
          </div>
        </div>
      )}

      {actionMenu && <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />}
    </SchoolLayout>
  );
}
