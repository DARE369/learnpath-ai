'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';

function authHeaders(): Record<string, string> {
  const t =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface ConceptNode {
  id: string;
  display_name: string;
  subject?: string;
  difficulty: number;
}

export default function ConceptsLibrary() {
  const [concepts, setConcepts] = useState<ConceptNode[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge/concepts?q=${encodeURIComponent(query)}`, { headers: authHeaders() });
      const data = await res.json();
      setConcepts(data.concepts || []);
    } catch {
      setConcepts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <>
      <Head><title>Concepts — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-white">Concept Map</h1>
          <p className="text-white/50 mt-1 text-sm">
            Explore concepts, their prerequisites, and what to learn first.
          </p>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search concepts…"
            className="mt-5 w-full px-4 py-3 rounded-xl bg-surface border border-border text-white placeholder-white/30 focus:border-accent outline-none"
          />

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : concepts.length === 0 ? (
            <div className="bg-surface-elevated border border-border rounded-2xl p-10 text-center mt-6">
              <div className="text-4xl mb-3">🕸️</div>
              <p className="text-white/60">No concepts indexed yet.</p>
              <p className="text-white/40 text-sm mt-1">
                An admin can seed the graph from existing content via the knowledge API.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              {concepts.map((c) => (
                <Link
                  key={c.id}
                  href={`/concepts/${c.id}`}
                  className="block bg-surface-elevated border border-border rounded-xl p-4 hover:border-accent transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{c.display_name}</span>
                    <span className="text-white/30 text-xs">lvl {c.difficulty}</span>
                  </div>
                  {c.subject && <span className="text-white/40 text-xs">{c.subject}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
