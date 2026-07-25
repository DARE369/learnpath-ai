import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { color, font } from "../ui-v2/tokens";

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
}

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/content/upload", { method: "POST", headers: token() ? { Authorization: `Bearer ${token()}` } : {}, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      router.push(`/content/${data.content_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setLoading(false);
    }
  };

  const handleUrl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/content/upload-url", { method: "POST", headers: { "Content-Type": "application/json", ...(token() ? { Authorization: `Bearer ${token()}` } : {}) }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not ingest URL");
      router.push(`/content/${data.content_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ingest URL");
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Upload Notes — LearnPath AI</title></Head>
      <div style={{ maxWidth: 600, fontFamily: font.body }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: "0 0 6px" }}>Upload your own material</h1>
        <div style={{ fontSize: 13.5, color: color.textFaint, marginBottom: 26, maxWidth: 520, lineHeight: 1.6 }}>Turn a document, PDF, or photo of handwritten notes into an AI explanation, flashcards, matched videos, and a quiz.</div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", textAlign: "center" }}>
            <div style={{ width: 34, height: 34, border: "3px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", marginBottom: 20, animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Extracting your content…</div>
          </div>
        ) : (
          <>
            {error && <div style={{ fontSize: 13, color: color.danger.fg, background: color.danger.bg, borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>{error}</div>}

            {mode === "file" && (
              <label style={{ display: "block", cursor: "pointer", marginBottom: 16 }}>
                <div style={{ border: "1.5px dashed #CFCBC0", borderRadius: 12, padding: "48px 24px", textAlign: "center", background: "#fff" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Click to select a file, or drag one here</div>
                  <div style={{ fontSize: 12.5, color: color.textFaint }}>PDF, Word, text, Markdown, or image (OCR supported) · up to 50MB</div>
                </div>
                <input type="file" style={{ display: "none" }} accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.webp" onChange={handleFile} />
              </label>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, color: color.textFaint, fontSize: 12.5 }}>
              <div style={{ flex: 1, height: 1, background: color.border }} />or<div style={{ flex: 1, height: 1, background: color.border }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleUrl()} placeholder="Paste a URL instead…" style={{ flex: 1, padding: "10px 14px", fontSize: 14, border: "1px solid #CFCBC0", borderRadius: 8, fontFamily: font.body }} />
              <button onClick={handleUrl} disabled={!url.trim()} style={{ padding: "10px 20px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "none", cursor: url.trim() ? "pointer" : "not-allowed", background: url.trim() ? "#2B3A67" : "#B7BDD1", color: "#fff" }}>Go</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
