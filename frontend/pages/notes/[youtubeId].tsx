import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { printPdf } from "@/lib/printPdf";
import ShareButton from "@/components/Social/ShareButton";
import { color, font } from "../../ui-v2/tokens";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
}

const STYLE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "simple", label: "Simple" },
  { value: "technical", label: "Technical" },
  { value: "bullet_points", label: "Bullets" },
  { value: "mindmap", label: "Mind Map" },
];

interface NoteData { title: string; style: string; content: string; word_count: number; read_time_minutes: number; }
interface Flashcard { id: string; front: string; back: string; concept: string; }

export default function NotesViewer() {
  const router = useRouter();
  const youtubeId = typeof router.query.youtubeId === "string" ? router.query.youtubeId : "";
  const title = typeof router.query.title === "string" ? router.query.title : "";

  const [style, setStyle] = useState("standard");
  const [note, setNote] = useState<NoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [addingReview, setAddingReview] = useState(false);

  const fetchNote = useCallback(async (s: string) => {
    if (!youtubeId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ style: s });
      if (title) params.append("title", title);
      const res = await fetch(`/api/notes/${youtubeId}?${params.toString()}`, { headers: authHeaders() });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Could not generate notes"); }
      setNote(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [youtubeId, title]);

  useEffect(() => { fetchNote(style); }, [fetchNote, style]);

  const download = (ext: string, mime: string) => {
    if (!note) return;
    const blob = new Blob([note.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-${youtubeId}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFlashcards = async () => {
    setCardsLoading(true);
    try {
      const res = await fetch(`/api/notes/${youtubeId}/flashcards`, { headers: authHeaders() });
      const data = await res.json();
      setCards(data.flashcards || []);
    } catch {
      setCards([]);
    } finally {
      setCardsLoading(false);
    }
  };

  const addToReview = async () => {
    setAddingReview(true);
    setReviewMsg(null);
    try {
      const res = await fetch(`/api/notes/${youtubeId}/flashcards/add-to-review`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      setReviewMsg(data.added > 0 ? `Added ${data.added} card${data.added === 1 ? "" : "s"} to your review deck.` : "These cards are already in your review deck.");
    } catch {
      setReviewMsg("Could not add to review deck.");
    } finally {
      setAddingReview(false);
    }
  };

  return (
    <>
      <Head><title>{note?.title || "Study Notes"} — LearnPath AI</title></Head>
      <div style={{ maxWidth: 760, fontFamily: font.body }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <Link href="/notes" style={{ cursor: "pointer", color: "#2B5FA8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>← Back</Link>
        </div>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 24, margin: "0 0 18px" }}>{note?.title || "Study Notes"}</h1>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, background: color.surfaceElevated, borderRadius: 8, padding: 3, flexWrap: "wrap" }}>
            {STYLE_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setStyle(o.value)} disabled={loading} style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, cursor: "pointer", border: "none", background: style === o.value ? "#fff" : "transparent", color: style === o.value ? color.ink : color.textFaint }}>{o.label}</button>
            ))}
          </div>
          {note && !loading && !error && (
            <div style={{ display: "flex", gap: 8 }}>
              <span onClick={() => download("md", "text/markdown")} style={{ fontSize: 12.5, fontWeight: 600, color: "#2B5FA8", cursor: "pointer" }}>Markdown</span>
              <span onClick={() => download("txt", "text/plain")} style={{ fontSize: 12.5, fontWeight: 600, color: "#2B5FA8", cursor: "pointer" }}>Text</span>
              <span onClick={() => note && printPdf(note.title || "Study Notes", note.content)} style={{ fontSize: 12.5, fontWeight: 600, color: "#2B5FA8", cursor: "pointer" }}>PDF</span>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 28, height: 28, border: "3px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 13.5, color: color.textFaint }}>First time for this style — generating…</div>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 13.5, color: color.danger.fg, marginBottom: 12 }}>{error}</div>
            <button onClick={() => fetchNote(style)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "1px solid #B0362C", background: "#fff", color: color.danger.fg, cursor: "pointer" }}>Retry</button>
          </div>
        ) : (
          <>
            <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: 26, marginBottom: 20, fontSize: 14.5, lineHeight: 1.75, color: "#2B2E38", whiteSpace: "pre-line" }}>{note?.content}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={loadFlashcards} disabled={cardsLoading} style={{ padding: "9px 18px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "1px solid #2B3A67", background: "#fff", color: "#2B3A67", cursor: "pointer" }}>{cardsLoading ? "Generating…" : "Generate flashcards"}</button>
              {cards && cards.length > 0 && (
                <button onClick={addToReview} disabled={addingReview} style={{ padding: "9px 18px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>{addingReview ? "Adding…" : "Add to review deck"}</button>
              )}
            </div>
            {reviewMsg && <div style={{ fontSize: 12.5, color: color.success.fg, marginTop: 10 }}>{reviewMsg}</div>}
            {cards && cards.length === 0 && <div style={{ fontSize: 12.5, color: color.warning.fg, marginTop: 10 }}>No flashcards could be generated.</div>}

            {cards && cards.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Flashcards ({cards.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  {cards.map((c) => (
                    <button key={c.id} onClick={() => setFlipped((f) => ({ ...f, [c.id]: !f[c.id] }))} style={{ textAlign: "left", background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: 16, cursor: "pointer", minHeight: 90 }}>
                      <div style={{ fontSize: 13.5, fontWeight: flipped[c.id] ? 400 : 600, marginBottom: 8 }}>{flipped[c.id] ? c.back : c.front}</div>
                      <div style={{ fontSize: 12.5, color: color.textFaint }}>{flipped[c.id] ? "Click to hide" : "Click to reveal"}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 20 }}><ShareButton itemType="note" itemRef={youtubeId} title={note?.title || "Study notes"} /></div>
          </>
        )}
      </div>
    </>
  );
}
