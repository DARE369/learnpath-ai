import React, { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRealtime } from "../lib/useRealtime";
import { Card } from "../ui-v2/primitives";
import { color, font } from "../ui-v2/tokens";

function authHeaders(json = false): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h["Content-Type"] = "application/json";
  return h;
}

interface Buddy { user_id: string; name: string; online: boolean; streak_days: number; avg_score: number | null; connection_id: string; }
interface Pending { connection_id: string; name: string; user_id: string; }
interface SearchResult { user_id: string; name: string; relationship: string; }
interface SharedItem { id: string; item_type: string; item_ref: string; title: string; from: string; }
interface Message { id: string; body: string; mine: boolean; created_at: string; }

export default function BuddiesPage() {
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [incoming, setIncoming] = useState<Pending[]>([]);
  const [shared, setShared] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [active, setActive] = useState<Buddy | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        fetch("/api/buddies/", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/buddies/shared", { headers: authHeaders() }).then((r) => r.json()),
      ]);
      setBuddies(b.buddies || []);
      setIncoming(b.incoming || []);
      setShared(s.items || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadThread = useCallback(async (buddy: Buddy) => {
    const res = await fetch(`/api/buddies/messages/${buddy.user_id}`, { headers: authHeaders() });
    const data = await res.json();
    setThread(data.messages || []);
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const openChat = (b: Buddy) => { setActive(b); loadThread(b); };

  useRealtime(useCallback((ev: any) => {
    if (ev?.type === "message") {
      if (active && ev.from === active.user_id) loadThread(active);
      load();
    }
  }, [active, loadThread, load]));

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/buddies/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      const data = await res.json();
      setResults(data.results || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const act = async (fn: () => Promise<any>, key: string) => {
    setBusy(key);
    try { await fn(); await load(); } finally { setBusy(null); }
  };

  const sendRequest = (id: string) => act(() =>
    fetch("/api/buddies/request", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ user_id: id }) })
      .then(() => setResults((rs) => rs.map((r) => (r.user_id === id ? { ...r, relationship: "request_sent" } : r)))), id);

  const respond = (cid: string, accept: boolean) =>
    act(() => fetch("/api/buddies/respond", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ connection_id: cid, accept }) }), cid);

  const remove = (cid: string) => act(() => fetch(`/api/buddies/${cid}`, { method: "DELETE", headers: authHeaders() }), cid);

  const send = async () => {
    if (!draft.trim() || !active) return;
    const body = draft.trim();
    setDraft("");
    setThread((t) => [...t, { id: "tmp", body, mine: true, created_at: "" }]);
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    await fetch("/api/buddies/messages", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ recipient_id: active.user_id, body }) });
    loadThread(active);
  };

  return (
    <>
      <Head><title>Study Buddies — LearnPath AI</title></Head>
      <div style={{ maxWidth: 700, fontFamily: font.body }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>Study buddies</h1>
        <p style={{ color: color.textFaint, fontSize: 13.5, marginTop: 4 }}>Learn alongside others — accountability beats isolation.</p>

        <Card padding="md" style={{ marginTop: 20 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people by name or email…"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${color.border}`, fontSize: 13.5, fontFamily: font.body, outline: "none" }}
          />
          {results.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {results.map((r) => (
                <div key={r.user_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: color.surfaceMuted, borderRadius: 10, padding: "8px 14px" }}>
                  <span style={{ fontSize: 13 }}>{r.name}</span>
                  {r.relationship === "none" ? (
                    <button onClick={() => sendRequest(r.user_id)} disabled={busy === r.user_id} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#2B3A67", color: "#fff", fontSize: 12.5, cursor: "pointer" }}>Add</button>
                  ) : (
                    <span style={{ fontSize: 11.5, color: color.textFaint }}>
                      {r.relationship === "buddies" ? "✓ buddies" : r.relationship === "request_sent" ? "requested" : "wants to connect"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {loading ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}><div style={{ width: 28, height: 28, border: "2px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", margin: "0 auto", animation: "spin 0.8s linear infinite" }} /></div>
        ) : (
          <>
            {incoming.length > 0 && (
              <section style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 10 }}>Requests</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {incoming.map((p) => (
                    <Card key={p.connection_id} padding="sm" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13 }}>{p.name}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => respond(p.connection_id, true)} disabled={busy === p.connection_id} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: color.success.bg, color: color.success.fg, fontSize: 12.5, cursor: "pointer" }}>Accept</button>
                        <button onClick={() => respond(p.connection_id, false)} disabled={busy === p.connection_id} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${color.border}`, background: "#fff", color: color.inkSoft, fontSize: 12.5, cursor: "pointer" }}>Decline</button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {shared.length > 0 && (
              <section style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 10 }}>Shared with you</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {shared.map((s) => (
                    <Link key={s.id} href={s.item_type === "note" ? `/notes/${s.item_ref}` : `/content/${s.item_ref}`} style={{ textDecoration: "none" }}>
                      <Card padding="sm" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: color.ink }}>{s.title}</span>
                        <span style={{ fontSize: 11.5, color: color.textFaint }}>from {s.from}</span>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section style={{ marginTop: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 10 }}>Your buddies ({buddies.length})</div>
              {buddies.length === 0 ? (
                <p style={{ fontSize: 13, color: color.textFaint }}>No buddies yet — search above to connect.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {buddies.map((b) => (
                    <Card key={b.connection_id} padding="sm" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <button onClick={() => openChat(b)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", textAlign: "left", flex: 1, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: b.online ? color.success.fg : "#D9D5C9", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: color.ink }}>{b.name}</p>
                          <p style={{ fontSize: 11.5, color: color.textFaint, margin: 0 }}>{b.online ? "online" : "offline"} · 🔥 {b.streak_days}d{b.avg_score != null ? ` · ${b.avg_score}% avg` : ""}</p>
                        </div>
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <button onClick={() => openChat(b)} style={{ background: "none", border: "none", color: "#2B3A67", fontSize: 12, cursor: "pointer" }}>Message</button>
                        <button onClick={() => remove(b.connection_id)} disabled={busy === b.connection_id} style={{ background: "none", border: "none", color: color.textFainter, fontSize: 12, cursor: "pointer" }}>remove</button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {active && (
        <div onClick={() => setActive(null)} style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(20,23,31,0.5)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: "14px 14px 0 0", display: "flex", flexDirection: "column", height: "70vh" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${color.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: active.online ? color.success.fg : "#D9D5C9" }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{active.name}</span>
              </div>
              <button onClick={() => setActive(null)} style={{ background: "none", border: "none", fontSize: 20, color: color.textFaint, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              {thread.length === 0 ? (
                <p style={{ color: color.textFainter, fontSize: 13, textAlign: "center", marginTop: 32 }}>Say hi</p>
              ) : thread.map((m, i) => (
                <div key={m.id + i} style={{ display: "flex", justifyContent: m.mine ? "flex-end" : "flex-start" }}>
                  <span style={{ padding: "8px 12px", borderRadius: 14, fontSize: 13, maxWidth: "75%", background: m.mine ? "#2B3A67" : color.surfaceMuted, color: m.mine ? "#fff" : color.ink }}>{m.body}</span>
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${color.border}`, display: "flex", gap: 8 }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message…" style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: `1px solid ${color.border}`, fontSize: 13.5, outline: "none" }} />
              <button onClick={send} disabled={!draft.trim()} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: "#2B3A67", color: "#fff", fontSize: 13, cursor: "pointer" }}>Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
