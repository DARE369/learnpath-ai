import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Upload,
  UserPlus,
  Settings2,
  Plug,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Button, Card } from "../../components/ui";

// ── Types ──────────────────────────────────────────────────────────────────

interface Step1Data {
  school_name: string;
  district_name: string;
  phone: string;
  address: string;
  timezone: string;
  teachers_needed: number;
}

interface InviteItem { email: string }

interface Step2Data { emails: string }  // raw textarea

interface Step3Data { csvText: string }

const TIMEZONES = [
  "UTC", "Africa/Lagos", "America/New_York", "America/Chicago",
  "America/Los_Angeles", "America/Sao_Paulo", "Europe/London",
  "Europe/Paris", "Asia/Dubai", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney",
];

const STEPS = [
  { label: "School Info", icon: Building2 },
  { label: "Invite Teachers", icon: UserPlus },
  { label: "Student Roster", icon: Upload },
  { label: "Configure", icon: Settings2 },
];

// ── Shared sub-components ──────────────────────────────────────────────────

function StepHeader({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <div className="mb-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-400">
        Step {index + 1} of {STEPS.length}
      </p>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm text-white/50">{description}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-white/60">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none";

// ── Onboarding wizard ──────────────────────────────────────────────────────

export default function SchoolOnboardingPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [step, setStep] = useState(0);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Step data
  const [s1, setS1] = useState<Step1Data>({
    school_name: "",
    district_name: "",
    phone: "",
    address: "",
    timezone: "UTC",
    teachers_needed: 30,
  });
  const [s2, setS2] = useState<Step2Data>({ emails: "" });
  const [s2Result, setS2Result] = useState<{ sent: number } | null>(null);
  const [s3, setS3] = useState<Step3Data>({ csvText: "" });
  const [s3Result, setS3Result] = useState<{ created: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sid =
      typeof window !== "undefined"
        ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id")
        : null;
    if (sid) setSchoolId(sid);
  }, []);

  // ── Step 1: School info ───────────────────────────────────────────────

  async function submitStep1() {
    if (!s1.school_name.trim()) { setError("School name is required"); return; }
    if (!schoolId) { setError("No school ID found. Please re-login."); return; }
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/school-admin/${schoolId}/onboarding/start`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(s1),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "Failed to save school info");
        return;
      }
      setStep(1);
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: Invite teachers ───────────────────────────────────────────

  async function submitStep2(skip = false) {
    if (!skip && !s2.emails.trim()) { setStep(2); return; }
    if (!skip && schoolId) {
      setBusy(true);
      try {
        const lines = s2.emails
          .split(/[\n,;]+/)
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        const res = await fetch(`/api/school-admin/${schoolId}/invite-teachers`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ teachers: lines.map((email) => ({ email })) }),
        });
        if (res.ok) {
          const d = await res.json();
          setS2Result({ sent: d.sent ?? 0 });
        }
      } finally {
        setBusy(false);
      }
    }
    setStep(2);
  }

  // ── Step 3: Student upload ────────────────────────────────────────────

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setS3({ csvText: (ev.target?.result as string) || "" });
    reader.readAsText(f);
  }

  async function submitStep3(skip = false) {
    if (!skip && s3.csvText && schoolId) {
      setBusy(true);
      try {
        const res = await fetch(`/api/school-admin/${schoolId}/upload-students`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ csv_text: s3.csvText }),
        });
        if (res.ok) {
          const d = await res.json();
          setS3Result({ created: d.created ?? 0, errors: (d.errors ?? []).length });
        }
      } finally {
        setBusy(false);
      }
    }
    setStep(3);
  }

  // ── Step 4: Configure & finish ────────────────────────────────────────

  async function finish() {
    if (!schoolId) return;
    setBusy(true);
    await fetch(`/api/school-admin/${schoolId}/onboarding/complete`, {
      method: "POST",
      headers: auth,
    });
    setBusy(false);
    router.replace("/school/dashboard");
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-[#0f0f0f]">
      <Head><title>School Setup — LearnPath</title></Head>

      {/* Top stepper */}
      <div className="border-b border-white/5 bg-[#141414] px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-0">
          {STEPS.map(({ label, icon: Icon }, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    i < step
                      ? "bg-indigo-600 text-white"
                      : i === step
                      ? "border-2 border-indigo-500 text-indigo-400"
                      : "border border-white/10 text-white/20"
                  }`}
                >
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`hidden text-xs sm:block ${i === step ? "text-white" : "text-white/30"}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mx-2 ${i < step ? "bg-indigo-600" : "bg-white/10"}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">

          {/* Step 1 */}
          {step === 0 && (
            <Card padding="md">
              <StepHeader
                index={0}
                title="Tell us about your school"
                description="Set up your school profile so teachers and students know where they belong."
              />
              <div className="space-y-4">
                <Field label="School name *">
                  <input
                    value={s1.school_name}
                    onChange={(e) => setS1((p) => ({ ...p, school_name: e.target.value }))}
                    placeholder="Lincoln High School"
                    className={inputCls}
                  />
                </Field>
                <Field label="District / Organisation name">
                  <input
                    value={s1.district_name}
                    onChange={(e) => setS1((p) => ({ ...p, district_name: e.target.value }))}
                    placeholder="Springfield School District"
                    className={inputCls}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={s1.phone}
                    onChange={(e) => setS1((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 555 000 0000"
                    className={inputCls}
                  />
                </Field>
                <Field label="Address">
                  <input
                    value={s1.address}
                    onChange={(e) => setS1((p) => ({ ...p, address: e.target.value }))}
                    placeholder="123 Main St, Springfield"
                    className={inputCls}
                  />
                </Field>
                <Field label="Timezone">
                  <select
                    value={s1.timezone}
                    onChange={(e) => setS1((p) => ({ ...p, timezone: e.target.value }))}
                    className={inputCls}
                  >
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </Field>
                <Field label="How many teachers are you expecting?">
                  <input
                    type="number"
                    min={1}
                    value={s1.teachers_needed}
                    onChange={(e) => setS1((p) => ({ ...p, teachers_needed: Number(e.target.value) }))}
                    className={inputCls}
                  />
                </Field>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <Button onClick={submitStep1} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Step 2 */}
          {step === 1 && (
            <Card padding="md">
              <StepHeader
                index={1}
                title="Invite your teachers"
                description="Paste emails below. Each teacher gets a 30-day invite link."
              />
              <div className="space-y-4">
                {s2Result && (
                  <div className="rounded-lg bg-emerald-500/10 px-3 py-2">
                    <p className="text-xs text-emerald-400">{s2Result.sent} invitation{s2Result.sent !== 1 ? "s" : ""} sent ✓</p>
                  </div>
                )}
                <Field label="Teacher emails (one per line, or comma-separated)">
                  <textarea
                    value={s2.emails}
                    onChange={(e) => setS2({ emails: e.target.value })}
                    rows={6}
                    placeholder={"teacher1@school.edu\nteacher2@school.edu"}
                    className={inputCls}
                  />
                </Field>
                <div className="flex gap-3">
                  <Button onClick={() => submitStep2(false)} disabled={busy} className="flex-1">
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send invites & continue
                  </Button>
                  <Button variant="secondary" onClick={() => submitStep2(true)}>
                    Skip
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 3 */}
          {step === 2 && (
            <Card padding="md">
              <StepHeader
                index={2}
                title="Upload student roster"
                description="Import students from a CSV file. Columns: email, name, grade"
              />
              <div className="space-y-4">
                {s3Result && (
                  <div className="rounded-lg bg-emerald-500/10 px-3 py-2">
                    <p className="text-xs text-emerald-400">{s3Result.created} students created ✓</p>
                    {s3Result.errors > 0 && (
                      <p className="text-xs text-amber-400">{s3Result.errors} rows had errors</p>
                    )}
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 py-8 text-white/40 hover:border-indigo-500 hover:text-white/70"
                >
                  <Upload className="h-6 w-6" />
                  <span className="text-sm">
                    {s3.csvText ? "CSV loaded — ready to upload" : "Click to select CSV file"}
                  </span>
                  <span className="text-xs text-white/20">email, name, grade</span>
                </button>
                <div className="flex gap-3">
                  <Button
                    onClick={() => submitStep3(false)}
                    disabled={busy || !s3.csvText}
                    className="flex-1"
                  >
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Upload & continue
                  </Button>
                  <Button variant="secondary" onClick={() => submitStep3(true)}>
                    Skip
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 4 */}
          {step === 3 && (
            <Card padding="md">
              <StepHeader
                index={3}
                title="You're almost done!"
                description="Review your setup, then go to your dashboard."
              />
              <div className="space-y-4">
                <div className="space-y-3 rounded-lg bg-white/5 p-4">
                  <SummaryRow label="School name" value={s1.school_name} />
                  <SummaryRow label="District" value={s1.district_name || "—"} />
                  <SummaryRow label="Timezone" value={s1.timezone} />
                  {s2Result && <SummaryRow label="Teachers invited" value={`${s2Result.sent}`} />}
                  {s3Result && <SummaryRow label="Students enrolled" value={`${s3Result.created}`} />}
                </div>

                <div className="rounded-lg border border-white/10 p-4">
                  <div className="flex items-center gap-2">
                    <Plug className="h-4 w-4 text-indigo-400" />
                    <p className="text-sm font-medium text-white">Google Classroom</p>
                    <span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-xs text-white/40">
                      Optional
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/40">
                    Connect after setup in Integrations → Google Classroom.
                  </p>
                </div>

                <Button onClick={finish} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Go to dashboard
                </Button>
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  );
}
