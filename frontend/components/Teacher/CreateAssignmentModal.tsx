import React, { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui";
import { ASSIGNMENT_TYPES } from "./types";

interface ClassOption {
  class_id: string;
  class_name: string;
}

export default function CreateAssignmentModal({
  classes,
  defaultClassId,
  onClose,
  onCreate,
}: {
  classes: ClassOption[];
  defaultClassId?: string;
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [classId, setClassId] = useState(defaultClassId || classes[0]?.class_id || "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("document");
  const [link, setLink] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [deadlineType, setDeadlineType] = useState("allow_anytime");
  const [penaltyPct, setPenaltyPct] = useState(10);
  const [penaltyDays, setPenaltyDays] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!classId) return setError("Pick a class.");
    if (!name.trim()) return setError("Name is required.");
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        class_id: classId,
        name: name.trim(),
        description: description.trim() || null,
        assignment_type: type,
        content_data: link.trim() ? { url: link.trim() } : {},
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        deadline_type: deadlineType,
        late_penalty_percent: deadlineType === "late_with_penalty" ? penaltyPct : null,
        late_penalty_days: deadlineType === "late_with_penalty" ? penaltyDays : null,
        assigned_to_type: "whole_class",
      });
    } catch {
      setError("Couldn't create the assignment.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">New assignment</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/50 hover:bg-surface hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Class">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input-field">
              {classes.length === 0 && <option value="">No classes</option>}
              {classes.map((c) => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
            </select>
          </Field>
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Listening Quiz 1" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field min-h-[72px]" placeholder="Instructions for students…" />
          </Field>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className="input-field">
              {ASSIGNMENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {(type === "external_link" || type === "video") && (
            <Field label="Link / URL">
              <input value={link} onChange={(e) => setLink(e.target.value)} className="input-field" placeholder="https://…" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
            </Field>
            <Field label="When due passes">
              <select value={deadlineType} onChange={(e) => setDeadlineType(e.target.value)} className="input-field">
                <option value="allow_anytime">Allow late (mark late)</option>
                <option value="hard_cutoff">Hard cutoff</option>
                <option value="late_with_penalty">Late with penalty</option>
              </select>
            </Field>
          </div>
          {deadlineType === "late_with_penalty" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Penalty %"><input type="number" value={penaltyPct} onChange={(e) => setPenaltyPct(Number(e.target.value))} className="input-field" /></Field>
              <Field label="For (days)"><input type="number" value={penaltyDays} onChange={(e) => setPenaltyDays(Number(e.target.value))} className="input-field" /></Field>
            </div>
          )}
          {error && <p className="text-sm text-error">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} loading={saving}>Create &amp; assign</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-white/40">{label}</label>
      {children}
    </div>
  );
}
