'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRealtime } from '@/lib/useRealtime';

function authHeaders(json = false): Record<string, string> {
  const t =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      : null;
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h['Content-Type'] = 'application/json';
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
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [active, setActive] = useState<Buddy | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        fetch('/api/buddies/', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/buddies/shared', { headers: authHeaders() }).then((r) => r.json()),
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
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const openChat = (b: Buddy) => { setActive(b); loadThread(b); };

  // Live updates: refresh the open thread (and presence) on inbound message.
  useRealtime(useCallback((ev: any) => {
    if (ev?.type === 'message') {
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
    fetch('/api/buddies/request', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ user_id: id }) })
      .then(() => setResults((rs) => rs.map((r) => (r.user_id === id ? { ...r, relationship: 'request_sent' } : r)))), id);

  const respond = (cid: string, accept: boolean) =>
    act(() => fetch('/api/buddies/respond', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ connection_id: cid, accept }) }), cid);

  const remove = (cid: string) =>
    act(() => fetch(`/api/buddies/${cid}`, { method: 'DELETE', headers: authHeaders() }), cid);

  const send = async () => {
    if (!draft.trim() || !active) return;
    const body = draft.trim();
    setDraft('');
    setThread((t) => [...t, { id: 'tmp', body, mine: true, created_at: '' }]);
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    await fetch('/api/buddies/messages', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ recipient_id: active.user_id, body }) });
    loadThread(active);
  };

  return (
    <>
      <Head><title>Study Buddies — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-white">Study Buddies</h1>
          <p className="text-white/50 mt-1 text-sm">Learn alongside others — accountability beats isolation.</p>

          {/* Search / add */}
          <div className="mt-6 bg-surface-elevated border border-border rounded-2xl p-5">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people by name or email…"
                   className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-white placeholder-white/30 focus:border-accent outline-none" />
            {results.length > 0 && (
              <div className="mt-3 space-y-2">
                {results.map((r) => (
                  <div key={r.user_id} className="flex items-center justify-between bg-surface rounded-xl px-4 py-2.5">
                    <span className="text-white text-sm">{r.name}</span>
                    {r.relationship === 'none' ? (
                      <button onClick={() => sendRequest(r.user_id)} disabled={busy === r.user_id}
                              className="px-3 py-1 rounded-lg bg-accent text-white text-sm disabled:opacity-50">Add</button>
                    ) : (
                      <span className="text-white/40 text-xs">
                        {r.relationship === 'buddies' ? '✓ buddies' : r.relationship === 'request_sent' ? 'requested' : 'wants to connect'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              {incoming.length > 0 && (
                <section className="mt-6">
                  <h2 className="text-white font-semibold mb-3">Requests</h2>
                  <div className="space-y-2">
                    {incoming.map((p) => (
                      <div key={p.connection_id} className="flex items-center justify-between bg-surface-elevated border border-border rounded-xl px-4 py-3">
                        <span className="text-white text-sm">{p.name}</span>
                        <div className="flex gap-2">
                          <button onClick={() => respond(p.connection_id, true)} disabled={busy === p.connection_id} className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-sm disabled:opacity-50">Accept</button>
                          <button onClick={() => respond(p.connection_id, false)} disabled={busy === p.connection_id} className="px-3 py-1 rounded-lg bg-surface border border-border text-white/60 text-sm disabled:opacity-50">Decline</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Shared with you */}
              {shared.length > 0 && (
                <section className="mt-6">
                  <h2 className="text-white font-semibold mb-3">Shared with you</h2>
                  <div className="space-y-2">
                    {shared.map((s) => (
                      <Link key={s.id}
                            href={s.item_type === 'note' ? `/notes/${s.item_ref}` : `/content/${s.item_ref}`}
                            className="flex items-center justify-between bg-surface-elevated border border-border rounded-xl px-4 py-3 hover:border-accent transition">
                        <span className="text-white text-sm truncate">{s.item_type === 'note' ? '📚' : '📄'} {s.title}</span>
                        <span className="text-white/40 text-xs flex-shrink-0 ml-3">from {s.from}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Buddies */}
              <section className="mt-6">
                <h2 className="text-white font-semibold mb-3">Your buddies ({buddies.length})</h2>
                {buddies.length === 0 ? (
                  <p className="text-white/40 text-sm">No buddies yet — search above to connect.</p>
                ) : (
                  <div className="space-y-2">
                    {buddies.map((b) => (
                      <div key={b.connection_id} className="flex items-center justify-between bg-surface-elevated border border-border rounded-xl px-4 py-3">
                        <button onClick={() => openChat(b)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${b.online ? 'bg-green-400' : 'bg-white/20'}`} />
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{b.name}</p>
                            <p className="text-white/40 text-xs">{b.online ? 'online' : 'offline'} · 🔥 {b.streak_days}d{b.avg_score != null && ` · ${b.avg_score}% avg`}</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <button onClick={() => openChat(b)} className="text-accent text-xs hover:underline">Message</button>
                          <button onClick={() => remove(b.connection_id)} disabled={busy === b.connection_id} className="text-white/30 hover:text-red-300 text-xs disabled:opacity-50">remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Chat panel */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setActive(null)}>
          <div className="w-full sm:max-w-md bg-surface-elevated border border-border rounded-t-2xl sm:rounded-2xl flex flex-col h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${active.online ? 'bg-green-400' : 'bg-white/20'}`} />
                <span className="text-white font-medium">{active.name}</span>
              </div>
              <button onClick={() => setActive(null)} className="text-white/40 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {thread.length === 0 ? (
                <p className="text-white/30 text-sm text-center mt-8">Say hi 👋</p>
              ) : thread.map((m, i) => (
                <div key={m.id + i} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <span className={`px-3 py-2 rounded-2xl text-sm max-w-[75%] ${m.mine ? 'bg-accent text-white' : 'bg-surface text-white/85 border border-border'}`}>{m.body}</span>
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>
            <div className="px-4 py-3 border-t border-border flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
                     placeholder="Message…" className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-border text-white placeholder-white/30 focus:border-accent outline-none" />
              <button onClick={send} disabled={!draft.trim()} className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-40">Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
