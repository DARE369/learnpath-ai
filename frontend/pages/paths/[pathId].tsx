import React, { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import QuizModal from "../../components/Quiz/QuizModal";
import { Card, Modal, ModalTitle } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";

function authHeaders(json = false): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h["Content-Type"] = "application/json";
  return h;
}

interface Module { id: string; module_number: number; title: string; type: string; difficulty: string; duration_minutes: number; status: string; concept_name?: string | null; }
interface Forecast { modules_remaining: number; estimated_completion_date: string; days_ahead: number | null; pace_modules_per_week: number; }
interface PathDetail { id: string; path_name: string; completed_modules: number; total_modules: number; progress_percent: number; times_adapted: number; modules: Module[]; forecast: Forecast; }

export default function PathDetailPage() {
  const router = useRouter();
  const pathId = typeof router.query.pathId === "string" ? router.query.pathId : "";
  const [p, setP] = useState<PathDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [adaptMsg, setAdaptMsg] = useState<string | null>(null);
  const [showAdaptConfirm, setShowAdaptConfirm] = useState(false);
  const [quizModule, setQuizModule] = useState<Module | null>(null);

  const load = useCallback(async () => {
    if (!pathId) return;
    const res = await fetch(`/api/adaptive-paths/${pathId}`, { headers: authHeaders() });
    setP(res.ok ? await res.json() : null);
    setLoading(false);
  }, [pathId]);

  useEffect(() => { load(); }, [load]);

  const complete = async (moduleId: string, score?: number) => {
    setBusy(moduleId);
    try {
      const body = score != null ? { score } : {};
      const res = await fetch(`/api/adaptive-paths/${pathId}/modules/${moduleId}/complete`, { method: "POST", headers: authHeaders(true), body: JSON.stringify(body) });
      if (res.ok) setP(await res.json());
    } finally {
      setBusy(null);
    }
  };

  const onQuizComplete = (score: number) => { const m = quizModule; setQuizModule(null); if (m) complete(m.id, score); };

  const adapt = async () => {
    setShowAdaptConfirm(false);
    setBusy("adapt");
    setAdaptMsg(null);
    try {
      const res = await fetch(`/api/adaptive-paths/${pathId}/adapt`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setAdaptMsg(data.count > 0 ? data.adaptations.map((a: any) => a.reason).join(" ") : "No changes — your pace and difficulty look on track.");
        await load();
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><div style={{ width: 32, height: 32, border: "3px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>;
  if (!p) {
    return (
      <div style={{ maxWidth: 700, fontFamily: font.body }}>
        <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 12, padding: "60px 30px", textAlign: "center", marginTop: 20 }}>
          <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 19, marginBottom: 10 }}>Path not found</div>
          <div style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 22 }}>This learning path could not be loaded. It may have expired or never been built.</div>
          <Link href="/paths" style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Back to Explore</Link>
        </div>
      </div>
    );
  }

  const f = p.forecast;

  return (
    <>
      <Head><title>{p.path_name} — LearnPath AI</title></Head>
      <div style={{ maxWidth: 780, fontFamily: font.body }}>
        <Link href="/paths" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: color.textFaint, textDecoration: "none" }}>← All paths</Link>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 26, margin: "14px 0 20px" }}>{p.path_name}</h1>

        <Card padding="lg" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: color.inkSoft, marginBottom: 8 }}>
            <span>{p.completed_modules}/{p.total_modules} modules ({p.progress_percent}%)</span>
            <span>adapted {p.times_adapted}×</span>
          </div>
          <div style={{ height: 6, background: color.surfaceElevated, borderRadius: 100, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ height: "100%", width: `${p.progress_percent}%`, background: "#2B3A67", borderRadius: 100 }} />
          </div>
          <div style={{ fontSize: 12, color: color.textFaint }}>
            ~{f.pace_modules_per_week}/wk · {f.modules_remaining} left · est. finish {f.estimated_completion_date}
            {f.days_ahead != null && <span style={{ color: f.days_ahead >= 0 ? color.success.fg : color.warning.fg }}> ({f.days_ahead >= 0 ? `${f.days_ahead}d ahead` : `${-f.days_ahead}d behind`})</span>}
          </div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => setShowAdaptConfirm(true)} disabled={busy === "adapt"} style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600, borderRadius: 7, border: "1px solid #2B3A67", background: "#fff", color: "#2B3A67", cursor: "pointer" }}>{busy === "adapt" ? "Adapting…" : "Adapt to my performance"}</button>
            {adaptMsg && <span style={{ fontSize: 12, color: color.textFaint }}>{adaptMsg}</span>}
          </div>
        </Card>

        <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Modules</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {p.modules.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 10, padding: "12px 16px", border: `1px solid ${m.status === "completed" ? "#A9D3C0" : color.border}`, background: m.status === "completed" ? color.success.bg : "#fff" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.status === "completed" && "✓ "}{m.module_number}. {m.title}</div>
                <div style={{ fontSize: 11.5, color: color.textFaint, marginTop: 2 }}>{m.type} · {m.difficulty} · {m.duration_minutes}m</div>
              </div>
              {m.status !== "completed" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {m.type === "quiz" ? (
                    <button onClick={() => setQuizModule(m)} disabled={busy === m.id} style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>Start quiz</button>
                  ) : (
                    <Link href={`/learning/${encodeURIComponent(m.concept_name || "demo")}/0`} style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Learn</Link>
                  )}
                  <button onClick={() => complete(m.id)} disabled={busy === m.id} style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: `1px solid ${color.border}`, background: "#fff", color: color.inkSoft, cursor: "pointer" }}>{busy === m.id ? "…" : "Mark done"}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAdaptConfirm && (
        <Modal onClose={() => setShowAdaptConfirm(false)} width={420}>
          <ModalTitle>Adapt this path?</ModalTitle>
          <p style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 18 }}>Based on your recent quiz scores, this recalculates upcoming module difficulty and pacing.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={adapt} style={{ flex: 1, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>Adapt now</button>
            <button onClick={() => setShowAdaptConfirm(false)} style={{ padding: "10px 16px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", cursor: "pointer" }}>Cancel</button>
          </div>
        </Modal>
      )}

      <QuizModal isOpen={!!quizModule} onClose={() => setQuizModule(null)} topicName={quizModule?.title} concept={quizModule?.concept_name || undefined} onComplete={onQuizComplete} />
    </>
  );
}
