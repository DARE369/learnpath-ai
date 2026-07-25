import React, { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Badge, Button, Modal, ModalTitle, TextField, Select, InlineError, type BadgeTone } from "../../../ui-v2/primitives";
import { color, font } from "../../../ui-v2/tokens";

type Tab = "teachers" | "students" | "classes";

interface TeacherRow {
  teacher_id: string; name: string; email: string; classes: number; students: number;
  status: "active" | "inactive" | "invited"; last_active: string | null;
}
interface StudentRow {
  student_id: string; name: string; email: string; grade: number | null; classes_display: string;
  status: string; enrollment_status: string; score: number; risk_level: string; last_active: string | null;
}
interface ClassRow {
  class_id: string; name: string; subject: string | null; teacher: string; teacher_id: string | null;
  grade_level: number | null; students: number; max_students: number; status: string; avg_score: number;
}
interface TeacherOption { id: string; name: string }

const TEACHER_STATUS_TONE: Record<string, BadgeTone> = { active: "success", invited: "info", inactive: "neutral" };
const RISK_TONE: Record<string, BadgeTone> = { none: "neutral", low: "success", medium: "warning", high: "danger", critical: "danger" };

function useSchoolId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const sid = typeof window !== "undefined" ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id") : null;
    setId(sid);
  }, []);
  return id;
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Invite teacher modal ─────────────────────────────────────────────────

function InviteTeacherModal({ schoolId, token, onClose, onDone }: { schoolId: string; token: string; onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function send() {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch(`/api/school-admin/${schoolId}/teachers/invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, first_name: firstName, last_name: lastName }),
    });
    const d = await res.json();
    if (res.ok) { setMsg(`Invite sent to ${email}`); onDone(); } else setErr(d.detail || "Failed to send invite");
    setBusy(false);
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Invite teacher</ModalTitle>
      {msg ? (
        <>
          <p style={{ fontSize: 13.5, color: color.success.fg, marginBottom: 14 }}>{msg}</p>
          <Button fullWidth onClick={onClose}>Close</Button>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
            <TextField label="Email *" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@lincoln.edu" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          {err && <div style={{ fontSize: 12.5, color: color.danger.fg, marginBottom: 12 }}>{err}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <Button fullWidth disabled={busy || !email} onClick={send}>{busy ? "Sending…" : "Send invite"}</Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Enroll student modal ─────────────────────────────────────────────────

function EnrollModal({ schoolId, token, studentId, studentName, onClose, onDone }: { schoolId: string; token: string; studentId: string; studentName: string; onClose: () => void; onDone: () => void }) {
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!classId.trim()) { setErr("Enter a class ID"); return; }
    setBusy(true);
    const res = await fetch(`/api/school-admin/${schoolId}/students/${studentId}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId }),
    });
    if (res.ok) onDone(); else { const d = await res.json(); setErr(d.detail || "Enroll failed"); }
    setBusy(false);
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Enroll {studentName}</ModalTitle>
      <p style={{ fontSize: 11.5, color: color.danger.fg, marginBottom: 14 }}>No class picker available yet — paste the class ID directly.</p>
      <TextField label="Class ID" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="e.g. C-0042" />
      {err && <div style={{ fontSize: 12.5, color: color.danger.fg, marginTop: 10 }}>{err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Button fullWidth disabled={busy} onClick={submit}>{busy ? "Enrolling…" : "Enroll"}</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

// ── New class modal ──────────────────────────────────────────────────────

function NewClassModal({ schoolId, token, teachers, onClose, onDone }: { schoolId: string; token: string; teachers: TeacherOption[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [maxStudents, setMaxStudents] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!name.trim()) { setErr("Class name is required."); return; }
    setBusy(true); setErr("");
    const res = await fetch(`/api/school-admin/${schoolId}/classes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), subject: subject || null, teacher_id: teacherId || null, grade_level: grade ? Number(grade) : null, max_students: Number(maxStudents) }),
    });
    if (res.ok) onDone(); else setErr("Couldn't create the class.");
    setBusy(false);
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>New class</ModalTitle>
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <TextField label="Class name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Biology 11A" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Biology" />
          <TextField label="Grade level" type="number" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="11" />
        </div>
        <Select label="Teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">Unassigned</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <TextField label="Max students" type="number" value={maxStudents} onChange={(e) => setMaxStudents(Number(e.target.value))} />
      </div>
      {err && <div style={{ fontSize: 12.5, color: color.danger.fg, marginBottom: 12 }}>{err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <Button fullWidth disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create class"}</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

// ── Merge class modal (soft warning only — matches design's flagged gap) ──

function MergeModal({ schoolId, token, classId, sourceName, targets, onClose, onDone }: { schoolId: string; token: string; classId: string; sourceName: string; targets: ClassRow[]; onClose: () => void; onDone: () => void }) {
  const options = targets.filter((c) => c.class_id !== classId);
  const [targetId, setTargetId] = useState(options[0]?.class_id ?? "");
  const [resolution, setResolution] = useState("skip");
  const [archiveSource, setArchiveSource] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!targetId) { setErr("Pick a target class."); return; }
    setBusy(true); setErr("");
    const res = await fetch(`/api/school-admin/${schoolId}/classes/${classId}/merge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ target_class_id: targetId, conflict_resolution: resolution, archive_source: archiveSource }),
    });
    if (res.ok) onDone(); else { setErr("Merge failed."); setBusy(false); }
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Merge {sourceName} into…</ModalTitle>
      <div style={{ display: "grid", gap: 12, marginBottom: 6 }}>
        <Select label="Merge into" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {options.length === 0 && <option value="">No other classes</option>}
          {options.map((c) => <option key={c.class_id} value={c.class_id}>{c.name} ({c.students}/{c.max_students})</option>)}
        </Select>
        <Select label="On conflict" value={resolution} onChange={(e) => setResolution(e.target.value)}>
          <option value="skip">Skip duplicates</option>
          <option value="add_anyway">Keep existing enrollment</option>
        </Select>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: color.inkSoft }}>
          <input type="checkbox" checked={archiveSource} onChange={(e) => setArchiveSource(e.target.checked)} />
          Archive source class afterward
        </label>
      </div>
      <div style={{ fontSize: 12, color: color.danger.fg, background: color.danger.bg, borderRadius: 7, padding: "10px 12px", marginBottom: 16 }}>
        This can&apos;t be undone.
      </div>
      {err && <div style={{ fontSize: 12.5, color: color.danger.fg, marginBottom: 12 }}>{err}</div>}
      <Button fullWidth disabled={busy} onClick={submit} style={{ background: color.danger.fg }}>{busy ? "Merging…" : "Merge classes"}</Button>
    </Modal>
  );
}

// ── Delete class modal (hard confirm) ────────────────────────────────────

function DeleteClassModal({ schoolId, token, classId, className, onClose, onDone }: { schoolId: string; token: string; classId: string; className: string; onClose: () => void; onDone: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await fetch(`/api/school-admin/${schoolId}/classes/${classId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setBusy(false);
    onDone();
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle danger>Delete {className}?</ModalTitle>
      <p style={{ fontSize: 13, color: color.inkSoft, marginBottom: 18, lineHeight: 1.55 }}>
        This permanently deletes the class, its full roster, and all assignment metadata. <b>This can&apos;t be undone.</b>
      </p>
      <TextField label="" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type the class name to confirm" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <Button fullWidth variant="secondary" onClick={onClose}>Cancel</Button>
        <Button fullWidth disabled={busy || confirmText !== className} onClick={submit} style={{ background: color.danger.fg }}>
          {busy ? "Deleting…" : "Delete permanently"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Main page ────────────────────────────────────────────────────────────

export default function SchoolRosterPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;
  const schoolId = useSchoolId();

  const tab: Tab = (router.query.tab as Tab) || "teachers";
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  // Teachers
  const [teacherStatus, setTeacherStatus] = useState("");
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);
  const [showInvite, setShowInvite] = useState(false);

  // Students
  const [riskFilter, setRiskFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [enrollTarget, setEnrollTarget] = useState<StudentRow | null>(null);

  // Classes
  const [classStatus, setClassStatus] = useState("active");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [showNewClass, setShowNewClass] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<ClassRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const setTab = (t: Tab) => router.push(`/school/roster?tab=${t}`, undefined, { shallow: true });

  const fetchTeachers = useCallback(async (sid: string) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page_size: "100" });
      if (search) params.set("search", search);
      if (teacherStatus) params.set("status", teacherStatus);
      const res = await fetch(`/api/school-admin/${sid}/teachers?${params}`, { headers: auth });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setTeachers(d.teachers ?? []);
      setTeacherOptions((d.teachers ?? []).map((t: TeacherRow) => ({ id: t.teacher_id, name: t.name })));
    } catch { setError("Couldn't load teachers."); } finally { setLoading(false); }
  }, [token, search, teacherStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStudents = useCallback(async (sid: string) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page_size: "100" });
      if (search) params.set("search", search);
      if (riskFilter) params.set("risk", riskFilter);
      if (gradeFilter) params.set("grade", gradeFilter);
      const res = await fetch(`/api/school-admin/${sid}/students?${params}`, { headers: auth });
      if (!res.ok) throw new Error();
      setStudents((await res.json()).students ?? []);
    } catch { setError("Couldn't load students."); } finally { setLoading(false); }
  }, [token, search, riskFilter, gradeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchClasses = useCallback(async (sid: string) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ status: classStatus, page_size: "200" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/school-admin/${sid}/classes?${params}`, { headers: auth });
      if (!res.ok) throw new Error();
      setClasses((await res.json()).classes ?? []);
      const tres = await fetch(`/api/school-admin/${sid}/teachers?page_size=200`, { headers: auth });
      if (tres.ok) {
        const td = await tres.json();
        setTeacherOptions((td.teachers ?? []).map((t: TeacherRow) => ({ id: t.teacher_id, name: t.name })));
      }
    } catch { setError("Couldn't load classes."); } finally { setLoading(false); }
  }, [token, search, classStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "students" && router.query.filter === "at_risk") setRiskFilter("high");
  }, [tab, router.query.filter]);

  useEffect(() => {
    if (!schoolId) return;
    setSearch("");
    if (tab === "teachers") fetchTeachers(schoolId);
    else if (tab === "students") fetchStudents(schoolId);
    else fetchClasses(schoolId);
  }, [schoolId, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!schoolId) return;
    const t = setTimeout(() => {
      if (tab === "teachers") fetchTeachers(schoolId);
      else if (tab === "students") fetchStudents(schoolId);
      else fetchClasses(schoolId);
    }, 250);
    return () => clearTimeout(t);
  }, [search, teacherStatus, riskFilter, gradeFilter, classStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  function flash(text: string) {
    setToast(text);
    setTimeout(() => setToast(""), 3000);
  }

  async function toggleTeacherStatus(t: TeacherRow) {
    if (!schoolId) return;
    setBusyId(t.teacher_id);
    if (t.status === "inactive") {
      await fetch(`/api/school-admin/${schoolId}/teachers/${t.teacher_id}/reactivate`, { method: "POST", headers: auth });
      flash(`${t.name} reactivated.`);
    } else {
      if (!confirm(`Deactivate ${t.name}?`)) { setBusyId(null); return; }
      await fetch(`/api/school-admin/${schoolId}/teachers/${t.teacher_id}/deactivate`, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Manual deactivation by admin" }),
      });
      flash(`${t.name} deactivated.`);
    }
    setBusyId(null);
    fetchTeachers(schoolId);
  }

  async function toggleStudentStatus(s: StudentRow) {
    if (!schoolId) return;
    setBusyId(s.student_id);
    if (s.status === "inactive") {
      await fetch(`/api/school-admin/${schoolId}/students/${s.student_id}/reactivate`, { method: "POST", headers: auth });
      flash(`${s.name} reactivated.`);
    } else {
      if (!confirm(`Deactivate ${s.name}?`)) { setBusyId(null); return; }
      await fetch(`/api/school-admin/${schoolId}/students/${s.student_id}/deactivate`, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Admin deactivation" }),
      });
      flash(`${s.name} deactivated.`);
    }
    setBusyId(null);
    fetchStudents(schoolId);
  }

  function doExport() {
    if (tab === "teachers") downloadCsv("teachers.csv", ["Name", "Email", "Classes", "Students", "Status"], teachers.map((t) => [t.name, t.email, t.classes, t.students, t.status]));
    else if (tab === "students") downloadCsv("students.csv", ["Name", "Email", "Grade", "Classes", "Score", "Risk"], students.map((s) => [s.name, s.email, s.grade ?? "", s.classes_display, s.score, s.risk_level]));
    else downloadCsv("classes.csv", ["Name", "Subject", "Grade", "Teacher", "Enrolled", "Capacity", "Avg score"], classes.map((c) => [c.name, c.subject ?? "", c.grade_level ?? "", c.teacher, c.students, c.max_students, c.avg_score]));
    flash("Roster exported as spreadsheet.");
  }

  if (!schoolId) return <div style={{ textAlign: "center", padding: 60, color: color.textFaint }}>Loading…</div>;

  return (
    <>
      <Head><title>{tab === "teachers" ? "Teachers" : tab === "students" ? "Students" : "Classes"} — LearnPath AI</title></Head>
      <div style={{ maxWidth: 1280, fontFamily: font.body }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>{tab === "teachers" ? "Teachers" : tab === "students" ? "Students" : "Classes"}</h1>
          <Link href="/school/dashboard" style={{ fontSize: 13, fontWeight: 600, color: "#2B5FA8", textDecoration: "none" }}>← Back to dashboard</Link>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {(["teachers", "students", "classes"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: "pointer",
                border: tab === t ? "none" : `1px solid ${color.border}`,
                background: tab === t ? "#2B3A67" : "#fff",
                color: tab === t ? "#fff" : color.ink,
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{ padding: "8px 12px", fontSize: 13, border: `1px solid #CFCBC0`, borderRadius: 6, width: 220, fontFamily: font.body }}
            />
            {tab === "teachers" && (
              <Select value={teacherStatus} onChange={(e) => setTeacherStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="inactive">Inactive</option>
              </Select>
            )}
            {tab === "students" && (
              <>
                <Select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
                  <option value="">All risk levels</option>
                  <option value="high">High/Critical</option>
                  <option value="medium">Medium</option>
                  <option value="none">On track</option>
                </Select>
                <Select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
                  <option value="">All grades</option>
                  {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </Select>
              </>
            )}
            {tab === "classes" && (
              <Select value={classStatus} onChange={(e) => setClassStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </Select>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {tab === "teachers" && <Button size="sm" onClick={() => setShowInvite(true)}>Invite teacher</Button>}
            {tab === "classes" && <Button size="sm" onClick={() => setShowNewClass(true)}>New class</Button>}
            <Button size="sm" variant="secondary" onClick={doExport}>Export</Button>
          </div>
        </div>

        {toast && <div style={{ fontSize: 12.5, color: color.success.fg, marginBottom: 12 }}>{toast}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: color.textFaint }}>Loading…</div>
        ) : error ? (
          <InlineError message={error} onRetry={() => (tab === "teachers" ? fetchTeachers(schoolId) : tab === "students" ? fetchStudents(schoolId) : fetchClasses(schoolId))} />
        ) : tab === "teachers" ? (
          <Card padding="sm" style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 0.8fr 0.9fr 1fr", padding: "12px 18px", fontSize: 11.5, fontWeight: 600, color: color.textFaint, borderBottom: `1px solid ${color.border}` }}>
              <div>NAME</div><div>EMAIL</div><div>CLASSES</div><div>STUDENTS</div><div>STATUS</div><div>ACTIONS</div>
            </div>
            {teachers.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: color.textFaint, fontSize: 13 }}>No teachers found.</div>
            ) : teachers.map((t) => (
              <div key={t.teacher_id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 0.8fr 0.9fr 1fr", padding: "14px 18px", alignItems: "center", borderBottom: `1px solid ${color.borderMuted}`, fontSize: 13 }}>
                <a href={`/school/teachers/${t.teacher_id}`} style={{ fontWeight: 600, color: "#2B5FA8", textDecoration: "none" }}>{t.name}</a>
                <div style={{ color: color.textFaint }}>{t.email}</div>
                <div>{t.classes}</div>
                <div>{t.students}</div>
                <div><Badge tone={TEACHER_STATUS_TONE[t.status] ?? "neutral"}>{t.status.toUpperCase()}</Badge></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <a href={`/school/teachers/${t.teacher_id}`} style={{ fontSize: 12, color: "#2B5FA8", cursor: "pointer" }}>Reassign</a>
                  <button disabled={busyId === t.teacher_id} onClick={() => toggleTeacherStatus(t)} style={{ fontSize: 12, color: color.danger.fg, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {t.status === "inactive" ? "Reactivate" : "Deactivate"}
                  </button>
                </div>
              </div>
            ))}
          </Card>
        ) : tab === "students" ? (
          <Card padding="sm" style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 1fr 0.7fr 0.9fr 1fr", padding: "12px 18px", fontSize: 11.5, fontWeight: 600, color: color.textFaint, borderBottom: `1px solid ${color.border}` }}>
              <div>NAME</div><div>GRADE</div><div>CLASSES</div><div>SCORE</div><div>RISK</div><div>ACTIONS</div>
            </div>
            {students.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: color.textFaint, fontSize: 13 }}>No students found.</div>
            ) : students.map((s) => (
              <div key={s.student_id} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 1fr 0.7fr 0.9fr 1fr", padding: "14px 18px", alignItems: "center", borderBottom: `1px solid ${color.borderMuted}`, fontSize: 13 }}>
                <a href={`/school/students/${s.student_id}`} style={{ fontWeight: 600, color: "#2B5FA8", textDecoration: "none" }}>{s.name}</a>
                <div>{s.grade ?? "—"}</div>
                <div style={{ color: color.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.classes_display}</div>
                <div style={{ fontFamily: font.mono, color: s.score >= 70 ? color.success.fg : s.score >= 60 ? color.warning.fg : color.danger.fg }}>{s.score}%</div>
                <div><Badge tone={RISK_TONE[s.risk_level] ?? "neutral"}>{s.risk_level === "none" ? "ON TRACK" : s.risk_level.toUpperCase()}</Badge></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setEnrollTarget(s)} style={{ fontSize: 12, color: "#2B5FA8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Enroll</button>
                  <button disabled={busyId === s.student_id} onClick={() => toggleStudentStatus(s)} style={{ fontSize: 12, color: color.danger.fg, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {s.status === "inactive" ? "Reactivate" : "Deactivate"}
                  </button>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <Card padding="sm" style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr 0.6fr 1fr 0.9fr 0.8fr 1fr", padding: "12px 18px", fontSize: 11.5, fontWeight: 600, color: color.textFaint, borderBottom: `1px solid ${color.border}` }}>
              <div>NAME</div><div>SUBJECT</div><div>GRADE</div><div>TEACHER</div><div>ENROLLED</div><div>AVG SCORE</div><div>ACTIONS</div>
            </div>
            {classes.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: color.textFaint, fontSize: 13 }}>No classes found.</div>
            ) : classes.map((c) => (
              <div key={c.class_id} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr 0.6fr 1fr 0.9fr 0.8fr 1fr", padding: "14px 18px", alignItems: "center", borderBottom: `1px solid ${color.borderMuted}`, fontSize: 13 }}>
                <a href={`/school/classes/${c.class_id}`} style={{ fontWeight: 600, color: "#2B5FA8", textDecoration: "none" }}>{c.name}</a>
                <div>{c.subject ?? "—"}</div>
                <div>{c.grade_level ?? "—"}</div>
                <div style={{ color: color.textFaint }}>{c.teacher}</div>
                <div>{c.students}/{c.max_students}</div>
                <div style={{ fontFamily: font.mono }}>{c.avg_score}%</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setMergeTarget(c)} style={{ fontSize: 12, color: color.warning.fg, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Merge</button>
                  <button onClick={() => setDeleteTarget(c)} style={{ fontSize: 12, color: color.danger.fg, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Delete</button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {showInvite && <InviteTeacherModal schoolId={schoolId} token={token} onClose={() => setShowInvite(false)} onDone={() => { setShowInvite(false); fetchTeachers(schoolId); }} />}
      {enrollTarget && <EnrollModal schoolId={schoolId} token={token} studentId={enrollTarget.student_id} studentName={enrollTarget.name} onClose={() => setEnrollTarget(null)} onDone={() => { flash(`${enrollTarget.name} enrolled.`); setEnrollTarget(null); fetchStudents(schoolId); }} />}
      {showNewClass && <NewClassModal schoolId={schoolId} token={token} teachers={teacherOptions} onClose={() => setShowNewClass(false)} onDone={() => { setShowNewClass(false); fetchClasses(schoolId); }} />}
      {mergeTarget && <MergeModal schoolId={schoolId} token={token} classId={mergeTarget.class_id} sourceName={mergeTarget.name} targets={classes} onClose={() => setMergeTarget(null)} onDone={() => { flash("Classes merged."); setMergeTarget(null); fetchClasses(schoolId); }} />}
      {deleteTarget && <DeleteClassModal schoolId={schoolId} token={token} classId={deleteTarget.class_id} className={deleteTarget.name} onClose={() => setDeleteTarget(null)} onDone={() => { flash("Class deleted."); setDeleteTarget(null); fetchClasses(schoolId); }} />}
    </>
  );
}
