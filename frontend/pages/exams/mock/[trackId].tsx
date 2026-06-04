'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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

interface Q { id: string; section: string; text: string; options: { id: string; text: string }[]; }
interface Results {
  overall_percent: number; correct: number; total: number;
  predicted_score: string; section_scores: Record<string, number>;
  review: { id: string; is_correct: boolean; correct_answer_id: string; your_answer: string | null; explanation: string }[];
}

export default function MockExam() {
  const router = useRouter();
  const trackId = typeof router.query.trackId === 'string' ? router.query.trackId : '';

  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [trackName, setTrackName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const res = await fetch('/api/exams/mock/submit', {
      method: 'POST', headers: authHeaders(true), body: JSON.stringify({ track_id: trackId, answers }),
    });
    setResults(await res.json());
  }, [trackId, answers]);

  useEffect(() => {
    if (!trackId) return;
    (async () => {
      try {
        const res = await fetch(`/api/exams/tracks/${trackId}/mock/start`, { method: 'POST', headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Could not start');
        if (!data.questions?.length) throw new Error('No questions available — seed the concept graph / set CLAUDE_API_KEY.');
        setQuestions(data.questions);
        setTrackName(data.track?.name || 'Mock exam');
        setTimeLeft((data.duration_minutes || 10) * 60);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      }
    })();
  }, [trackId]);

  // Countdown → auto-submit at 0.
  useEffect(() => {
    if (!questions || results || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => {
      if (s <= 1) { clearInterval(t); submit(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [questions, results, timeLeft, submit]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-6">
        <div>
          <p className="text-red-400">{error}</p>
          <Link href="/exams" className="text-accent text-sm mt-3 inline-block hover:underline">← Back to exams</Link>
        </div>
      </div>
    );
  }
  if (!questions) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (results) {
    return (
      <>
        <Head><title>Mock Results — LearnPath AI</title></Head>
        <div className="min-h-screen bg-background">
          <div className="max-w-2xl mx-auto px-6 py-10">
            <h1 className="text-2xl font-bold text-white">{trackName} — Results</h1>
            <div className="mt-6 bg-surface-elevated border border-border rounded-2xl p-6 text-center">
              <div className="text-5xl font-bold text-white">{results.predicted_score}</div>
              <p className="text-white/50 mt-1">predicted · {results.correct}/{results.total} correct ({results.overall_percent}%)</p>
            </div>
            {Object.keys(results.section_scores).length > 0 && (
              <div className="mt-5 space-y-2">
                {Object.entries(results.section_scores).map(([s, v]) => (
                  <div key={s} className="flex items-center justify-between bg-surface-elevated border border-border rounded-xl px-4 py-3">
                    <span className="text-white/80 text-sm">{s}</span>
                    <span className="text-white font-medium">{v}%</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <Link href={`/exams/mock/${trackId}`} onClick={() => { submittedRef.current = false; }} className="px-4 py-2 bg-surface border border-border rounded-lg text-white/70 hover:text-white text-sm">Retake</Link>
              <Link href="/exams" className="px-4 py-2 bg-accent text-white rounded-lg text-sm">Done</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const q = questions[idx];
  const mins = Math.floor(timeLeft / 60), secs = timeLeft % 60;
  const answeredCount = Object.keys(answers).length;

  return (
    <>
      <Head><title>{trackName} — Mock Exam</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">{trackName}</span>
            <span className={`font-mono text-sm px-3 py-1 rounded-lg ${timeLeft < 60 ? 'bg-red-500/20 text-red-300' : 'bg-surface text-white/70'}`}>
              ⏱ {mins}:{secs.toString().padStart(2, '0')}
            </span>
          </div>

          {/* Question grid */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setIdx(i)}
                      className={`w-7 h-7 rounded text-xs ${i === idx ? 'bg-accent text-white' : answers[qq.id] ? 'bg-green-500/20 text-green-300' : 'bg-surface border border-border text-white/40'}`}>
                {i + 1}
              </button>
            ))}
          </div>

          {/* Question */}
          <div className="mt-5 bg-surface-elevated border border-border rounded-2xl p-6">
            <p className="text-white/40 text-xs">{q.section} · Q{idx + 1} of {questions.length}</p>
            <p className="text-white font-medium mt-2">{q.text}</p>
            <div className="mt-4 space-y-2">
              {q.options.map((o) => (
                <button key={o.id} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition ${answers[q.id] === o.id ? 'border-accent bg-accent/10 text-white' : 'border-border bg-surface text-white/70 hover:text-white'}`}>
                  {o.text}
                </button>
              ))}
            </div>
          </div>

          {/* Nav */}
          <div className="mt-5 flex items-center justify-between">
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
                    className="px-4 py-2 rounded-lg border border-border text-white/60 hover:text-white text-sm disabled:opacity-30">Prev</button>
            {idx < questions.length - 1 ? (
              <button onClick={() => setIdx((i) => i + 1)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">Next</button>
            ) : (
              <button onClick={submit} className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium">
                Submit ({answeredCount}/{questions.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
