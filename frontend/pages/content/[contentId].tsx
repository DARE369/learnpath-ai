'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

const TABS = [
  { key: 'ai_explanation', label: '📚 AI Explanation' },
  { key: 'flashcards', label: '🧠 Flashcards' },
  { key: 'youtube_match', label: '📺 Videos' },
  { key: 'quiz', label: '🎯 Quiz' },
];

interface Summary { id: string; title: string; file_type: string; detected_subject: string; status: string; }

export default function ContentDetail() {
  const router = useRouter();
  const contentId = typeof router.query.contentId === 'string' ? router.query.contentId : '';

  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState('ai_explanation');
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!contentId) return;
    fetch(`/api/content/${contentId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  }, [contentId]);

  const loadTab = useCallback(async (key: string) => {
    if (!contentId || data[key]) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/${contentId}/transform/${key}`, { headers: authHeaders() });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || 'Generation failed');
      setData((d) => ({ ...d, [key]: body }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [contentId, data]);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  const current = data[tab];

  return (
    <>
      <Head><title>{summary?.title || 'Your Notes'} — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Link href="/upload" className="text-white/40 hover:text-white text-sm">← Upload another</Link>
          <h1 className="text-2xl font-bold text-white mt-3 break-words">{summary?.title || 'Your Notes'}</h1>
          {summary && (
            <p className="text-white/40 text-sm mt-1">
              {summary.file_type} · subject: {summary.detected_subject || 'general'}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${tab === t.key ? 'bg-accent text-white border-accent' : 'bg-surface border-border text-white/60 hover:text-white'}`}
              >{t.label}</button>
            ))}
          </div>

          <div className="mt-6 bg-surface-elevated border border-border rounded-2xl p-6 min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-white/50 text-sm">Generating…</p>
                <p className="text-white/30 text-xs mt-1">First time for each tab can take ~10–20s.</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-400">{error}</p>
                <button onClick={() => loadTab(tab)} className="mt-3 px-4 py-2 bg-surface border border-border rounded-lg text-white/70 hover:text-white">Retry</button>
              </div>
            ) : !current ? null : tab === 'ai_explanation' ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-white/85 text-sm leading-relaxed">{current.content}</pre>
            ) : tab === 'flashcards' ? (
              <FlashcardsView cards={current.data?.flashcards || []} flipped={flipped} setFlipped={setFlipped} />
            ) : tab === 'youtube_match' ? (
              <VideosView videos={current.data?.videos || []} />
            ) : (
              <QuizView questions={current.data?.questions || []} revealed={revealed} setRevealed={setRevealed} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FlashcardsView({ cards, flipped, setFlipped }: any) {
  if (!cards.length) return <p className="text-white/40 text-sm">No flashcards generated.</p>;
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {cards.map((c: any, i: number) => (
        <button
          key={i}
          onClick={() => setFlipped((f: any) => ({ ...f, [i]: !f[i] }))}
          className="text-left bg-surface border border-border rounded-xl p-4 hover:border-accent transition min-h-[90px]"
        >
          {flipped[i] ? <p className="text-white/80 text-sm">{c.back}</p> : <p className="text-white font-medium text-sm">{c.front}</p>}
          <p className="text-white/30 text-xs mt-2">{flipped[i] ? 'Hide' : 'Reveal'}</p>
        </button>
      ))}
    </div>
  );
}

function VideosView({ videos }: any) {
  if (!videos.length) return <p className="text-white/40 text-sm">No video matches (YouTube search may be disabled on the server).</p>;
  return (
    <div className="space-y-3">
      {videos.map((v: any, i: number) => (
        <a
          key={i}
          href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-3 items-center bg-surface border border-border rounded-xl p-3 hover:border-accent transition"
        >
          {v.thumbnail && <img src={v.thumbnail} alt="" className="w-20 h-14 object-cover rounded-lg flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{v.title}</p>
            <p className="text-white/40 text-xs">{v.channel} · {v.concept}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

function QuizView({ questions, revealed, setRevealed }: any) {
  if (!questions.length) return <p className="text-white/40 text-sm">No quiz generated.</p>;
  return (
    <div className="space-y-5">
      {questions.map((q: any, i: number) => (
        <div key={i} className="border-b border-border pb-4 last:border-0">
          <p className="text-white font-medium text-sm">{i + 1}. {q.question}</p>
          <ul className="mt-2 space-y-1">
            {(q.options || []).map((opt: string, j: number) => (
              <li key={j} className="text-white/70 text-sm">
                {String.fromCharCode(65 + j)}. {opt}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setRevealed((r: any) => ({ ...r, [i]: !r[i] }))}
            className="mt-2 text-accent text-xs hover:underline"
          >
            {revealed[i] ? 'Hide answer' : 'Show answer'}
          </button>
          {revealed[i] && (
            <div className="mt-2 rounded-lg bg-green-500/10 border border-green-500/30 p-3">
              <p className="text-green-400 text-sm font-medium">Answer: {q.correct_answer}</p>
              {q.explanation && <p className="text-white/70 text-sm mt-1">{q.explanation}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
