'use client';
import { ArrowLeft, Check, AlertTriangle, Compass } from 'lucide-react';

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

interface Prereq {
  id: string;
  display_name: string;
  difficulty: number;
  required_mastery: number;
  user_mastery: number | null;
  is_met: boolean;
}
interface Detail {
  concept: { id: string; display_name: string; difficulty: number; subject?: string };
  prerequisites: { prerequisites: Prereq[]; all_prerequisites_met: boolean };
  gaps: { gaps: any[]; total_learning_hours: number; ready_to_learn: boolean };
  related: { id: string; display_name: string; relationship: string }[];
  resources: { quiz_questions: number };
}

export default function ConceptDetail() {
  const router = useRouter();
  const conceptId = typeof router.query.conceptId === 'string' ? router.query.conceptId : '';
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildingPath, setBuildingPath] = useState(false);

  const buildPath = async () => {
    if (!d) return;
    setBuildingPath(true);
    try {
      const res = await fetch('/api/adaptive-paths/', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal_concept_id: d.concept.id, target_weeks: 8 }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/paths/${data.id}`);
        return;
      }
    } catch {
      /* ignore */
    }
    setBuildingPath(false);
  };

  useEffect(() => {
    if (!conceptId) return;
    fetch(`/api/knowledge/concepts/${conceptId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setLoading(false));
  }, [conceptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!d) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-white/50">
        Concept not found.
      </div>
    );
  }

  const prereqs = d.prerequisites.prerequisites;

  return (
    <>
      <Head><title>{d.concept.display_name} — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Link href="/concepts" className="inline-flex items-center gap-1 text-white/40 hover:text-white text-sm"><ArrowLeft className="h-3.5 w-3.5" /> All concepts</Link>
          <h1 className="text-2xl font-bold text-white mt-3">{d.concept.display_name}</h1>
          <p className="text-white/40 text-sm mt-1">
            Difficulty {d.concept.difficulty}/10
            {d.resources.quiz_questions > 0 && ` · ${d.resources.quiz_questions} quiz questions`}
          </p>

          {/* Readiness banner */}
          <div className={`mt-5 rounded-2xl p-4 border ${d.gaps.ready_to_learn ? 'border-green-500/30 bg-green-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {d.gaps.ready_to_learn ? (
                <p className="flex items-center gap-1.5 text-green-400 font-medium"><Check className="h-4 w-4" /> You&apos;re ready to learn this.</p>
              ) : (
                <p className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" /> Fill {d.gaps.gaps.length} prerequisite gap{d.gaps.gaps.length === 1 ? '' : 's'} first
                  {d.gaps.total_learning_hours > 0 && ` (~${d.gaps.total_learning_hours}h)`}.
                </p>
              )}
              <button
                onClick={buildPath}
                disabled={buildingPath}
                className="flex-shrink-0 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1.5"><Compass className="h-4 w-4" /> {buildingPath ? 'Building…' : 'Build a learning path'}</span>
              </button>
            </div>
          </div>

          {/* Prerequisites */}
          <section className="mt-6">
            <h2 className="text-white font-semibold mb-3">Prerequisites</h2>
            {prereqs.length === 0 ? (
              <p className="text-white/40 text-sm">No prerequisites — a great place to start.</p>
            ) : (
              <ul className="space-y-2">
                {prereqs.map((p) => (
                  <li key={p.id} className="flex items-center justify-between bg-surface-elevated border border-border rounded-xl px-4 py-3">
                    <Link href={`/concepts/${p.id}`} className="text-white hover:text-accent text-sm">
                      {p.display_name}
                    </Link>
                    <span className={`text-xs ${p.is_met ? 'text-green-400' : 'text-amber-300'}`}>
                      {p.is_met
                        ? <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> ready</span>
                        : `${p.user_mastery ?? 0}% / ${p.required_mastery}%`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Related */}
          {d.related.length > 0 && (
            <section className="mt-6">
              <h2 className="text-white font-semibold mb-3">Related concepts</h2>
              <div className="flex flex-wrap gap-2">
                {d.related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/concepts/${r.id}`}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-border text-white/70 hover:text-white text-sm"
                  >
                    {r.display_name} <span className="text-white/30 text-xs">· {r.relationship}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
