import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Clock,
  GraduationCap,
  Mail,
  Phone,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../../components/ui";
import SchoolLayout from "../../../components/School/SchoolLayout";

// ── Types ──────────────────────────────────────────────────────────────────

interface ClassEntry {
  class_id: string;
  class_name: string;
  teacher_name: string | null;
  enrollment_status: string;
  avg_score: number;
  assignments_submitted: number;
  assignments_total: number;
}

interface ParentContact {
  contact_id: string;
  parent_name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  is_primary: boolean;
  can_receive_alerts: boolean;
  preferred_contact_method: string;
}

interface StudentProfile {
  student_id: string;
  name: string;
  email: string;
  grade: number | null;
  status: string;
  enrollment_status: string;
  risk_level: string;
  overall_avg_score: number;
  total_assignments_submitted: number;
  total_assignments_on_time: number;
  classes: ClassEntry[];
  parent_contacts: ParentContact[];
  activity: {
    last_login: string | null;
    last_login_relative: string | null;
    logins_week: number;
    logins_month: number;
    videos_watched_week: number;
    assignments_submitted_week: number;
  };
}

// ── Parent modal ───────────────────────────────────────────────────────────

interface ParentFormData {
  parent_name: string;
  email: string;
  phone: string;
  relationship: string;
  can_receive_alerts: boolean;
  preferred_contact_method: string;
}

function ParentModal({
  studentId, schoolId, token, existing, onClose, onSaved,
}: {
  studentId: string; schoolId: string; token: string;
  existing?: ParentContact; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<ParentFormData>({
    parent_name: existing?.parent_name ?? "",
    email: existing?.email ?? "",
    phone: existing?.phone ?? "",
    relationship: existing?.relationship ?? "",
    can_receive_alerts: existing?.can_receive_alerts ?? true,
    preferred_contact_method: existing?.preferred_contact_method ?? "email",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  function set<K extends keyof ParentFormData>(k: K, v: ParentFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.parent_name.trim()) { setErr("Name is required"); return; }
    setBusy(true); setErr("");
    const url = existing
      ? `/api/school-admin/${schoolId}/students/${studentId}/parents/${existing.contact_id}`
      : `/api/school-admin/${schoolId}/students/${studentId}/parents`;
    const res = await fetch(url, {
      method: existing ? "PUT" : "POST",
      headers: auth,
      body: JSON.stringify(form),
    });
    if (res.ok) onSaved();
    else { const d = await res.json(); setErr(d.detail || "Save failed"); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{existing ? "Edit" : "Add"} Parent / Guardian</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-white/30" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Full name *" value={form.parent_name} onChange={(v) => set("parent_name", v)} placeholder="Jane Doe" />
          <Field label="Email" value={form.email} onChange={(v) => set("email", v)} placeholder="jane@example.com" />
          <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+1 555-0100" />
          <Field label="Relationship" value={form.relationship} onChange={(v) => set("relationship", v)} placeholder="Mother" />
          <div>
            <label className="mb-1 block text-xs text-white/50">Preferred contact</label>
            <select value={form.preferred_contact_method} onChange={(e) => set("preferred_contact_method", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input type="checkbox" checked={form.can_receive_alerts}
              onChange={(e) => set("can_receive_alerts", e.target.checked)}
              className="rounded border-white/20 bg-white/5" />
            Receive alerts for this student
          </label>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy} className="flex-1">{busy ? "Saving…" : "Save"}</Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-white/50">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none" />
    </div>
  );
}

// ── Enroll modal ───────────────────────────────────────────────────────────

function EnrollModal({ studentId, schoolId, token, onClose, onDone }: {
  studentId: string; schoolId: string; token: string; onClose: () => void; onDone: () => void;
}) {
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function submit() {
    if (!classId.trim()) { setErr("Enter a class ID"); return; }
    setBusy(true);
    const res = await fetch(`/api/school-admin/${schoolId}/students/${studentId}/enroll`, {
      method: "POST", headers: auth, body: JSON.stringify({ class_id: classId }),
    });
    if (res.ok) onDone();
    else { const d = await res.json(); setErr(d.detail || "Enroll failed"); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Enroll in Class</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-white/30" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Class ID" value={classId} onChange={setClassId} placeholder="Paste class ID" />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={busy} className="flex-1">{busy ? "Enrolling…" : "Enroll"}</Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  );
}

const RISK_BADGE: Record<string, string> = {
  none: "bg-white/5 text-white/30",
  low: "bg-blue-500/15 text-blue-400",
  medium: "bg-amber-500/15 text-amber-400",
  high: "bg-orange-500/15 text-orange-400",
  critical: "bg-red-500/15 text-red-400",
};

// ── Main ───────────────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const router = useRouter();
  const { studentId } = router.query as { studentId: string };
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [parentModal, setParentModal] = useState<ParentContact | null | "new">(null);
  const [enrollModal, setEnrollModal] = useState(false);

  useEffect(() => {
    const sid = typeof window !== "undefined"
      ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id")
      : null;
    if (sid) setSchoolId(sid);
  }, []);

  function loadProfile(sid: string, sid2: string) {
    setLoading(true);
    fetch(`/api/school-admin/${sid}/students/${sid2}`, { headers: auth })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setProfile(d))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!schoolId || !studentId || !token) return;
    loadProfile(schoolId, studentId);
  }, [schoolId, studentId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deactivate() {
    if (!schoolId || !confirm("Deactivate this student?")) return;
    setBusyAction("deactivate");
    await fetch(`/api/school-admin/${schoolId}/students/${studentId}/deactivate`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Admin deactivation" }),
    });
    setBusyAction("");
    router.push("/school/students");
  }

  async function reactivate() {
    if (!schoolId) return;
    setBusyAction("reactivate");
    await fetch(`/api/school-admin/${schoolId}/students/${studentId}/reactivate`, {
      method: "POST", headers: auth,
    });
    setBusyAction("");
    setProfile((p) => p ? { ...p, status: "active", enrollment_status: "enrolled" } : p);
  }

  async function removeFromClass(classId: string) {
    if (!schoolId || !confirm("Remove student from this class?")) return;
    await fetch(`/api/school-admin/${schoolId}/students/${studentId}/classes/${classId}`, {
      method: "DELETE", headers: auth,
    });
    schoolId && loadProfile(schoolId, studentId);
  }

  async function deleteParent(contactId: string) {
    if (!schoolId || !confirm("Remove this parent contact?")) return;
    await fetch(`/api/school-admin/${schoolId}/students/${studentId}/parents/${contactId}`, {
      method: "DELETE", headers: auth,
    });
    schoolId && loadProfile(schoolId, studentId);
  }

  if (loading) {
    return (
      <SchoolLayout>
        <Skeleton className="mb-4 h-8 w-40" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </SchoolLayout>
    );
  }

  if (!profile) {
    return (
      <SchoolLayout>
        <p className="text-white/40">Student not found.</p>
      </SchoolLayout>
    );
  }

  return (
    <SchoolLayout>
      <Head><title>{profile.name} — Student Profile</title></Head>

      <Link href="/school/students" className="mb-4 flex items-center gap-1.5 text-xs text-white/40 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All students
      </Link>

      {/* Header */}
      <Card padding="md" className="mb-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-xl font-bold text-indigo-400">
            {(profile.name || "?")[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-white">{profile.name}</h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                profile.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}>{profile.enrollment_status}</span>
              {profile.risk_level !== "none" && (
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RISK_BADGE[profile.risk_level] ?? "bg-white/5 text-white/40"}`}>
                  <AlertTriangle className="h-3 w-3" />
                  {profile.risk_level} risk
                </span>
              )}
            </div>
            <p className="text-sm text-white/50">{profile.email}</p>
            {profile.grade && <p className="text-xs text-white/30">Grade {profile.grade}</p>}
          </div>
          <div className="flex items-center gap-2">
            {profile.status === "inactive" ? (
              <Button size="sm" onClick={reactivate} disabled={busyAction === "reactivate"}>Reactivate</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={deactivate} disabled={busyAction === "deactivate"}
                className="border-red-500/30 text-red-400 hover:border-red-500">
                Deactivate
              </Button>
            )}
          </div>
        </div>

        {/* Overall stats bar */}
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-white/5 px-4 py-3 sm:grid-cols-3">
          <Stat label="Avg score" value={`${profile.overall_avg_score}%`}
            color={profile.overall_avg_score < 60 ? "text-red-400" : profile.overall_avg_score < 75 ? "text-amber-400" : "text-emerald-400"} />
          <Stat label="Submitted" value={profile.total_assignments_submitted} />
          <Stat label="On time" value={profile.total_assignments_on_time} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

        {/* Classes */}
        <Card padding="md">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Classes ({profile.classes.length})</h2>
            </div>
            <button onClick={() => setEnrollModal(true)}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
              <Plus className="h-3.5 w-3.5" /> Enroll
            </button>
          </div>
          {profile.classes.length === 0 ? (
            <p className="text-xs text-white/30">Not enrolled in any classes.</p>
          ) : (
            <div className="space-y-2">
              {profile.classes.map((cls) => (
                <div key={cls.class_id} className="rounded-lg bg-white/5 px-3 py-2.5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{cls.class_name}</p>
                      {cls.teacher_name && <p className="text-xs text-white/40">{cls.teacher_name}</p>}
                    </div>
                    <button onClick={() => removeFromClass(cls.class_id)}
                      className="ml-2 shrink-0 p-1 text-white/20 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                    <span className={`font-medium tabular-nums ${cls.avg_score < 60 ? "text-red-400" : cls.avg_score < 75 ? "text-amber-400" : "text-emerald-400"}`}>
                      {cls.avg_score}%
                    </span>
                    <span>{cls.assignments_submitted}/{cls.assignments_total} assignments</span>
                    <span className={`capitalize ${cls.enrollment_status === "dropped" ? "text-red-400/60" : "text-white/30"}`}>
                      {cls.enrollment_status}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-1 rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${cls.avg_score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Activity */}
        <Card padding="md">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Activity</h2>
          </div>
          <div className="space-y-2">
            <StatRow label="Last login" value={profile.activity.last_login_relative ?? "Never"} />
            <StatRow label="Logins this week" value={profile.activity.logins_week} />
            <StatRow label="Logins this month" value={profile.activity.logins_month} />
            <StatRow label="Videos watched (7d)" value={profile.activity.videos_watched_week} />
            <StatRow label="Assignments submitted (7d)" value={profile.activity.assignments_submitted_week} />
          </div>
        </Card>

        {/* Parent contacts */}
        <Card padding="md" className="md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Parent / Guardian Contacts ({profile.parent_contacts.length})</h2>
            </div>
            <button onClick={() => setParentModal("new")}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
              <Plus className="h-3.5 w-3.5" /> Add contact
            </button>
          </div>
          {profile.parent_contacts.length === 0 ? (
            <p className="text-xs text-white/30">No parent contacts added yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profile.parent_contacts.map((p) => (
                <div key={p.contact_id} className="relative rounded-xl border border-white/8 bg-white/[0.03] p-4">
                  {p.is_primary && (
                    <span className="absolute right-3 top-3 text-xs text-indigo-400">Primary</span>
                  )}
                  <p className="pr-12 text-sm font-medium text-white">{p.parent_name}</p>
                  {p.relationship && <p className="text-xs text-white/30">{p.relationship}</p>}
                  <div className="mt-2 space-y-1">
                    {p.email && (
                      <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white">
                        <Mail className="h-3 w-3" /> {p.email}
                      </a>
                    )}
                    {p.phone && (
                      <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white">
                        <Phone className="h-3 w-3" /> {p.phone}
                      </a>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => setParentModal(p)}
                      className="text-xs text-indigo-400 hover:text-indigo-300">Edit</button>
                    <button onClick={() => deleteParent(p.contact_id)}
                      className="text-xs text-red-400/60 hover:text-red-400">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Parent modal */}
      {parentModal && schoolId && (
        <ParentModal
          studentId={studentId}
          schoolId={schoolId}
          token={token}
          existing={parentModal === "new" ? undefined : parentModal}
          onClose={() => setParentModal(null)}
          onSaved={() => {
            setParentModal(null);
            schoolId && loadProfile(schoolId, studentId);
          }}
        />
      )}

      {/* Enroll modal */}
      {enrollModal && schoolId && (
        <EnrollModal
          studentId={studentId}
          schoolId={schoolId}
          token={token}
          onClose={() => setEnrollModal(false)}
          onDone={() => {
            setEnrollModal(false);
            schoolId && loadProfile(schoolId, studentId);
          }}
        />
      )}
    </SchoolLayout>
  );
}

function Stat({ label, value, color = "text-white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-white/30">{label}</p>
    </div>
  );
}
