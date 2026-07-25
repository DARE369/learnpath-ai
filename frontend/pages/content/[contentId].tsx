import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { printPdf } from "@/lib/printPdf";
import ShareButton from "@/components/Social/ShareButton";
import { color, font } from "../../ui-v2/tokens";

function authHeaders(): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const TABS = [
  { key: "ai_explanation", label: "AI Explanation" },
  { key: "flashcards", label: "Flashcards" },
  { key: "youtube_match", label: "Videos" },
  { key: "quiz", label: "Quiz" },
];

interface Summary { id: string; title: string; file_type: string; detected_subject: string; status: string; }

export default function ContentDetail() {
  const router = useRouter();
  const contentId = typeof router.query.contentId === "string" ? router.query.contentId : "";

  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState("ai_explanation");
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [addingReview, setAddingReview] = useState(false);

  const addFlashcardsToReview = async () => {
    setAddingReview(true);
    setReviewMsg(null);
    try {
      const res = await fetch(`/api/content/${contentId}/flashcards/add-to-review`, { method: "POST", headers: authHeaders() });
      const body = await res.json();
      setReviewMsg(body.added > 0 ? `Added ${body.added} card${body.added === 1 ? "" : "s"} to your review deck.` : "These cards are already in your review deck.");
    } catch {
      setReviewMsg("Could not add to review deck.");
    } finally {
      setAddingReview(false);
    }
  };

  useEffect(() => {
    if (!contentId) return;
    fetch(`/api/content/${contentId}`, { headers: authHeaders() }).then((r) => r.json()).then(setSummary).catch(() => {});
  }, [contentId]);

  const loadTab = useCallback(async (key: string) => {
    if (!contentId || data[key]) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/${contentId}/transform/${key}`, { headers: authHeaders() });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || "Generation failed");
      setData((d) => ({ ...d, [key]: body }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [contentId, data]);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  const current = data[tab];

  return (
    <>
      <Head><title>{summary?.title || "Your Notes"} — LearnPath AI</title></Head>
      <div style={{ maxWidth: 760, fontFamily: font.body }}>
        <Link href="/upload" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: color.textFaint, textDecoration: "none" }}>← Upload another</Link>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 24, margin: "12px 0 4px", wordBreak: "break-word" }}>{summary?.title || "Your Notes"}</h1>
        {summary && <div style={{ fontSize: 12.5, color: color.textFaint, marginBottom: 20 }}>{summary.file_type} · subject: {summary.detected_subject || "general"}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 6, background: color.surfaceElevated, borderRadius: 8, padding: 3, flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, cursor: "pointer", border: "none", background: tab === t.key ? "#fff" : "transparent", color: tab === t.key ? color.ink : color.textFaint }}>{t.label}</button>
            ))}
          </div>
          <ShareButton itemType="upload" itemRef={contentId} title={summary?.title || "Uploaded notes"} />
        </div>

        <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: 26, minHeight: 300 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", textAlign: "center" }}>
              <div style={{ width: 28, height: 28, border: "3px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", marginBottom: 16, animation: "spin 0.8s linear infinite" }} />
              <div style={{ fontSize: 13.5, color: color.textFaint }}>Generating… First time for each tab can take ~10–20s.</div>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 13.5, color: color.danger.fg, marginBottom: 12 }}>{error}</div>
              <button onClick={() => loadTab(tab)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: `1px solid ${color.border}`, background: "#fff", color: color.ink, cursor: "pointer" }}>Retry</button>
            </div>
          ) : !current ? null : tab === "ai_explanation" ? (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                <button onClick={() => printPdf(summary?.title || "Explanation", current.content || "")} style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: `1px solid ${color.border}`, background: "#fff", color: color.ink, cursor: "pointer" }}>Download as PDF</button>
              </div>
              <div style={{ fontSize: 14.5, lineHeight: 1.75, color: "#2B2E38", whiteSpace: "pre-line" }}>{current.content}</div>
            </>
          ) : tab === "flashcards" ? (
            <>
              {(current.data?.flashcards || []).length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: color.textFaint }}>{current.data.flashcards.length} cards generated</div>
                  <button onClick={addFlashcardsToReview} disabled={addingReview} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>{addingReview ? "Adding…" : "Add to review deck"}</button>
                </div>
              )}
              {reviewMsg && <div style={{ fontSize: 12, color: color.success.fg, marginBottom: 10 }}>{reviewMsg}</div>}
              <FlashcardsView cards={current.data?.flashcards || []} flipped={flipped} setFlipped={setFlipped} />
            </>
          ) : tab === "youtube_match" ? (
            <VideosView videos={current.data?.videos || []} />
          ) : (
            <QuizView questions={current.data?.questions || []} revealed={revealed} setRevealed={setRevealed} />
          )}
        </div>
      </div>
    </>
  );
}

function FlashcardsView({ cards, flipped, setFlipped }: any) {
  if (!cards.length) return <p style={{ fontSize: 13.5, color: color.textFaint }}>No flashcards generated.</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {cards.map((c: any, i: number) => (
        <button key={i} onClick={() => setFlipped((f: any) => ({ ...f, [i]: !f[i] }))} style={{ textAlign: "left", background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: 16, cursor: "pointer", minHeight: 90 }}>
          <div style={{ fontSize: 13.5, fontWeight: flipped[i] ? 400 : 600, marginBottom: 8 }}>{flipped[i] ? c.back : c.front}</div>
          <div style={{ fontSize: 12, color: color.textFaint }}>{flipped[i] ? "Hide" : "Reveal"}</div>
        </button>
      ))}
    </div>
  );
}

function VideosView({ videos }: any) {
  if (!videos.length) return <p style={{ fontSize: 13.5, color: color.textFaint }}>No video matches (YouTube search may be disabled on the server).</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {videos.map((v: any, i: number) => (
        <a key={i} href={`https://www.youtube.com/watch?v=${v.youtube_id}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: 12, textDecoration: "none", color: "inherit" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v.title}</div>
            <div style={{ fontSize: 12, color: color.textFaint }}>{v.channel} · {v.concept}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

function QuizView({ questions, revealed, setRevealed }: any) {
  if (!questions.length) return <p style={{ fontSize: 13.5, color: color.textFaint }}>No quiz generated.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {questions.map((q: any, i: number) => (
        <div key={i} style={{ borderBottom: i < questions.length - 1 ? `1px solid ${color.borderMuted}` : "none", paddingBottom: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{i + 1}. {q.question}</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: color.inkSoft }}>
            {(q.options || []).map((opt: string, j: number) => <li key={j}>{String.fromCharCode(65 + j)}. {opt}</li>)}
          </ul>
          <button onClick={() => setRevealed((r: any) => ({ ...r, [i]: !r[i] }))} style={{ marginTop: 8, background: "none", border: "none", color: "#2B5FA8", fontSize: 12, cursor: "pointer" }}>{revealed[i] ? "Hide answer" : "Show answer"}</button>
          {revealed[i] && (
            <div style={{ marginTop: 8, borderRadius: 8, background: color.success.bg, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: color.success.fg }}>Answer: {q.correct_answer}</div>
              {q.explanation && <div style={{ fontSize: 13, color: color.inkSoft, marginTop: 4 }}>{q.explanation}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
