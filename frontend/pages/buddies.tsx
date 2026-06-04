'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';

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

export default function BuddiesPage() {
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [incoming, setIncoming] = useState<Pending[]>([]);
  const [outgoing, setOutgoing] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/buddies/', { headers: authHeaders() });
      const data = await res.json();
      setBuddies(data.buddies || []);
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/buddies/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      const data = await res.json();
      setResults(data.results || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const sendRequest = async (userId: string) => {
    setBusy(userId);
    try {
      await fetch('/api/buddies/request', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ user_id: userId }) });
      setResults((rs) => rs.map((r) => (r.user_id === userId ? { ...r, relationship: 'request_sent' } : r)));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const respond = async (connectionId: string, accept: boolean) => {
    setBusy(connectionId);
    try {
      await fetch('/api/buddies/respond', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ connection_id: connectionId, accept }) });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (connectionId: string) => {
    setBusy(connectionId);
    try {
      await fetch(`/api/buddies/${connectionId}`, { method: 'DELETE', headers: authHeaders() });
      await load();
    } finally {
      setBusy(null);
    }
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
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people by name or email…"
              className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-white placeholder-white/30 focus:border-accent outline-none"
            />
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
              {/* Incoming requests */}
              {incoming.length > 0 && (
                <section className="mt-6">
                  <h2 className="text-white font-semibold mb-3">Requests</h2>
                  <div className="space-y-2">
                    {incoming.map((p) => (
                      <div key={p.connection_id} className="flex items-center justify-between bg-surface-elevated border border-border rounded-xl px-4 py-3">
                        <span className="text-white text-sm">{p.name}</span>
                        <div className="flex gap-2">
                          <button onClick={() => respond(p.connection_id, true)} disabled={busy === p.connection_id}
                                  className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-sm disabled:opacity-50">Accept</button>
                          <button onClick={() => respond(p.connection_id, false)} disabled={busy === p.connection_id}
                                  className="px-3 py-1 rounded-lg bg-surface border border-border text-white/60 text-sm disabled:opacity-50">Decline</button>
                        </div>
                      </div>
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
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${b.online ? 'bg-green-400' : 'bg-white/20'}`} />
                          <div>
                            <p className="text-white text-sm font-medium">{b.name}</p>
                            <p className="text-white/40 text-xs">
                              {b.online ? 'online' : 'offline'} · 🔥 {b.streak_days}d{b.avg_score != null && ` · ${b.avg_score}% avg`}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => remove(b.connection_id)} disabled={busy === b.connection_id}
                                className="text-white/30 hover:text-red-300 text-xs disabled:opacity-50">remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {outgoing.length > 0 && (
                <p className="text-white/30 text-xs mt-4">{outgoing.length} pending request{outgoing.length === 1 ? '' : 's'} sent.</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
