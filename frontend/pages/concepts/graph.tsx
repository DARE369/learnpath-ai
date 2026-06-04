'use client';
import { ArrowRight, Network } from 'lucide-react';

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

function authHeaders(): Record<string, string> {
  const t =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface Node { id: string; display_name: string; difficulty: number; }
interface Edge { source: string; target: string; type: string; }

const W = 820;
const ROW_H = 70;
const PAD_X = 70;

export default function ConceptGraph() {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/knowledge/graph', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : { nodes: [], edges: [] }))
      .then((d) => { setNodes(d.nodes || []); setEdges(d.edges || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Deterministic layout: x by difficulty (1-10), y stacked within each column.
  const cols: Record<number, Node[]> = {};
  nodes.forEach((n) => {
    const d = Math.max(1, Math.min(10, n.difficulty || 5));
    (cols[d] = cols[d] || []).push(n);
  });
  const colKeys = Object.keys(cols).map(Number).sort((a, b) => a - b);
  const innerW = W - PAD_X * 2;
  const pos: Record<string, { x: number; y: number }> = {};
  let maxRows = 1;
  colKeys.forEach((d, ci) => {
    const x = colKeys.length > 1 ? PAD_X + (innerW * ci) / (colKeys.length - 1) : W / 2;
    cols[d].forEach((n, ri) => { pos[n.id] = { x, y: 60 + ri * ROW_H }; });
    maxRows = Math.max(maxRows, cols[d].length);
  });
  const H = Math.max(240, 60 + maxRows * ROW_H + 30);

  return (
    <>
      <Head><title>Concept Map — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Concept Map</h1>
            <Link href="/concepts" className="inline-flex items-center gap-1 text-accent text-sm hover:underline">List view <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <p className="text-white/50 mt-1 text-sm">
            Left to right is easier to harder. Lines are prerequisites (amber) and related links (grey). Click a node.
          </p>

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
          ) : nodes.length === 0 ? (
            <div className="bg-surface-elevated border border-border rounded-2xl p-10 text-center mt-8">
              <Network className="mx-auto mb-3 h-9 w-9 text-white/40" />
              <p className="text-white/60">No concepts yet — an admin can seed the graph from /admin.</p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto bg-surface-elevated border border-border rounded-2xl p-4">
              <svg width={W} height={H} className="min-w-full">
                {edges.map((e, i) => {
                  const a = pos[e.source]; const b = pos[e.target];
                  if (!a || !b) return null;
                  return (
                    <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                          stroke={e.type === 'prerequisite' ? '#f59e0b' : '#ffffff'}
                          strokeOpacity={e.type === 'prerequisite' ? 0.5 : 0.12}
                          strokeWidth={1.5} />
                  );
                })}
                {nodes.map((n) => {
                  const p = pos[n.id];
                  if (!p) return null;
                  return (
                    <g key={n.id} className="cursor-pointer" onClick={() => router.push(`/concepts/${n.id}`)}>
                      <circle cx={p.x} cy={p.y} r={6 + (n.difficulty || 5) * 1.2}
                              fill="#6366f1" fillOpacity={0.85} stroke="#a5b4fc" strokeWidth={1} />
                      <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize="11" fill="#e5e7eb">
                        {n.display_name.length > 22 ? n.display_name.slice(0, 21) + '…' : n.display_name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
