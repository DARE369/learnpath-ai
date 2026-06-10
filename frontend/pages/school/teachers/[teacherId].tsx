import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Mail,
  MoreHorizontal,
  Users,
  X,
  Shuffle,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../../components/ui";
import SchoolLayout from "../../../components/School/SchoolLayout";

// ── Types ──────────────────────────────────────────────────────────────────

interface ClassRow { class_id: string; name: string; subject: string | null; students: number }
interface TeacherProfile {
  teacher_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  status: string;
  department: string | null;
  hire_date: string | null;
  classes: ClassRow[];
  activity: {
    last_login: string | null;
    last_login_relative: string | null;
    logins_today: number;
    logins_week: number;
    assignments_created: number;
    messages_sent: number;
  };
  reassignment_history: Array<{ class_id: string; to_teacher_id: string | null; reassigned_at: string }>;
}

// ── Reassign modal ─────────────────────────────────────────────────────────

function ReassignModal({
  teacherId, classId, className, schoolId, token, onClose, onDone,
}: {
  teacherId: string; classId: string; className: string;
  schoolId: string; token: string; onClose: () => void; onDone: () => void;
}) {
  const [toTeacherId, setToTeacherId] = useState("");
  const [transferAssignments, setTransferAssignments] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!toTeacherId.trim()) { setErr("Enter a teacher ID"); return; }
    setBusy(true); setErr("");
    const res = await fetch(`/api/school-admin/${schoolId}/teachers/${teacherId}/reassign-classes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to_teacher_id: toTeacherId,
        class_ids: [classId],
        transfer_assignments: transferAssignments,
      }),
    });
    const d = await res.json();
    if (res.ok) onDone();
    else setErr(d.detail || "Failed to reassign");
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Reassign &ldquo;{className}&rdquo;</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-white/30" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-white/50">New teacher ID</label>
            <input
              value={toTeacherId}
              onChange={(e) => setToTeacherId(e.target.value)}
              placeholder="Paste teacher user ID"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input type="checkbox" checked={transferAssignments}
              onChange={(e) => setTransferAssignments(e.target.checked)}
              className="rounded border-white/20 bg-white/5"
            />
            Transfer assignments to new teacher
          </label>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={busy} className="flex-1">
              {busy ? "Reassigning…" : "Reassign"}
            </Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function TeacherProfilePage() {
  const router = useRouter();
  const { teacherId } = router.query as { teacherId: string };
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [reassignClass, setReassignClass] = useState<ClassRow | null>(null);
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    const sid = typeof window !== "undefined"
      ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id")
      : null;
    if (sid) setSchoolId(sid);
  }, []);

  useEffect(() => {
    if (!schoolId || !teacherId || !token) return;
    setLoading(true);
    fetch(`/api/school-admin/${schoolId}/teachers/${teacherId}`, { headers: auth })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setProfile(d))
      .finally(() => setLoading(false));
  }, [schoolId, teacherId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deactivate() {
    if (!schoolId || !confirm("Deactivate this teacher?")) return;
    setBusyAction("deactivate");
    await fetch(`/api/school-admin/${schoolId}/teachers/${teacherId}/deactivate`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Manual deactivation" }),
    });
    setBusyAction("");
    router.push("/school/teachers");
  }

  async function reactivate() {
    if (!schoolId) return;
    setBusyAction("reactivate");
    await fetch(`/api/school-admin/${schoolId}/teachers/${teacherId}/reactivate`, {
      method: "POST", headers: auth,
    });
    setBusyAction("");
    setProfile((p) => p ? { ...p, status: "active" } : p);
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
        <p className="text-white/40">Teacher not found.</p>
      </SchoolLayout>
    );
  }

  return (
    <SchoolLayout>
      <Head><title>{profile.name} — Teacher Profile</title></Head>

      {/* Back */}
      <Link href="/school/teachers" className="mb-4 flex items-center gap-1.5 text-xs text-white/40 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All teachers
      </Link>

      {/* Header */}
      <Card padding="md" className="mb-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-xl font-bold text-indigo-400">
            {(profile.name || "?")[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-white">{profile.name}</h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                profile.status === "active" ? "bg-emerald-500/15 text-emerald-400" :
                profile.status === "inactive" ? "bg-red-500/15 text-red-400" :
                "bg-amber-500/15 text-amber-400"
              }`}>{profile.status}</span>
            </div>
            <p className="text-sm text-white/50">{profile.email}</p>
            {profile.department && <p className="text-xs text-white/30">{profile.department}</p>}
            {profile.hire_date && (
              <p className="text-xs text-white/30">Joined {new Date(profile.hire_date).toLocaleDateString()}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a href={`mailto:${profile.email}`}>
              <Button size="sm" variant="secondary"><Mail className="mr-1 h-3.5 w-3.5" />Message</Button>
            </a>
            {profile.status === "inactive" ? (
              <Button size="sm" onClick={reactivate} disabled={busyAction === "reactivate"}>
                Reactivate
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={deactivate} disabled={busyAction === "deactivate"}
                className="border-red-500/30 text-red-400 hover:border-red-500">
                Deactivate
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

        {/* Classes */}
        <Card padding="md">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Classes ({profile.classes.length})</h2>
          </div>
          {profile.classes.length === 0 ? (
            <p className="text-xs text-white/30">No classes assigned.</p>
          ) : (
            <div className="space-y-2">
              {profile.classes.map((cls) => (
                <div key={cls.class_id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-white">{cls.name}</p>
                    <p className="text-xs text-white/40">
                      {cls.subject && `${cls.subject} · `}{cls.students} student{cls.students !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setReassignClass(cls)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/10"
                    >
                      <Shuffle className="h-3 w-3" /> Reassign
                    </button>
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
            <StatRow label="Logins today" value={profile.activity.logins_today} />
            <StatRow label="Logins this week" value={profile.activity.logins_week} />
            <StatRow label="Assignments created (7d)" value={profile.activity.assignments_created} />
            <StatRow label="Messages sent (7d)" value={profile.activity.messages_sent} />
          </div>
        </Card>

        {/* Reassignment history */}
        {profile.reassignment_history.length > 0 && (
          <Card padding="md" className="md:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-white">Class Reassignment History</h2>
            <div className="space-y-2">
              {profile.reassignment_history.map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="text-white/30">
                    {new Date(r.reassigned_at).toLocaleDateString()}
                  </span>
                  <span className="text-white/60">Class reassigned to another teacher</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Reassign modal */}
      {reassignClass && schoolId && (
        <ReassignModal
          teacherId={teacherId}
          classId={reassignClass.class_id}
          className={reassignClass.name}
          schoolId={schoolId}
          token={token}
          onClose={() => setReassignClass(null)}
          onDone={() => {
            setReassignClass(null);
            // Refresh profile
            if (schoolId && teacherId) {
              fetch(`/api/school-admin/${schoolId}/teachers/${teacherId}`, { headers: auth })
                .then((r) => r.json()).then(setProfile);
            }
          }}
        />
      )}
    </SchoolLayout>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  );
}
