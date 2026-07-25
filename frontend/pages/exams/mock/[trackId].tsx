import React, { useEffect, useState, useCallback, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { color, font } from "../../../ui-v2/tokens";

function authHeaders(json = false): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h["Content-Type"] = "application/json";
  return h;
}

interface Q { id: string; section: string; text: string; options: { id: string; text: string }[]; }
interface Results {
  overall_percent: number; correct: number; total: number;
  predicted_score: string; section_scores: Record<string, number>;
  review: { id: string; is_correct: boolean; correct_answer_id: string; your_answer: string | null; explanation: string }[];
}

export default function MockExam() {
  const router = useRouter();
  const trackId = typeof router.query.trackId === "string" ? router.query.trackId : "";

  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [trackName, setTrackName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const res = await fetch("/api/exams/mock/submit", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ track_id: trackId, answers }) });
    setResults(await res.json());
  }, [trackId, answers]);

  useEffect(() => {
    if (!trackId) return;
    (async () => {
      try {
        const res = await fetch(`/api/exams/tracks/${trackId}/mock/start`, { method: "POST", headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Could not start");
        if (!data.questions?.length) throw new Error("No questions available — seed the concept graph / set CLAUDE_API_KEY.");
        setQuestions(data.questions);
        setTrackName(data.track?.name || "Mock exam");
        setTimeLeft((data.duration_minutes || 10) * 60);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    })();
  }, [trackId]);

  useEffect(() => {
    if (!questions || results || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => {
      if (s <= 1) { clearInterval(t); submit(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [questions, results, timeLeft, submit]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, background: color.paper, fontFamily: font.body }}>
        <div>
          <p style={{ color: color.danger.fg, fontSize: 14 }}>{error}</p>
          <Link href="/exams" style={{ display: "inline-block", marginTop: 12, fontSize: 13, color: "#2B3A67", textDecoration: "none" }}>← Back to exams</Link>
        </div>
      </div>
    );
  }
  if (!questions) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: color.paper }}><div style={{ width: 36, height: 36, border: "3px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>;
  }

  const topbar = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", color: color.ink, background: color.paper, fontFamily: font.body }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${color.border}`, background: "#fff" }}>
        <Link href="/exams" style={{ textDecoration: "none", color: color.textFaint, fontSize: 13 }}>← Exit</Link>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{trackName}</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", padding: "24px 20px" }}>
        <div style={{ width: "100%", maxWidth: 680 }}>{children}</div>
      </div>
    </div>
  );

  if (results) {
    return (
      <>
        <Head><title>Mock Results — LearnPath AI</title></Head>
        {topbar(
          <>
            <div style={{ textAlign: "center", margin: "34px 0 26px" }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.textFaint, marginBottom: 10 }}>Your result</div>
              <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 44, marginBottom: 6 }}>{results.predicted_score}</div>
              <div style={{ fontSize: 13.5, color: color.inkSoft }}>predicted · {results.correct}/{results.total} correct ({results.overall_percent}%)</div>
            </div>
            {Object.keys(results.section_scores).length > 0 && (
              <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, marginBottom: 24 }}>
                {Object.entries(results.section_scores).map(([s, v]) => (
                  <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "13px 18px", borderBottom: `1px solid ${color.borderMuted}`, fontSize: 13.5 }}>
                    <span>{s}</span><span style={{ fontFamily: font.mono, fontWeight: 600 }}>{v}%</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <Link href={`/exams/mock/${trackId}`} onClick={() => { submittedRef.current = false; }} style={{ padding: "11px 20px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: `1px solid #2B3A67`, background: "#fff", color: "#2B3A67", textDecoration: "none" }}>Retake</Link>
              <Link href="/exams" style={{ padding: "11px 20px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Done</Link>
            </div>
          </>
        )}
      </>
    );
  }

  const q = questions[idx];
  const mins = Math.floor(timeLeft / 60), secs = timeLeft % 60;
  const answeredCount = Object.keys(answers).length;
  const urgent = timeLeft < 60;

  return (
    <>
      <Head><title>{trackName} — Mock Exam</title></Head>
      {topbar(
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <span style={{ fontFamily: font.mono, fontSize: 15, fontWeight: 600, padding: "6px 14px", borderRadius: 100, background: urgent ? color.danger.bg : "#F0EEE7", color: urgent ? color.danger.fg : color.ink }}>{mins}:{secs.toString().padStart(2, "0")}</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setIdx(i)} style={{ width: 28, height: 28, borderRadius: 6, fontSize: 11.5, border: i === idx ? "none" : `1px solid ${color.border}`, background: i === idx ? "#2B3A67" : answers[qq.id] ? color.success.bg : "#fff", color: i === idx ? "#fff" : answers[qq.id] ? color.success.fg : color.textFaint, cursor: "pointer" }}>{i + 1}</button>
            ))}
          </div>

          <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 12, padding: "26px" }}>
            <div style={{ fontSize: 12, color: color.textFaint }}>{q.section} · Q{idx + 1} of {questions.length}</div>
            <div style={{ fontFamily: font.display, fontWeight: 500, fontSize: 17, lineHeight: 1.5, margin: "14px 0 20px" }}>{q.text}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {q.options.map((o) => {
                const picked = answers[q.id] === o.id;
                return (
                  <button key={o.id} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))} style={{ textAlign: "left", padding: "12px 14px", fontSize: 13.5, borderRadius: 8, border: picked ? "1px solid #2B3A67" : `1px solid ${color.border}`, background: picked ? "#EFF1F7" : "#fff", color: color.ink, cursor: "pointer" }}>
                    {o.text}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} style={{ padding: "11px 20px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: `1px solid #CFCBC0`, background: "#fff", color: idx === 0 ? "#B8B5AB" : color.ink, cursor: idx === 0 ? "not-allowed" : "pointer" }}>← Previous</button>
            {idx < questions.length - 1 ? (
              <button onClick={() => setIdx((i) => i + 1)} style={{ padding: "11px 22px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>Next →</button>
            ) : (
              <button onClick={submit} style={{ padding: "11px 22px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "none", background: "#1E7F5C", color: "#fff", cursor: "pointer" }}>Submit exam ({answeredCount}/{questions.length})</button>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: color.textFainter, marginTop: 14 }}>{answeredCount} of {questions.length} answered</div>
        </>
      )}
    </>
  );
}
