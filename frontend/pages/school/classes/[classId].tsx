import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ArrowLeft, Pencil, Copy, GitMerge, Archive, RotateCcw, Trash2, UserMinus } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Button, Skeleton, Badge, SectionHeader, EmptyState } from "../../../components/ui";
import { ClassFormModal, DuplicateModal, MergeModal, TeacherOption, ClassOption } from "../../../components/School/ClassModals";
import { STATUS_TONE, STATUS_LABEL, timeAgo } from "../../../components/Teacher/types";

interface RosterStudent {
  student_id: string; name: string; email: string | null; score: number; status: string;
}

interface Detail {
  class_id: string; name: string; subject: string | null; description: string | null;
  teacher: string; teacher_id: string | null; grade_level: number | null; status: string;
  capacity: { current: number; max: number; pct_full: number };
  stats: { students: number; avg_score: number; submission_rate: number | null; at_risk_count: number };
  roster: RosterStudent[];
  activity: { action: string; resource_type: string | null; at: string }[];
}

export default function SchoolClassDetailPage() {
  const router = useRouter();
  const classId = typeof router.query.classId === "string" ? router.query.classId : "";
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [modal, setModal] = useState<null | "edit" | "duplicate" | "merge">(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [removingStudents, setRemovingStudents] = useState(false);

  useEffect(() => {
    const sid = typeof window !== "undefined"
      ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id") : null;
    if (sid) setSchoolId(sid);
  }, []);

  const load = useCallback(async () => {
    if (!schoolId || !classId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/school-admin/${schoolId}/classes/${classId}`, { headers: auth });
      if (!res.ok) throw new Error();
      setD(await res.json());
    } catch { setError("Couldn't load this class."); } finally { setLoading(false); }
  }, [schoolId, classId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!schoolId) return;
    fetch(`/api/school-admin/${schoolId}/teachers?page_size=200`, { headers: auth })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setTeachers((data.teachers ?? []).map((t: Record<string, unknown>) => ({
        id: String(t.teacher_id ?? t.id ?? ""), name: String(t.name ?? t.full_name ?? t.email ?? "Teacher"),
      })).filter((t: TeacherOption) => t.id))).catch(() => {});
    fetch(`/api/school-admin/${schoolId}/classes?status=active&page_size=200`, { headers: auth })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setClasses((data.classes ?? []).map((c: Record<string, unknown>) => ({
        class_id: String(c.class_id), name: String(c.name), students: Number(c.students ?? 0), max_students: Number(c.max_students ?? 0),
      })))).catch(() => {});
  }, [schoolId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setArchived(archived: boolean) {
    if (!schoolId) return;
    await fetch(`/api/school-admin/${schoolId}/classes/${classId}/${archived ? "archive" : "restore"}`, { method: "POST", headers: auth });
    load();
  }
  async function del() {
    if (!schoolId || !confirm("Permanently delete this class?")) return;
    await fetch(`/api/school-admin/${schoolId}/classes/${classId}`, { method: "DELETE", headers: auth });
    router.push("/school/classes");
  }

  async function removeSelected() {
    if (!schoolId || selectedStudents.size === 0) return;
    if (!confirm(`Remove ${selectedStudents.size} student${selectedStudents.size > 1 ? "s" : ""} from this class?`)) return;
    setRemovingStudents(true);
    await fetch(`/api/school-admin/${schoolId}/classes/${classId}/roster/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ student_ids: Array.from(selectedStudents) }),
    });
    setSelectedStudents(new Set());
    setRemovingStudents(false);
    load();
  }

  function toggleStudent(id: string) {
    setSelectedStudents((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAllStudents() {
    if (!d) return;
    if (selectedStudents.size === d.roster.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(d.roster.map((s) => s.student_id)));
    }
  }

  return (
    <>
      <Head><title>{d?.name || "Class"} — LearnPath for Schools</title></Head>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <button onClick={() => router.push("/school/classes")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-accent-light hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Classes
        </button>

        {loading ? <Skeleton className="h-72 w-full" />
        : error || !d ? <EmptyState title="Couldn't load" description={error || "No data."} />
        : (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">{d.name}</h1>
                  <Badge tone={d.status === "archived" ? "neutral" : "success"}>{d.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-white/40">
                  {d.teacher}{d.subject ? ` · ${d.subject}` : ""}{d.grade_level != null ? ` · grade ${d.grade_level}` : ""} · {d.capacity.current}/{d.capacity.max} students
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Students" value={String(d.stats.students)} />
                  <Stat label="Avg score" value={`${d.stats.avg_score}%`} />
                  <Stat label="Submission" value={d.stats.submission_rate != null ? `${d.stats.submission_rate}%` : "—"} />
                  <Stat label="At-risk" value={String(d.stats.at_risk_count)} />
                </div>

                <Card padding="none">
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <SectionHeader title="Roster" subtitle={`${d.roster.length} students`} />
                    {selectedStudents.size > 0 && (
                      <Button size="sm" variant="danger" loading={removingStudents}
                        onClick={removeSelected} leftIcon={<UserMinus className="h-3.5 w-3.5" />}>
                        Remove {selectedStudents.size}
                      </Button>
                    )}
                  </div>
                  {d.roster.length === 0 ? <p className="px-4 pb-4 text-sm text-white/40">No students enrolled.</p> : (
                    <ul className="divide-y divide-border">
                      <li className="flex items-center gap-3 px-4 py-2 text-xs text-white/40">
                        <input type="checkbox"
                          checked={selectedStudents.size === d.roster.length && d.roster.length > 0}
                          onChange={toggleAllStudents}
                          className="h-4 w-4 rounded border-white/20 bg-surface text-accent" />
                        <span>Select all</span>
                      </li>
                      {d.roster.map((s) => (
                        <li key={s.student_id} className="flex items-center gap-3 px-4 py-3">
                          <input type="checkbox" checked={selectedStudents.has(s.student_id)}
                            onChange={() => toggleStudent(s.student_id)}
                            className="h-4 w-4 rounded border-white/20 bg-surface text-accent" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">{s.name}</p>
                            {s.email && <p className="text-xs text-white/40">{s.email}</p>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold tabular-nums text-white">{s.score}%</span>
                            <Badge tone={STATUS_TONE[s.status as keyof typeof STATUS_TONE] || "neutral"}>{STATUS_LABEL[s.status as keyof typeof STATUS_LABEL] || s.status}</Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card padding="md">
                  <SectionHeader title="Recent activity" />
                  {d.activity.length === 0 ? <p className="text-sm text-white/40">No recent activity.</p> : (
                    <ul className="space-y-2 text-sm">
                      {d.activity.map((a, i) => (
                        <li key={i} className="flex items-center justify-between">
                          <span className="text-white/70">{a.action.replace(/_/g, " ")}</span>
                          <span className="text-xs text-white/40">{timeAgo(a.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <div>
                <Card padding="md">
                  <h3 className="mb-3 text-sm font-semibold text-white">Actions</h3>
                  <div className="space-y-2">
                    <Button fullWidth size="sm" variant="secondary" onClick={() => setModal("edit")} leftIcon={<Pencil className="h-4 w-4" />}>Edit class</Button>
                    <Button fullWidth size="sm" variant="secondary" onClick={() => setModal("duplicate")} leftIcon={<Copy className="h-4 w-4" />}>Duplicate</Button>
                    <Button fullWidth size="sm" variant="secondary" onClick={() => setModal("merge")} leftIcon={<GitMerge className="h-4 w-4" />}>Merge into…</Button>
                    {d.status === "archived" ? (
                      <Button fullWidth size="sm" variant="secondary" onClick={() => setArchived(false)} leftIcon={<RotateCcw className="h-4 w-4" />}>Restore</Button>
                    ) : (
                      <Button fullWidth size="sm" variant="secondary" onClick={() => setArchived(true)} leftIcon={<Archive className="h-4 w-4" />}>Archive</Button>
                    )}
                    <Button fullWidth size="sm" variant="danger" onClick={del} leftIcon={<Trash2 className="h-4 w-4" />}>Delete</Button>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      {modal === "edit" && schoolId && d && (
        <ClassFormModal schoolId={schoolId} token={token} teachers={teachers} classId={classId}
          initial={{ name: d.name, subject: d.subject, description: d.description, teacher_id: d.teacher_id, grade_level: d.grade_level, max_students: d.capacity.max }}
          onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal === "duplicate" && schoolId && d && (
        <DuplicateModal schoolId={schoolId} token={token} classId={classId} sourceName={d.name} teachers={teachers}
          onClose={() => setModal(null)} onDone={() => { setModal(null); router.push("/school/classes"); }} />
      )}
      {modal === "merge" && schoolId && d && (
        <MergeModal schoolId={schoolId} token={token} classId={classId} sourceName={d.name} targets={classes}
          onClose={() => setModal(null)} onDone={() => { setModal(null); router.push("/school/classes"); }} />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="sm">
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-white/40">{label}</p>
    </Card>
  );
}
