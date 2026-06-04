'use client';
import { Target } from 'lucide-react';

import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

function authHeaders(json = false): Record<string, string> {
  const t =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      : null;
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

interface PathRow { id: string; path_name: string; completed_modules: number; total_modules: number; progress_percent: number; }
interface ConceptRow { id: string; display_name: string; }

export default function PathsLibrary() {
  const router = useRouter();
  const [paths, setPaths] = useState<PathRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [q, setQ] = useState('');
  const [goal, setGoal] = useState<ConceptRow | null>(null);
  const [weeks, setWeeks] = useState(12);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPaths = useCallback(async () => {
    try {
      const res = await fetch('/api/adaptive-paths/', { headers: authHeaders() });
      const data = await res.json();
      setPaths(data.paths || []);
    } catch {
      setPaths([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPaths(); }, [loadPaths]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/knowledge/concepts?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
        const data = await res.json();
        setConcepts((data.concepts || []).slice(0, 8));
      } catch { setConcepts([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const create = async () => {
    if (!goal) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/adaptive-paths/', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ goal_concept_id: goal.id, target_weeks: weeks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not create path');
      router.push(`/paths/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setCreating(false);
    }
  };

  return (
    <>
      <Head><title>Learning Paths — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-white">Adaptive Paths</h1>
          <p className="text-white/50 mt-1 text-sm">
            A personalized sequence that adapts difficulty and pacing to your performance.
          </p>

          {/* Create */}
          <div className="mt-6 bg-surface-elevated border border-border rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-3">New path</h2>
            {goal ? (
              <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-xl px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-white text-sm"><Target className="h-4 w-4" /> {goal.display_name}</span>
                <button onClick={() => setGoal(null)} className="text-white/40 hover:text-white text-sm">change</button>
              </div>
            ) : (
              <>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search a goal concept…"
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-white placeholder-white/30 focus:border-accent outline-none"
                />
                {concepts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {concepts.map((c) => (
                      <button key={c.id} onClick={() => setGoal(c)} className="px-3 py-1.5 rounded-lg bg-surface border border-border text-white/70 hover:text-white text-sm">
                        {c.display_name}
                      </button>
                    ))}
                  </div>
                )}
                {q && concepts.length === 0 && (
                  <p className="text-white/40 text-xs mt-2">
                    No concepts found. An admin can seed the concept graph from /admin first.
                  </p>
                )}
              </>
            )}

            <div className="flex items-center gap-3 mt-4">
              <label className="text-white/50 text-sm">Target weeks</label>
              <input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}
                     className="w-20 px-3 py-2 rounded-lg bg-surface border border-border text-white outline-none" />
              <button onClick={create} disabled={!goal || creating}
                      className="ml-auto px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
                {creating ? 'Creating…' : 'Create path'}
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>

          {/* Existing paths */}
          <h2 className="text-white font-semibold mt-8 mb-3">Your paths</h2>
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
          ) : paths.length === 0 ? (
            <p className="text-white/40 text-sm">No paths yet — create one above.</p>
          ) : (
            <div className="space-y-3">
              {paths.map((p) => (
                <Link key={p.id} href={`/paths/${p.id}`} className="block bg-surface-elevated border border-border rounded-xl p-4 hover:border-accent transition">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{p.path_name}</span>
                    <span className="text-white/40 text-xs">{p.completed_modules}/{p.total_modules}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${p.progress_percent}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
