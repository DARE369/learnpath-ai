import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Plus, ClipboardList, ArrowUpRight, Trash2 } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Button, Skeleton, Badge, EmptyState } from "../../../components/ui";
import CreateAssignmentModal from "../../../components/Teacher/CreateAssignmentModal";
import { AssignmentListItem, ASSIGNMENT_TYPE_LABEL } from "../../../components/Teacher/types";

interface ClassOption { class_id: string; class_name: string }

export default function AssignmentsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const defaultClass = typeof router.query.class === "string" ? router.query.class : undefined;

  const [items, setItems] = useState<AssignmentListItem[] | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [a, d] = await Promise.all([
        fetch("/api/teachers/assignments", { headers: auth }),
        fetch("/api/teachers/dashboard", { headers: auth }),
      ]);
      if (!a.ok) throw new Error();
      setItems((await a.json()).assignments ?? []);
      if (d.ok) {
        const dash = await d.json();
        setClasses((dash.classes ?? []).map((c: { class_id: string; class_name: string }) => ({ class_id: c.class_id, class_name: c.class_name })));
      }
    } catch {
      setError("Couldn't load assignments.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  async function create(payload: Record<string, unknown>) {
    const res = await fetch("/api/teachers/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth || {}) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
    setCreating(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this assignment and its submissions?")) return;
    await fetch(`/api/teachers/assignments/${id}`, { method: "DELETE", headers: auth });
    await load();
  }

  return (
    <>
      <Head><title>Assignments — LearnPath AI</title></Head>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Assignments</h1>
            <p className="mt-1 text-sm text-white/40">Create homework and quizzes, then track and grade submissions.</p>
          </div>
          <Button onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" />} disabled={classes.length === 0}>New assignment</Button>
        </div>

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : error ? (
          <Card><p className="text-sm text-error">{error}</p><Button className="mt-3" size="sm" variant="secondary" onClick={load}>Retry</Button></Card>
        ) : !items || items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No assignments yet"
            description={classes.length === 0 ? "Create a class first, then you can assign work." : "Create your first assignment to give your class homework or a quiz."}
            action={classes.length > 0 ? <Button size="sm" onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" />}>New assignment</Button> : undefined}
          />
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <Card key={a.id} padding="md" className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-white">{a.name}</h3>
                    <Badge tone="neutral">{ASSIGNMENT_TYPE_LABEL[a.assignment_type] || a.assignment_type}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-white/40">
                    {a.class_name}{a.due_date ? ` · due ${new Date(a.due_date).toLocaleString()}` : " · no due date"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p className="font-semibold text-white tabular-nums">{a.submitted}/{a.total}</p>
                    <p className="text-xs text-white/40">submitted{a.graded ? ` · ${a.graded} graded` : ""}</p>
                  </div>
                  <Button size="sm" variant="secondary" href={`/teacher/assignments/${a.id}/responses`} rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}>Responses</Button>
                  <button onClick={() => remove(a.id)} aria-label="Delete" title="Delete" className="rounded-lg p-2 text-white/40 hover:bg-error-muted hover:text-error"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <CreateAssignmentModal classes={classes} defaultClassId={defaultClass} onClose={() => setCreating(false)} onCreate={create} />
      )}
    </>
  );
}
