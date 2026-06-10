import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Megaphone, Plus, Clock, CheckCheck, Users } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton, EmptyState } from "../../../components/ui";

interface AnnouncementItem {
  announcement_id: string;
  title: string;
  content: string;
  sent_at: string | null;
  status: string;
  read_count: number;
  total_recipients: number;
}

interface ClassOption {
  class_id: string;
  class_name: string;
  student_count: number;
}

interface NewAnnForm {
  class_id: string;
  title: string;
  content: string;
  scheduled_for: string;
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [items, setItems] = useState<AnnouncementItem[] | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewAnnForm>({ class_id: "", title: "", content: "", scheduled_for: "" });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [annRes, dashRes] = await Promise.all([
        fetch("/api/messaging/announcements", { headers: auth }),
        fetch("/api/teachers/dashboard", { headers: auth }),
      ]);
      if (annRes.ok) setItems((await annRes.json()).announcements ?? []);
      if (dashRes.ok) {
        const d = await dashRes.json();
        setClasses(d.classes ?? []);
        if (!form.class_id && d.classes?.length) {
          setForm((f) => ({ ...f, class_id: d.classes[0].class_id }));
        }
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!form.class_id || !form.title || !form.content) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/messaging/announcements", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: form.class_id,
          title: form.title,
          content: form.content,
          scheduled_for: form.scheduled_for || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setSuccessMsg(`Announcement posted to ${d.recipients} student${d.recipients !== 1 ? "s" : ""} ✓`);
      setShowModal(false);
      setForm((f) => ({ ...f, title: "", content: "", scheduled_for: "" }));
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head><title>Announcements — LearnPath AI</title></Head>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Announcements</h1>
            <p className="mt-0.5 text-sm text-white/40">Broadcast messages to your whole class. Students cannot reply.</p>
          </div>
          <Button size="sm" onClick={() => { setShowModal(true); setSuccessMsg(""); }}>
            <Plus className="mr-1.5 h-4 w-4" /> New Announcement
          </Button>
        </div>

        {successMsg && (
          <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {successMsg}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : !items?.length ? (
          <EmptyState
            icon={<Megaphone className="h-5 w-5" />}
            title="No announcements yet"
            description="Post your first announcement to keep students informed."
          />
        ) : (
          <div className="space-y-3">
            {items.map((ann) => {
              const readPct = ann.total_recipients > 0
                ? Math.round((ann.read_count / ann.total_recipients) * 100)
                : 0;
              const allRead = ann.read_count >= ann.total_recipients && ann.total_recipients > 0;
              return (
                <Card key={ann.announcement_id} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-white">{ann.title}</p>
                        {ann.status === "scheduled" && (
                          <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                            Scheduled
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-white/40">{ann.content}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-white/30">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDate(ann.sent_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {ann.total_recipients} recipients
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-white tabular-nums">
                        {ann.read_count}/{ann.total_recipients}
                      </p>
                      <p className={`text-xs ${allRead ? "text-emerald-400" : "text-white/40"}`}>
                        {allRead ? <span className="flex items-center gap-0.5"><CheckCheck className="h-3 w-3" /> All read</span> : `${readPct}% read`}
                      </p>
                    </div>
                  </div>
                  {!allRead && ann.total_recipients > 0 && (
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${readPct}%` }}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Back link */}
        <button
          onClick={() => router.push("/teacher/messages")}
          className="mt-6 text-xs text-indigo-400 hover:text-indigo-300"
        >
          ← Back to messages
        </button>
      </div>

      {/* New announcement modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-white">New Announcement</h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Class</label>
                <select
                  value={form.class_id}
                  onChange={(e) => setForm((f) => ({ ...f, class_id: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.class_id} value={c.class_id}>
                      {c.class_name} ({c.student_count} students)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Quiz 1 Retake Available"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Message</label>
                <textarea
                  rows={4}
                  placeholder="Write your announcement…"
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">
                  Schedule (optional — leave blank to send now)
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduled_for}
                  onChange={(e) => setForm((f) => ({ ...f, scheduled_for: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={submitting || !form.class_id || !form.title || !form.content}
                onClick={submit}
              >
                {submitting ? "Posting…" : form.scheduled_for ? "Schedule" : "Post"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
