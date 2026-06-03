'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import QuizModal from '../components/Quiz/QuizModal';

function authHeaders(json = false): Record<string, string> {
  const t =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      : null;
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

interface Track { id: string; exam_type: string; name: string; description: string; score_scale: string; sections: { name: string }[]; }
interface Prediction { predicted_score: string | null; readiness_percent: number | null; note: string | null; }
interface Enrollment {
  enrollment_id: string;
  track: Track;
  target_score: string;
  exam_date: string | null;
  days_to_exam: number | null;
  prediction: Prediction;
}

export default function ExamsPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [practiceTrack, setPracticeTrack] = useState<Track | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([
        fetch('/api/exams/tracks', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/exams/enrollments', { headers: authHeaders() }).then((r) => r.json()),
      ]);
      setTracks(t.tracks || []);
      setEnrollments(e.enrollments || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const enrolledTypes = new Set(enrollments.map((e) => e.track.exam_type));

  const enroll = async (track: Track) => {
    const target = window.prompt(`Target score for ${track.name}? (${track.score_scale})`, '') || '';
    const date = window.prompt('Exam date? (YYYY-MM-DD, optional)', '') || '';
    setBusy(track.id);
    try {
      await fetch('/api/exams/enroll', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ track_id: track.id, target_score: target, exam_date: date || null }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const logMock = async (e: Enrollment) => {
    const pctStr = window.prompt(`Overall mock score for ${e.track.name}? (0-100%)`, '');
    if (pctStr === null) return;
    const pct = Math.max(0, Math.min(100, parseInt(pctStr, 10) || 0));
    setBusy(e.enrollment_id);
    try {
      await fetch('/api/exams/mock', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ track_id: e.track.id, overall_percent: pct, section_scores: {} }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Head><title>Exam Prep — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-white">Exam Prep</h1>
          <p className="text-white/50 mt-1 text-sm">
            Structured tracks with score prediction from your real performance.
          </p>

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              {/* Enrolled */}
              {enrollments.length > 0 && (
                <section className="mt-6">
                  <h2 className="text-white font-semibold mb-3">Your exams</h2>
                  <div className="space-y-3">
                    {enrollments.map((e) => (
                      <div key={e.enrollment_id} className="bg-surface-elevated border border-border rounded-2xl p-5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-white font-medium">{e.track.name}</p>
                            <p className="text-white/40 text-xs mt-0.5">
                              {e.track.score_scale}
                              {e.target_score && ` · target ${e.target_score}`}
                              {e.days_to_exam != null && ` · ${e.days_to_exam}d to exam`}
                            </p>
                          </div>
                          <div className="text-right">
                            {e.prediction.predicted_score ? (
                              <>
                                <p className="text-2xl font-bold text-white">{e.prediction.predicted_score}</p>
                                <p className="text-white/40 text-xs">predicted · {e.prediction.readiness_percent}% ready</p>
                              </>
                            ) : (
                              <p className="text-white/40 text-xs max-w-[180px]">{e.prediction.note}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setPracticeTrack(e.track)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
                          >
                            🎯 Practice quiz
                          </button>
                          <button
                            onClick={() => logMock(e)}
                            disabled={busy === e.enrollment_id}
                            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-white/70 hover:text-white text-sm disabled:opacity-50"
                          >
                            + Log mock score
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Catalogue */}
              <section className="mt-8">
                <h2 className="text-white font-semibold mb-3">Available tracks</h2>
                <div className="space-y-3">
                  {tracks.map((t) => (
                    <div key={t.id} className="bg-surface-elevated border border-border rounded-2xl p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white font-medium">{t.name}</p>
                          <p className="text-white/50 text-sm mt-0.5">{t.description}</p>
                          <p className="text-white/30 text-xs mt-2">
                            {t.score_scale} · {t.sections.map((s) => s.name).join(', ')}
                          </p>
                        </div>
                        <button
                          onClick={() => enroll(t)}
                          disabled={busy === t.id}
                          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                            enrolledTypes.has(t.exam_type)
                              ? 'bg-surface border border-border text-white/60'
                              : 'bg-accent text-white hover:opacity-90'
                          }`}
                        >
                          {enrolledTypes.has(t.exam_type) ? 'Update' : 'Enroll'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <QuizModal
        isOpen={!!practiceTrack}
        onClose={() => setPracticeTrack(null)}
        topicName={practiceTrack ? `${practiceTrack.name} practice` : undefined}
      />
    </>
  );
}
