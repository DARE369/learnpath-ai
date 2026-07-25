import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../../hooks/useAuth";
import { Button, Card, TextField, Select, Textarea } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";

interface Step1Data {
  school_name: string;
  district_name: string;
  phone: string;
  address: string;
  timezone: string;
  teachers_needed: number;
}

const TIMEZONES = [
  "UTC", "Africa/Lagos", "America/New_York", "America/Chicago",
  "America/Los_Angeles", "America/Sao_Paulo", "Europe/London",
  "Europe/Paris", "Asia/Dubai", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney",
];

const STEP_LABELS = ["Profile", "Invite teachers", "Upload students", "Review"];

function StepIndicator({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 32 }}>
      {STEP_LABELS.map((label, i) => {
        const idx = i + 1;
        const done = idx < step + 1 && idx <= step;
        const current = idx === step + 1;
        const barColor = done ? color.success.fg : current ? "#2B3A67" : color.borderMuted;
        const textColor = done ? color.success.fg : current ? "#2B3A67" : color.textFainter;
        return (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 100, background: barColor }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: textColor, marginTop: 8 }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function SchoolOnboardingPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [step, setStep] = useState(0);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [s1, setS1] = useState<Step1Data>({
    school_name: "", district_name: "", phone: "", address: "", timezone: "UTC", teachers_needed: 30,
  });
  const [s2Emails, setS2Emails] = useState("");
  const [s2Result, setS2Result] = useState<{ sent: number } | null>(null);
  const [s3Csv, setS3Csv] = useState("");
  const [s3Result, setS3Result] = useState<{ created: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sid = typeof window !== "undefined" ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id") : null;
    if (sid) setSchoolId(sid);
  }, []);

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

  async function submitStep2(skip: boolean) {
    if (!skip && s2Emails.trim() && schoolId) {
      setBusy(true);
      try {
        const lines = s2Emails.split(/[\n,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
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

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setS3Csv((ev.target?.result as string) || "");
    reader.readAsText(f);
  }

  async function submitStep3(skip: boolean) {
    if (!skip && s3Csv && schoolId) {
      setBusy(true);
      try {
        const res = await fetch(`/api/school-admin/${schoolId}/upload-students`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ csv_text: s3Csv }),
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

  async function finish() {
    if (!schoolId) return;
    setBusy(true);
    await fetch(`/api/school-admin/${schoolId}/onboarding/complete`, { method: "POST", headers: auth });
    setBusy(false);
    router.replace("/school/dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "64px 24px", color: color.ink, background: color.paper, fontFamily: font.body }}>
      <Head><title>School Setup — LearnPath AI</title></Head>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 19, marginBottom: 28 }}>
          LearnPath <span style={{ opacity: 0.5, fontSize: 13, fontWeight: 400 }}>School setup</span>
        </div>

        <StepIndicator step={step} />

        {step === 0 && (
          <Card padding="lg">
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 20, marginBottom: 6 }}>School profile</div>
            <div style={{ fontSize: 13, color: color.textFaint, marginBottom: 22 }}>Tell us about your institution.</div>
            <div style={{ display: "grid", gap: 14, marginBottom: 22 }}>
              <TextField label="School name *" value={s1.school_name} onChange={(e) => setS1((p) => ({ ...p, school_name: e.target.value }))} placeholder="Lincoln High School" />
              <TextField label="District / Organisation name" value={s1.district_name} onChange={(e) => setS1((p) => ({ ...p, district_name: e.target.value }))} placeholder="Springfield School District" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <TextField label="Phone" value={s1.phone} onChange={(e) => setS1((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
                <Select label="Timezone" value={s1.timezone} onChange={(e) => setS1((p) => ({ ...p, timezone: e.target.value }))}>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </Select>
              </div>
              <TextField label="Address" value={s1.address} onChange={(e) => setS1((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St, Springfield" />
              <TextField label="Expected teacher count" type="number" min={1} value={s1.teachers_needed} onChange={(e) => setS1((p) => ({ ...p, teachers_needed: Number(e.target.value) }))} />
            </div>
            {error && <div style={{ fontSize: 12.5, color: color.danger.fg, marginBottom: 14 }}>{error}</div>}
            <Button fullWidth disabled={busy || !s1.school_name} onClick={submitStep1}>{busy ? "Saving…" : "Continue"}</Button>
          </Card>
        )}

        {step === 1 && (
          <Card padding="lg">
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Invite teachers</div>
            <div style={{ fontSize: 13, color: color.textFaint, marginBottom: 18 }}>Paste emails below, one per line. You can skip this and invite later.</div>
            {s2Result && (
              <div style={{ fontSize: 13, color: color.success.fg, marginBottom: 16 }}>{s2Result.sent} invitation{s2Result.sent !== 1 ? "s" : ""} sent ✓</div>
            )}
            <Textarea value={s2Emails} onChange={(e) => setS2Emails(e.target.value)} rows={6} placeholder={"teacher1@school.edu\nteacher2@school.edu"} style={{ marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <Button fullWidth disabled={busy} onClick={() => submitStep2(false)}>{busy ? "Sending…" : "Send invitations"}</Button>
              <Button variant="secondary" onClick={() => submitStep2(true)}>Skip</Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card padding="lg">
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Upload student roster</div>
            <div style={{ fontSize: 13, color: color.textFaint, marginBottom: 18 }}>CSV with <b>email, name, grade</b> columns. You can skip this and upload later.</div>
            {s3Result && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: color.success.fg }}>{s3Result.created} students created ✓</div>
                {s3Result.errors > 0 && <div style={{ fontSize: 12.5, color: color.warning.fg, marginTop: 4 }}>{s3Result.errors} row(s) failed to import — check formatting.</div>}
              </div>
            )}
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ width: "100%", border: "1.5px dashed #CFCBC0", borderRadius: 10, padding: 36, textAlign: "center", cursor: "pointer", marginBottom: 16, color: color.textFaint, fontSize: 13.5, background: "transparent" }}
            >
              {s3Csv ? "CSV loaded — ready to upload" : "Click to select a CSV file, or drag one here"}
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <Button fullWidth disabled={busy || !s3Csv} onClick={() => submitStep3(false)}>{busy ? "Uploading…" : "Upload & continue"}</Button>
              <Button variant="secondary" onClick={() => submitStep3(true)}>Skip</Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card padding="lg">
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 20, marginBottom: 18 }}>Review & finish</div>
            <div>
              <SummaryRow label="School name" value={s1.school_name || "—"} />
              <SummaryRow label="District" value={s1.district_name || "—"} />
              <SummaryRow label="Timezone" value={s1.timezone} />
              <SummaryRow label="Teachers invited" value={s2Result ? `${s2Result.sent}` : "0 (skipped)"} />
              <SummaryRow label="Students created" value={s3Result ? `${s3Result.created}` : "0 (skipped)"} last />
            </div>
            <Button fullWidth style={{ marginTop: 20 }} disabled={busy} onClick={finish}>{busy ? "Finishing…" : "Go to School Dashboard"}</Button>
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: last ? "none" : `1px solid ${color.borderMuted}`, fontSize: 13.5 }}>
      <span style={{ color: color.inkSoft }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
