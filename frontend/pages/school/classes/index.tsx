import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Plus, Search, Download, ArrowUpRight, Archive, RotateCcw, Trash2, School } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Button, Skeleton, Badge, EmptyState } from "../../../components/ui";
import { ClassFormModal, TeacherOption } from "../../../components/School/ClassModals";

interface ClassRow {
  class_id: string; name: string; subject: string | null; teacher: string;
  grade_level: number | null; students: number; max_students: number;
  capacity_pct: number; status: string; avg_score: number; created_at: string | null;
}

export default function SchoolClassesPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const sid = typeof window !== "undefined"
      ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id") : null;
    if (sid) setSchoolId(sid);
  }, []);

  const fetchClasses = useCallback(async (sid: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, page_size: "200" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/school-admin/${sid}/classes?${params}`, { headers: auth });
      if (res.ok) setRows((await res.json()).classes ?? []);
    } finally { setLoading(false); }
  }, [token, search, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTeachers = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/school-admin/${sid}/teachers?page_size=200`, { headers: auth });
      if (res.ok) {
        const d = await res.json();
        setTeachers((d.teachers ?? []).map((t: Record<string, unknown>) => ({
          id: String(t.teacher_id ?? t.id ?? ""),
          name: String(t.name ?? t.full_name ?? t.email ?? "Teacher"),
        })).filter((t: TeacherOption) => t.id));
      }
    } catch { /* non-fatal */ }
  }, [token]);

  useEffect(() => { if (schoolId) { fetchClasses(schoolId); } }, [schoolId, search, status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (schoolId) fetchTeachers(schoolId); }, [schoolId, fetchTeachers]);

  async function act(classId: string, action: "archive" | "restore" | "delete") {
    if (!schoolId) return;
    if (action === "delete" && !confirm("Permanently delete this class? This can't be undone.")) return;
    const method = action === "delete" ? "DELETE" : "POST";
    const path = action === "delete" ? `${classId}` : `${classId}/${action}`;
    await fetch(`/api/school-admin/${schoolId}/classes/${path}`, { method, headers: auth });
    fetchClasses(schoolId);
  }

  async function bulkArchive() {
    if (!schoolId || selected.size === 0) return;
    for (const id of Array.from(selected)) await fetch(`/api/school-admin/${schoolId}/classes/${id}/archive`, { method: "POST", headers: auth });
    setSelected(new Set());
    fetchClasses(schoolId);
  }

  function exportCsv() {
    const header = ["Name", "Teacher", "Subject", "Grade", "Students", "Max", "Status", "Avg score"];
    const csv = [header.join(","), ...rows.map((r) =>
      [r.name, r.teacher, r.subject ?? "", r.grade_level ?? "", r.students, r.max_students, r.status, r.avg_score]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "classes.csv"; a.click(); URL.revokeObjectURL(url);
  }

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <>
      <Head><title>Classes — LearnPath for Schools</title></Head>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Classes</h1>
            <p className="mt-1 text-sm text-white/40">Create, edit, merge, duplicate and archive classes across your school.</p>
          </div>
          <Button onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" />}>Create class</Button>
        </div>

        <Card padding="sm" className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by class or teacher…" className="input-field pl-9" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field max-w-[160px]">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
            <Button size="sm" variant="secondary" onClick={exportCsv} leftIcon={<Download className="h-4 w-4" />}>CSV</Button>
            {selected.size > 0 && (
              <Button size="sm" variant="secondary" onClick={bulkArchive} leftIcon={<Archive className="h-4 w-4" />}>Archive {selected.size}</Button>
            )}
          </div>
        </Card>

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState icon={<School className="h-5 w-5" />} title="No classes" description="Create your first class to get started." action={<Button size="sm" onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" />}>Create class</Button>} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-elevated text-left text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold">Teacher</th>
                  <th className="px-4 py-3 font-semibold">Students</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Avg</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.class_id} className="hover:bg-surface-elevated/60">
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(r.class_id)} onChange={() => toggle(r.class_id)} className="h-4 w-4 rounded border-white/20 bg-surface text-accent" /></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{r.name}</p>
                      <p className="text-xs text-white/40">{r.subject || "—"}{r.grade_level != null ? ` · grade ${r.grade_level}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-white/70">{r.teacher}</td>
                    <td className="px-4 py-3 text-white/70 tabular-nums">{r.students}/{r.max_students}</td>
                    <td className="px-4 py-3"><Badge tone={r.status === "archived" ? "neutral" : "success"}>{r.status}</Badge></td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-white">{r.avg_score}%</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="secondary" href={`/school/classes/${r.class_id}`} rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}>View</Button>
                        {r.status === "archived" ? (
                          <>
                            <button onClick={() => act(r.class_id, "restore")} aria-label="Restore" title="Restore" className="rounded-lg p-2 text-white/40 hover:bg-surface-elevated hover:text-white"><RotateCcw className="h-4 w-4" /></button>
                            <button onClick={() => act(r.class_id, "delete")} aria-label="Delete" title="Delete" className="rounded-lg p-2 text-white/40 hover:bg-error-muted hover:text-error"><Trash2 className="h-4 w-4" /></button>
                          </>
                        ) : (
                          <button onClick={() => act(r.class_id, "archive")} aria-label="Archive" title="Archive" className="rounded-lg p-2 text-white/40 hover:bg-surface-elevated hover:text-white"><Archive className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && schoolId && (
        <ClassFormModal schoolId={schoolId} token={token} teachers={teachers}
          onClose={() => setCreating(false)} onDone={() => { setCreating(false); fetchClasses(schoolId); }} />
      )}
    </>
  );
}
