import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui";

export interface TeacherOption { id: string; name: string }
export interface ClassOption { class_id: string; name: string; students: number; max_students: number }

function Shell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/50 hover:bg-surface hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">{children}</div>
        <div className="mt-5 flex justify-end gap-3">{footer}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs text-white/40">{label}</label>{children}</div>;
}

interface FormInitial {
  name?: string; subject?: string | null; description?: string | null;
  teacher_id?: string | null; grade_level?: number | null; max_students?: number;
}

/** Create or edit a class. `initial` present => edit mode (PUT). */
export function ClassFormModal({
  schoolId, token, teachers, initial, classId, onClose, onDone,
}: {
  schoolId: string; token: string; teachers: TeacherOption[];
  initial?: FormInitial; classId?: string; onClose: () => void; onDone: () => void;
}) {
  const editing = !!classId;
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [teacherId, setTeacherId] = useState(initial?.teacher_id ?? "");
  const [grade, setGrade] = useState<string>(initial?.grade_level != null ? String(initial.grade_level) : "");
  const [maxStudents, setMaxStudents] = useState(initial?.max_students ?? 30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return setError("Class name is required.");
    setSaving(true); setError(null);
    const body = {
      name: name.trim(), subject: subject || null, description: description || null,
      teacher_id: teacherId || null, grade_level: grade ? Number(grade) : null, max_students: Number(maxStudents),
    };
    const url = editing ? `/api/school-admin/${schoolId}/classes/${classId}` : `/api/school-admin/${schoolId}/classes`;
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) { onDone(); } else { setError("Couldn't save the class."); setSaving(false); }
  }

  return (
    <Shell title={editing ? "Edit class" : "Create class"} onClose={onClose}
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={submit} loading={saving}>{editing ? "Save changes" : "Create class"}</Button>
      </>}>
      <Field label="Class name"><input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Math 101" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Subject"><input value={subject ?? ""} onChange={(e) => setSubject(e.target.value)} className="input-field" placeholder="Mathematics" /></Field>
        <Field label="Grade level"><input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} className="input-field" placeholder="9" /></Field>
      </div>
      <Field label="Teacher">
        <select value={teacherId ?? ""} onChange={(e) => setTeacherId(e.target.value)} className="input-field">
          <option value="">Unassigned</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Max students"><input type="number" value={maxStudents} onChange={(e) => setMaxStudents(Number(e.target.value))} className="input-field" /></Field>
      <Field label="Description"><textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} className="input-field min-h-[72px]" /></Field>
      {error && <p className="text-sm text-error">{error}</p>}
    </Shell>
  );
}

export function DuplicateModal({
  schoolId, token, classId, sourceName, teachers, onClose, onDone,
}: {
  schoolId: string; token: string; classId: string; sourceName: string;
  teachers: TeacherOption[]; onClose: () => void; onDone: () => void;
}) {
  const [newName, setNewName] = useState(`${sourceName} (copy)`);
  const [teacherId, setTeacherId] = useState("");
  const [copyRoster, setCopyRoster] = useState(true);
  const [copyAssignments, setCopyAssignments] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const res = await fetch(`/api/school-admin/${schoolId}/classes/${classId}/duplicate`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ new_name: newName.trim(), teacher_id: teacherId || null, copy_roster: copyRoster, copy_assignments: copyAssignments }),
    });
    if (res.ok) onDone(); else setSaving(false);
  }

  return (
    <Shell title={`Duplicate ${sourceName}`} onClose={onClose}
      footer={<><Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button><Button size="sm" onClick={submit} loading={saving}>Duplicate</Button></>}>
      <Field label="New class name"><input value={newName} onChange={(e) => setNewName(e.target.value)} className="input-field" /></Field>
      <Field label="Teacher">
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="input-field">
          <option value="">Same as original</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Check label="Copy roster (students enrolled in both classes)" checked={copyRoster} onChange={setCopyRoster} />
      <Check label="Copy assignments (students start fresh)" checked={copyAssignments} onChange={setCopyAssignments} />
    </Shell>
  );
}

export function MergeModal({
  schoolId, token, classId, sourceName, targets, onClose, onDone,
}: {
  schoolId: string; token: string; classId: string; sourceName: string;
  targets: ClassOption[]; onClose: () => void; onDone: () => void;
}) {
  const options = targets.filter((c) => c.class_id !== classId);
  const [targetId, setTargetId] = useState(options[0]?.class_id ?? "");
  const [resolution, setResolution] = useState("skip");
  const [archiveSource, setArchiveSource] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!targetId) return setError("Pick a target class.");
    setSaving(true); setError(null);
    const res = await fetch(`/api/school-admin/${schoolId}/classes/${classId}/merge`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ target_class_id: targetId, conflict_resolution: resolution, archive_source: archiveSource }),
    });
    if (res.ok) onDone(); else { setError("Merge failed."); setSaving(false); }
  }

  return (
    <Shell title={`Merge ${sourceName} into…`} onClose={onClose}
      footer={<><Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button><Button size="sm" variant="danger" onClick={submit} loading={saving}>Merge</Button></>}>
      <Field label="Merge into">
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="input-field">
          {options.length === 0 && <option value="">No other classes</option>}
          {options.map((c) => <option key={c.class_id} value={c.class_id}>{c.name} ({c.students}/{c.max_students})</option>)}
        </select>
      </Field>
      <Field label="If a student is already in the target">
        <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="input-field">
          <option value="skip">Skip them</option>
          <option value="add_anyway">Keep existing enrollment</option>
        </select>
      </Field>
      <Check label="Archive the source class after merging" checked={archiveSource} onChange={setArchiveSource} />
      <p className="text-xs text-white/40">Students and assignments move from {sourceName} to the target. This can&apos;t be undone.</p>
      {error && <p className="text-sm text-error">{error}</p>}
    </Shell>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/70">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-surface text-accent" />
      {label}
    </label>
  );
}
