import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ArrowLeft, Download, Clock } from "lucide-react";
import { useAuth } from "../../../../hooks/useAuth";
import { Card, Button, Skeleton, Badge, EmptyState } from "../../../../components/ui";
import { AssignmentResponses, ResponseRow, SUBMISSION_TONE, timeAgo } from "../../../../components/Teacher/types";

const STATUS_LABEL: Record<string, string> = {
  assigned: "Not started", submitted: "Submitted", pending_manual: "Awaiting grade", graded: "Graded",
};

export default function ResponsesPage() {
  const router = useRouter();
  const assignmentId = typeof router.query.assignmentId === "string" ? router.query.assignmentId : "";
  const { accessToken } = useAuth();

  const [data, setData] = useState<AssignmentResponses | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState<ResponseRow | null>(null);

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const load = useCallback(async () => {
    if (!assignmentId || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teachers/assignments/${assignmentId}/responses?page_size=1000`, { headers: auth });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("Couldn't load responses.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  function exportCsv() {
    if (!data) return;
    const header = ["Name", "Email", "Status", "Score", "Late", "Submitted at", "Notes"];
    const csv = [
      header.join(","),
      ...data.responses.map((r) =>
        [r.student_name, r.student_email ?? "", r.status, r.score ?? "", r.is_late ? "Yes" : "No", r.submitted_at ?? "", r.teacher_notes ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.assignment.name || "responses"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const submittedPct = data && data.stats.total ? Math.round((data.stats.submitted + data.stats.pending_manual + data.stats.graded) / data.stats.total * 100) : 0;

  return (
    <>
      <Head><title>{data?.assignment.name || "Responses"} — LearnPath AI</title></Head>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <button onClick={() => router.push("/teacher/assignments")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-accent-light hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Assignments
        </button>

        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : error || !data ? (
          <EmptyState title="Couldn't load" description={error || "No data."} />
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">{data.assignment.name}</h1>
              <p className="mt-1 text-sm text-white/40">
                {data.assignment.due_date ? `Due ${new Date(data.assignment.due_date).toLocaleString()} · ` : ""}
                {data.stats.submitted + data.stats.pending_manual + data.stats.graded}/{data.stats.total} submitted ({submittedPct}%)
              </p>
            </div>

            {/* Stats + actions */}
            <Card padding="md" className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <Stat label="Not started" value={data.stats.assigned} />
                  <Stat label="Submitted" value={data.stats.submitted + data.stats.pending_manual} />
                  <Stat label="Graded" value={data.stats.graded} />
                </div>
                <Button size="sm" variant="secondary" onClick={exportCsv} leftIcon={<Download className="h-4 w-4" />}>Export CSV</Button>
              </div>
            </Card>

            {data.responses.length === 0 ? (
              <EmptyState title="No students assigned" description="Enroll students in the class to assign work to them." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface-elevated text-left text-xs uppercase tracking-wide text-white/40">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">Submitted</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.responses.map((r) => (
                      <tr key={r.submission_id} className="hover:bg-surface-elevated/60">
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{r.student_name}</p>
                          {r.student_email && <p className="text-xs text-white/40">{r.student_email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <Badge tone={SUBMISSION_TONE[r.status] || "neutral"}>{STATUS_LABEL[r.status] || r.status}</Badge>
                            {r.is_late && <span className="inline-flex items-center gap-1 text-xs text-warning"><Clock className="h-3 w-3" />late</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-white">{r.score != null ? `${r.score}%` : "—"}</td>
                        <td className="px-4 py-3 text-white/50">{r.submitted_at ? timeAgo(r.submitted_at) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="secondary" onClick={() => setGrading(r)}>Grade</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {grading && (
        <GradeModal
          row={grading}
          onClose={() => setGrading(null)}
          onSave={async (score, notes) => {
            await fetch(`/api/teachers/submissions/${grading.submission_id}/grade`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", ...(auth || {}) },
              body: JSON.stringify({ score, notes }),
            });
            setGrading(null);
            await load();
          }}
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-white/40">{label}</p>
    </div>
  );
}

function GradeModal({ row, onClose, onSave }: { row: ResponseRow; onClose: () => void; onSave: (score: number, notes: string) => Promise<void> }) {
  const [score, setScore] = useState(row.score ?? 0);
  const [notes, setNotes] = useState(row.teacher_notes ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-6">
        <h3 className="text-lg font-semibold text-white">Grade — {row.student_name}</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-white/40">Score (0–100)</label>
            <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/40">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field min-h-[80px]" placeholder="Feedback for the student…" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={async () => { setSaving(true); await onSave(Math.max(0, Math.min(100, score)), notes); }}>Save grade</Button>
        </div>
      </div>
    </div>
  );
}
