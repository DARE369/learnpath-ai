import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  CheckSquare,
  ChevronDown,
  MoreHorizontal,
  RefreshCw,
  Search,
  Square,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../../components/ui";
import SchoolLayout from "../../../components/School/SchoolLayout";

// ── Types ──────────────────────────────────────────────────────────────────

interface TeacherRow {
  teacher_id: string;
  name: string;
  email: string;
  classes: number;
  students: number;
  status: "active" | "inactive" | "invited";
  last_active: string | null;
  avatar_url: string | null;
  department: string | null;
}

interface Pagination { page: number; page_size: number; total: number; pages: number }

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  inactive: "bg-red-500/15 text-red-400",
  invited: "bg-amber-500/15 text-amber-400",
};

function InviteModal({
  schoolId, token, onClose, onDone,
}: { schoolId: string; token: string; onClose: () => void; onDone: () => void }) {
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
    if (res.ok) { setMsg(`Invite sent to ${email}`); onDone(); }
    else setErr(d.detail || "Failed to send invite");
    setBusy(false);
  }

  const inp = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Invite Teacher</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {msg ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-400">{msg}</p>
            <Button className="w-full" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" className={inp} />
            <div className="flex gap-2">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={inp} />
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={inp} />
            </div>
            {err && <p className="text-xs text-red-400">{err}</p>}
            <div className="flex gap-2">
              <Button onClick={send} disabled={busy || !email} className="flex-1">
                {busy ? "Sending…" : "Send invite"}
              </Button>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function TeachersListPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showInvite, setShowInvite] = useState(false);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const sid = typeof window !== "undefined"
      ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id")
      : null;
    if (sid) setSchoolId(sid);
  }, []);

  const fetchTeachers = useCallback(async (sid: string, pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), page_size: "50" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/school-admin/${sid}/teachers?${params}`, { headers: auth });
      if (res.ok) {
        const d = await res.json();
        setTeachers(d.teachers ?? []);
        setPagination(d.pagination ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (schoolId) { setPage(1); fetchTeachers(schoolId, 1); }
  }, [schoolId, search, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deactivate(teacherId: string) {
    if (!schoolId || !confirm("Deactivate this teacher?")) return;
    setBusyId(teacherId);
    await fetch(`/api/school-admin/${schoolId}/teachers/${teacherId}/deactivate`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Manual deactivation by admin" }),
    });
    setBusyId(null);
    setActionMenu(null);
    fetchTeachers(schoolId, page);
  }

  async function reactivate(teacherId: string) {
    if (!schoolId) return;
    setBusyId(teacherId);
    await fetch(`/api/school-admin/${schoolId}/teachers/${teacherId}/reactivate`, {
      method: "POST", headers: auth,
    });
    setBusyId(null);
    setActionMenu(null);
    fetchTeachers(schoolId, page);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (selected.size === teachers.length) setSelected(new Set());
    else setSelected(new Set(teachers.map((t) => t.teacher_id)));
  }

  async function bulkDeactivate() {
    if (!schoolId || selected.size === 0 || !confirm(`Deactivate ${selected.size} teachers?`)) return;
    await fetch(`/api/school-admin/${schoolId}/teachers/bulk-deactivate`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setSelected(new Set());
    fetchTeachers(schoolId, page);
  }

  return (
    <SchoolLayout>
      <Head><title>Teachers — School Admin</title></Head>

      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Teachers</h1>
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Invite teacher
        </Button>
      </div>

      {/* Filters */}
      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="invited">Invited</option>
          </select>
          <button
            onClick={() => schoolId && fetchTeachers(schoolId, page)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </Card>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-indigo-600/15 px-4 py-2">
          <span className="text-xs text-indigo-300">{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={bulkDeactivate}>
            Bulk deactivate
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-white/40 hover:text-white">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : teachers.length === 0 ? (
        <Card padding="md">
          <div className="flex flex-col items-center gap-3 py-8">
            <Users className="h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">No teachers found</p>
            <Button size="sm" onClick={() => setShowInvite(true)}>Invite first teacher</Button>
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
                      {selected.size === teachers.length && teachers.length > 0
                        ? <CheckSquare className="h-4 w-4" />
                        : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Email</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white/50">Classes</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white/50">Students</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Last active</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/50">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {teachers.map((t) => (
                  <tr key={t.teacher_id} className={`transition-colors hover:bg-white/[0.02] ${selected.has(t.teacher_id) ? "bg-indigo-600/5" : ""}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(t.teacher_id)} className="text-white/40 hover:text-white">
                        {selected.has(t.teacher_id) ? <CheckSquare className="h-4 w-4 text-indigo-400" /> : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/school/teachers/${t.teacher_id}`} className="font-medium text-white hover:text-indigo-300">
                        {t.name || "—"}
                      </Link>
                      {t.department && <p className="text-xs text-white/30">{t.department}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">{t.email}</td>
                    <td className="px-4 py-3 text-center text-xs text-white">{t.classes}</td>
                    <td className="px-4 py-3 text-center text-xs text-white">{t.students}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[t.status] ?? ""}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40">{t.last_active ?? "Never"}</td>
                    <td className="relative px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/school/teachers/${t.teacher_id}`}
                          className="rounded px-2 py-1 text-xs text-indigo-400 hover:bg-indigo-600/10"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => setActionMenu(actionMenu === t.teacher_id ? null : t.teacher_id)}
                          className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                      {actionMenu === t.teacher_id && (
                        <div className="absolute right-4 top-full z-20 mt-1 w-40 rounded-xl border border-white/10 bg-[#1f1f1f] py-1 shadow-xl">
                          {t.status === "inactive" ? (
                            <button
                              onClick={() => reactivate(t.teacher_id)}
                              disabled={busyId === t.teacher_id}
                              className="flex w-full items-center px-3 py-2 text-xs text-emerald-400 hover:bg-white/5"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => deactivate(t.teacher_id)}
                              disabled={busyId === t.teacher_id}
                              className="flex w-full items-center px-3 py-2 text-xs text-red-400 hover:bg-white/5"
                            >
                              Deactivate
                            </button>
                          )}
                          <Link
                            href={`/school/teachers/${t.teacher_id}`}
                            className="flex w-full items-center px-3 py-2 text-xs text-white/60 hover:bg-white/5"
                          >
                            View profile
                          </Link>
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
          <span>{pagination.total} teachers · page {pagination.page} of {pagination.pages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => { setPage(page - 1); schoolId && fetchTeachers(schoolId, page - 1); }}
              className="rounded px-3 py-1.5 hover:bg-white/5 disabled:opacity-30">← Prev</button>
            <button disabled={page === pagination.pages} onClick={() => { setPage(page + 1); schoolId && fetchTeachers(schoolId, page + 1); }}
              className="rounded px-3 py-1.5 hover:bg-white/5 disabled:opacity-30">Next →</button>
          </div>
        </div>
      )}

      {showInvite && schoolId && (
        <InviteModal schoolId={schoolId} token={token}
          onClose={() => setShowInvite(false)}
          onDone={() => { setShowInvite(false); schoolId && fetchTeachers(schoolId, page); }} />
      )}

      {/* Close action menu on click outside */}
      {actionMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
      )}
    </SchoolLayout>
  );
}
