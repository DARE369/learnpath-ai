import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { Plus, Pencil, Archive, Copy, Users, BookOpen } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton, EmptyState } from "../../../components/ui";
import SettingsLayout from "../../../components/Teacher/SettingsLayout";

interface ClassItem {
  class_id: string;
  name: string;
  subject: string;
  description: string;
  max_students: number;
  student_count: number;
  is_archived: boolean;
}

type ModalMode = null | "create" | "edit" | "duplicate";

export default function ClassesSettingsPage() {
  const { accessToken } = useAuth();
  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [classes, setClasses] = useState<ClassItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [target, setTarget] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", description: "", max_students: 30 });
  const [dupName, setDupName] = useState("");
  const [copyRoster, setCopyRoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    const res = await fetch("/api/settings/classes", { headers: auth });
    if (res.ok) setClasses(await res.json());
    setLoading(false);
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setForm({ name: "", subject: "", description: "", max_students: 30 });
    setModal("create");
    setMsg("");
  }

  function openEdit(cls: ClassItem) {
    setTarget(cls);
    setForm({ name: cls.name, subject: cls.subject, description: cls.description, max_students: cls.max_students });
    setModal("edit");
    setMsg("");
  }

  function openDuplicate(cls: ClassItem) {
    setTarget(cls);
    setDupName(`${cls.name} — Copy`);
    setCopyRoster(false);
    setModal("duplicate");
    setMsg("");
  }

  async function submit() {
    setSubmitting(true);
    try {
      if (modal === "create") {
        const res = await fetch("/api/settings/classes", {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
      } else if (modal === "edit" && target) {
        const res = await fetch(`/api/settings/classes/${target.class_id}`, {
          method: "PUT",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
      } else if (modal === "duplicate" && target) {
        const res = await fetch(`/api/settings/classes/${target.class_id}/duplicate`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ new_name: dupName, copy_roster: copyRoster }),
        });
        if (!res.ok) throw new Error();
      }
      setModal(null);
      await load();
    } catch {
      setMsg("Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function archive(classId: string) {
    await fetch(`/api/settings/classes/${classId}/archive`, { method: "POST", headers: auth });
    await load();
  }

  const active = (classes || []).filter((c) => !c.is_archived);
  const archived = (classes || []).filter((c) => c.is_archived);

  return (
    <SettingsLayout>
      <Head><title>Classes — Settings</title></Head>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Your Classes</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New Class
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !active.length ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No classes yet"
          description="Create your first class to get started."
        />
      ) : (
        <>
          <div className="space-y-2">
            {active.map((cls) => (
              <Card key={cls.class_id} padding="md">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{cls.name}</p>
                    <p className="text-xs text-white/40">
                      {cls.subject && <>{cls.subject} · </>}
                      <Users className="mb-0.5 inline h-3 w-3" /> {cls.student_count} / {cls.max_students} students
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(cls)} className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-white" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => openDuplicate(cls)} className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-white" title="Duplicate">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => archive(cls.class_id)} className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-amber-400" title="Archive">
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {archived.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-white/30 hover:text-white/50">
                {archived.length} archived class{archived.length !== 1 ? "es" : ""}
              </summary>
              <div className="mt-2 space-y-2">
                {archived.map((cls) => (
                  <Card key={cls.class_id} padding="md">
                    <p className="text-sm text-white/40 line-through">{cls.name}</p>
                    <p className="text-xs text-white/20">{cls.student_count} students</p>
                  </Card>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-bold text-white">
              {modal === "create" ? "New Class" : modal === "edit" ? "Edit Class" : "Duplicate Class"}
            </h3>

            {modal === "duplicate" ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/50">New class name</label>
                  <input type="text" value={dupName} onChange={(e) => setDupName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                </div>
                <label className="flex items-center gap-2 text-sm text-white/60">
                  <input type="checkbox" checked={copyRoster} onChange={(e) => setCopyRoster(e.target.checked)} className="accent-indigo-500" />
                  Copy student roster
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                {[["Class name *", "name", "text"], ["Subject", "subject", "text"], ["Description", "description", "text"]].map(([label, key]) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-white/50">{label}</label>
                    <input type="text" value={form[key as keyof typeof form] as string}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                  </div>
                ))}
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/50">Max students</label>
                  <input type="number" min={1} value={form.max_students}
                    onChange={(e) => setForm((f) => ({ ...f, max_students: Number(e.target.value) }))}
                    className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
            )}

            {msg && <p className="mt-2 text-xs text-red-400">{msg}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setModal(null)} disabled={submitting}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={submitting || (!form.name && modal !== "duplicate")}>
                {submitting ? "Saving…" : modal === "create" ? "Create" : modal === "edit" ? "Save" : "Duplicate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
