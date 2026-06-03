'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import QuizModal from '../../components/Quiz/QuizModal';

function authHeaders(json = false): Record<string, string> {
  const t =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      : null;
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

interface Module { id: string; module_number: number; title: string; type: string; difficulty: string; duration_minutes: number; status: string; }
interface Forecast { modules_remaining: number; estimated_completion_date: string; days_ahead: number | null; pace_modules_per_week: number; }
interface PathDetail {
  id: string; path_name: string; completed_modules: number; total_modules: number;
  progress_percent: number; times_adapted: number; modules: Module[]; forecast: Forecast;
}

export default function PathDetail() {
  const router = useRouter();
  const pathId = typeof router.query.pathId === 'string' ? router.query.pathId : '';
  const [p, setP] = useState<PathDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [adaptMsg, setAdaptMsg] = useState<string | null>(null);
  const [quizModule, setQuizModule] = useState<Module | null>(null);

  const load = useCallback(async () => {
    if (!pathId) return;
    const res = await fetch(`/api/adaptive-paths/${pathId}`, { headers: authHeaders() });
    setP(res.ok ? await res.json() : null);
    setLoading(false);
  }, [pathId]);

  useEffect(() => { load(); }, [load]);

  const complete = async (moduleId: string, score?: number) => {
    setBusy(moduleId);
    try {
      const body = score != null ? { score } : {};
      const res = await fetch(`/api/adaptive-paths/${pathId}/modules/${moduleId}/complete`, {
        method: 'POST', headers: authHeaders(true), body: JSON.stringify(body),
      });
      if (res.ok) setP(await res.json());
    } finally {
      setBusy(null);
    }
  };

  const onQuizComplete = (score: number) => {
    const m = quizModule;
    setQuizModule(null);
    if (m) complete(m.id, score);
  };

  const adapt = async () => {
    setBusy('adapt');
    setAdaptMsg(null);
    try {
      const res = await fetch(`/api/adaptive-paths/${pathId}/adapt`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setAdaptMsg(data.count > 0 ? data.adaptations.map((a: any) => a.reason).join(' ') : 'No changes — your pace and difficulty look on track.');
        await load();
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!p) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-white/50">Path not found.</div>;
  }

  const f = p.forecast;

  return (
    <>
      <Head><title>{p.path_name} — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Link href="/paths" className="text-white/40 hover:text-white text-sm">← All paths</Link>
          <h1 className="text-2xl font-bold text-white mt-3">{p.path_name}</h1>

          {/* progress + forecast */}
          <div className="mt-4 bg-surface-elevated border border-border rounded-2xl p-5">
            <div className="flex justify-between text-sm text-white/60">
              <span>{p.completed_modules}/{p.total_modules} modules ({p.progress_percent}%)</span>
              <span>adapted {p.times_adapted}×</span>
            </div>
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden mt-2">
              <div className="h-full bg-accent rounded-full" style={{ width: `${p.progress_percent}%` }} />
            </div>
            <p className="text-white/40 text-xs mt-3">
              ~{f.pace_modules_per_week}/wk · {f.modules_remaining} left · est. finish {f.estimated_completion_date}
              {f.days_ahead != null && (
                <span className={f.days_ahead >= 0 ? 'text-green-400' : 'text-amber-300'}>
                  {' '}({f.days_ahead >= 0 ? `${f.days_ahead}d ahead` : `${-f.days_ahead}d behind`})
                </span>
              )}
            </p>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button onClick={adapt} disabled={busy === 'adapt'} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {busy === 'adapt' ? 'Adapting…' : '✨ Adapt to my performance'}
              </button>
              {adaptMsg && <span className="text-white/50 text-xs">{adaptMsg}</span>}
            </div>
          </div>

          {/* modules */}
          <h2 className="text-white font-semibold mt-6 mb-3">Modules</h2>
          <div className="space-y-2">
            {p.modules.map((m) => (
              <div key={m.id} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${m.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-surface-elevated'}`}>
                <div className="min-w-0">
                  <p className="text-white text-sm truncate">
                    {m.status === 'completed' ? '✓ ' : ''}{m.module_number}. {m.title}
                  </p>
                  <p className="text-white/40 text-xs">
                    {m.type} · {m.difficulty} · {m.duration_minutes}m
                  </p>
                </div>
                {m.status !== 'completed' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {m.type === 'quiz' ? (
                      <button onClick={() => setQuizModule(m)} disabled={busy === m.id}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50">
                        Start quiz
                      </button>
                    ) : (
                      <Link href="/learning/demo/0"
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">
                        Learn
                      </Link>
                    )}
                    <button onClick={() => complete(m.id)} disabled={busy === m.id}
                            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-white/60 hover:text-white text-sm disabled:opacity-50">
                      {busy === m.id ? '…' : 'Mark done'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <QuizModal
        isOpen={!!quizModule}
        onClose={() => setQuizModule(null)}
        topicName={quizModule?.title}
        onComplete={onQuizComplete}
      />
    </>
  );
}
