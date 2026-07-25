import React, { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { color, font } from "../../ui-v2/tokens";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface NoteSummary { note_id: string; youtube_id: string; title: string; word_count: number; read_time_minutes: number; available_styles: string[]; created_at: string | null; }

export default function NotesLibrary() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/notes/", { headers: authHeaders() });
        const data = await res.json();
        setNotes(data.notes || []);
      } catch {
        setNotes([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Head><title>My Study Materials — LearnPath AI</title></Head>
      <div style={{ maxWidth: 800, fontFamily: font.body }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>Study notes</h1>
        <p style={{ color: color.textFaint, fontSize: 13.5, marginTop: 4 }}>AI-generated notes from videos you&rsquo;ve studied. Open a course video and tap &ldquo;Generate study notes&rdquo; to create more.</p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><div style={{ width: 28, height: 28, border: "2px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", margin: "0 auto", animation: "spin 0.8s linear infinite" }} /></div>
        ) : notes.length === 0 ? (
          <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 12, padding: "56px 30px", textAlign: "center", marginTop: 24 }}>
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, marginBottom: 10 }}>No study notes yet</div>
            <Link href="/paths" style={{ display: "inline-block", padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Find something to learn</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            {notes.map((n) => (
              <Link key={n.note_id} href={`/notes/${n.youtube_id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: color.textFaint }}>{n.read_time_minutes} min read · {n.word_count} words</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: color.textFaint, flexShrink: 0 }}>{n.available_styles.length}/5 styles generated</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
