import React, { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Target, FileText, Compass, TrendingUp, Calendar } from "lucide-react";
import QuizModal from "../components/Quiz/QuizModal";
import { Card, Modal, ModalTitle, ThresholdRing, Badge, type BadgeTone } from "../ui-v2/primitives";
import { color, font } from "../ui-v2/tokens";
import { useViewport } from "../ui-v2/useViewport";

function authHeaders(json = false): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h["Content-Type"] = "application/json";
  return h;
}

interface Track { id: string; exam_type: string; name: string; description: string; score_scale: string; sections: { name: string }[]; }
interface Enrollment { enrollment_id: string; track: Track; target_score: string; exam_date: string | null; days_to_exam: number | null; prediction: { predicted_score: string | null; readiness_percent: number | null; note: string | null }; }

function readiness(pct: number): { label: string; tone: BadgeTone } {
  if (pct >= 70) return { label: "On track", tone: "success" };
  if (pct >= 40) return { label: "Keep studying", tone: "warning" };
  return { label: "Just getting started", tone: "danger" };
}

function EnrollModal({ track, onClose, onDone }: { track: Track; onClose: () => void; onDone: () => void }) {
  const [targetScore, setTargetScore] = useState("");
  const [examDate, setExamDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/exams/enroll", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ track_id: track.id, target_score: targetScore || null, exam_date: examDate || null }) });
      if (!res.ok) throw new Error("Enrollment failed");
      onDone();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalTitle>{track.name}</ModalTitle>
      <p style={{ fontSize: 12.5, color: color.textFaint, marginBottom: 16 }}>Set up your study track.</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>
            What score are you aiming for? <span style={{ color: color.textFaint, fontWeight: 400 }}>({track.score_scale})</span>
          </label>
          <input value={targetScore} onChange={(e) => setTargetScore(e.target.value)} placeholder={`e.g. ${track.score_scale.split("-").pop()?.split(" ")[0] || "80"}`} style={{ width: "100%", padding: "9px 12px", fontSize: 13.5, border: "1px solid #CFCBC0", borderRadius: 6 }} />
          <p style={{ fontSize: 11.5, color: color.textFaint, marginTop: 5 }}>A study goal, not a promise — we&rsquo;ll use it to pace your preparation.</p>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><Calendar size={13} /> When is your exam? <span style={{ color: color.textFaint, fontWeight: 400 }}>(optional)</span></label>
          <input type="date" value={examDate} min={minDate.toISOString().split("T")[0]} onChange={(e) => setExamDate(e.target.value)} style={{ width: "100%", padding: "9px 12px", fontSize: 13.5, border: "1px solid #CFCBC0", borderRadius: 6 }} />
        </div>
        {error && <p style={{ fontSize: 12, color: color.danger.fg, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 600, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", cursor: "pointer" }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>{saving ? "Starting…" : "Start preparing"}</button>
        </div>
      </form>
    </Modal>
  );
}

function LogMockModal({ enrollment, onClose, onDone }: { enrollment: Enrollment; onClose: () => void; onDone: () => void }) {
  const [score, setScore] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pct = Math.max(0, Math.min(100, parseInt(score, 10) || 0));
    setSaving(true);
    try {
      await fetch("/api/exams/mock", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ track_id: enrollment.track.id, overall_percent: pct, section_scores: {} }) });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={360}>
      <ModalTitle>Log mock score</ModalTitle>
      <p style={{ fontSize: 12, color: color.textFaint, marginBottom: 16 }}>{enrollment.track.name}</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>Overall score (%)</label>
          <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 68" autoFocus style={{ width: "100%", padding: "9px 12px", fontSize: 13.5, border: "1px solid #CFCBC0", borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 600, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", cursor: "pointer" }}>Cancel</button>
          <button type="submit" disabled={saving || !score} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>{saving ? "Saving…" : "Save score"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function ExamsPage() {
  const { isMobile } = useViewport();
  const router = useRouter();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [practiceTrack, setPracticeTrack] = useState<Track | null>(null);
  const [enrollModal, setEnrollModal] = useState<Track | null>(null);
  const [logMockModal, setLogMockModal] = useState<Enrollment | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([
        fetch("/api/exams/tracks", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/exams/enrollments", { headers: authHeaders() }).then((r) => r.json()),
      ]);
      setTracks(t.tracks || []);
      setEnrollments(e.enrollments || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const buildPath = async (e: Enrollment) => {
    setBusy(e.enrollment_id);
    try {
      const res = await fetch(`/api/exams/tracks/${e.track.id}/build-path`, { method: "POST", headers: authHeaders(true) });
      const data = await res.json();
      if (res.ok && data.id) router.push(`/paths/${data.id}`);
    } finally { setBusy(null); }
  };

  const enrolledTypes = new Set(enrollments.map((e) => e.track.exam_type));
  const btnStyle = (bg: string, fg: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: bg === "#fff" ? `1px solid ${color.border}` : "none", background: bg, color: fg, cursor: "pointer" });

  return (
    <>
      <Head><title>Exam Prep — LearnPath AI</title></Head>
      <div style={{ maxWidth: 900, fontFamily: font.body }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>Exam prep</h1>
        <p style={{ color: color.textFaint, fontSize: 13.5, marginTop: 4 }}>Structured study tracks built around what you actually need to learn.</p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><div style={{ width: 32, height: 32, border: "2px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", margin: "0 auto", animation: "spin 0.8s linear infinite" }} /></div>
        ) : (
          <>
            {enrollments.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: isMobile ? 12 : 16, marginTop: 24, marginBottom: 8 }}>
                {enrollments.map((e) => {
                  const pct = e.prediction.readiness_percent ?? 0;
                  const r = readiness(pct);
                  return (
                    <Card key={e.enrollment_id} padding="md">
                      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                        <ThresholdRing pct={pct} size={58} unknown={e.prediction.readiness_percent == null} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{e.track.name}</div>
                          <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>
                            {e.target_score ? `Target: ${e.target_score}` : "No target set"} · {e.days_to_exam != null ? `${e.days_to_exam}d to exam` : "no date set"}
                          </div>
                          <div style={{ marginTop: 6 }}><Badge tone={r.tone}>{e.prediction.readiness_percent == null ? "Take a few quizzes to unlock a score prediction" : r.label}</Badge></div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => setPracticeTrack(e.track)} style={btnStyle("#2B3A67", "#fff")}><Target size={13} /> Practice</button>
                        <button onClick={() => router.push(`/exams/mock/${e.track.id}`)} style={btnStyle("#fff", color.ink)}><FileText size={13} /> Mock exam</button>
                        <button onClick={() => buildPath(e)} disabled={busy === e.enrollment_id} style={btnStyle("#F0EEE7", color.inkSoft)}><Compass size={13} /> Build path</button>
                        <button onClick={() => setLogMockModal(e)} disabled={busy === e.enrollment_id} style={btnStyle("#fff", color.ink)}><TrendingUp size={13} /> Log score</button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, margin: "24px 0 12px" }}>Available tracks</div>
            <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10 }}>
              {tracks.map((t) => {
                const isEnrolled = enrolledTypes.has(t.exam_type);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "14px 18px", borderBottom: `1px solid ${color.borderMuted}` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 12.5, color: color.inkSoft, marginTop: 2 }}>{t.description}</div>
                      <div style={{ fontSize: 11.5, color: color.textFaint, marginTop: 4 }}>{t.score_scale} · {t.sections.map((s) => s.name).join(", ")}</div>
                    </div>
                    <button onClick={() => setEnrollModal(t)} disabled={busy === t.id} style={btnStyle(isEnrolled ? "#fff" : "#2B3A67", isEnrolled ? color.ink : "#fff")}>{isEnrolled ? "Update" : "Enroll"}</button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {enrollModal && <EnrollModal track={enrollModal} onClose={() => setEnrollModal(null)} onDone={() => { setEnrollModal(null); void load(); }} />}
      {logMockModal && <LogMockModal enrollment={logMockModal} onClose={() => setLogMockModal(null)} onDone={() => { setLogMockModal(null); void load(); }} />}
      <QuizModal isOpen={!!practiceTrack} onClose={() => setPracticeTrack(null)} topicName={practiceTrack ? `${practiceTrack.name} practice` : undefined} />
    </>
  );
}
