'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Target, FileText, Compass, X, Calendar, TrendingUp } from 'lucide-react';
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

interface Track {
  id: string;
  exam_type: string;
  name: string;
  description: string;
  score_scale: string;
  sections: { name: string }[];
}

interface Enrollment {
  enrollment_id: string;
  track: Track;
  target_score: string;
  exam_date: string | null;
  days_to_exam: number | null;
  prediction: { predicted_score: string | null; readiness_percent: number | null; note: string | null };
}

// ─── Enroll modal ─────────────────────────────────────────────────────────────

interface EnrollModalProps {
  track: Track;
  onClose: () => void;
  onDone: () => void;
}

function EnrollModal({ track, onClose, onDone }: EnrollModalProps) {
  const [targetScore, setTargetScore] = useState('');
  const [examDate, setExamDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/exams/enroll', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          track_id: track.id,
          target_score: targetScore || null,
          exam_date: examDate || null,
        }),
      });
      if (!res.ok) throw new Error('Enrollment failed');
      onDone();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface-elevated border border-border rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">{track.name}</h2>
            <p className="text-sm text-white/50 mt-0.5">Set up your study track</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-white/70">
              What score are you aiming for?
              <span className="ml-1.5 text-white/30">({track.score_scale})</span>
            </label>
            <input
              type="text"
              value={targetScore}
              onChange={e => setTargetScore(e.target.value)}
              placeholder={`e.g. ${track.score_scale.split('-').pop()?.split(' ')[0] || '80'}`}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-accent/50 transition-colors"
            />
            <p className="text-xs text-white/30">This is a study goal, not a promise. We&apos;ll use it to pace your preparation.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-white/70 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> When is your exam?
              <span className="text-white/30 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={examDate}
              min={minDate.toISOString().split('T')[0]}
              onChange={e => setExamDate(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-white/60 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Starting…' : 'Start preparing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Log mock score modal ─────────────────────────────────────────────────────

interface LogMockModalProps {
  enrollment: Enrollment;
  onClose: () => void;
  onDone: () => void;
}

function LogMockModal({ enrollment, onClose, onDone }: LogMockModalProps) {
  const [score, setScore] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pct = Math.max(0, Math.min(100, parseInt(score, 10) || 0));
    setSaving(true);
    try {
      await fetch('/api/exams/mock', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ track_id: enrollment.track.id, overall_percent: pct, section_scores: {} }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface-elevated border border-border rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Log mock score</h2>
            <p className="text-xs text-white/50 mt-0.5">{enrollment.track.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm text-white/70">Overall score (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={score}
              onChange={e => setScore(e.target.value)}
              placeholder="e.g. 68"
              autoFocus
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-white/60 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !score} className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'Saving…' : 'Save score'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExamsPage() {
  const router = useRouter();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [practiceTrack, setPracticeTrack] = useState<Track | null>(null);
  const [enrollModal, setEnrollModal] = useState<Track | null>(null);
  const [logMockModal, setLogMockModal] = useState<Enrollment | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([
        fetch('/api/exams/tracks', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/exams/enrollments', { headers: authHeaders() }).then((r) => r.json()),
      ]);
      setTracks(t.tracks || []);
      setEnrollments(e.enrollments || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const buildPath = async (e: Enrollment) => {
    setBusy(e.enrollment_id);
    try {
      const res = await fetch(`/api/exams/tracks/${e.track.id}/build-path`, {
        method: 'POST',
        headers: authHeaders(true),
      });
      const data = await res.json();
      if (res.ok && data.id) router.push(`/paths/${data.id}`);
    } finally { setBusy(null); }
  };

  const enrolledTypes = new Set(enrollments.map((e) => e.track.exam_type));

  return (
    <>
      <Head><title>Exam Prep — LearnPath AI</title></Head>

      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-white">Exam Prep</h1>
          <p className="text-white/50 mt-1 text-sm">
            Structured study tracks built around what you actually need to learn.
          </p>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Enrolled exams */}
              {enrollments.length > 0 && (
                <section className="mt-8">
                  <h2 className="text-white font-semibold mb-3">Your exams</h2>
                  <div className="space-y-3">
                    {enrollments.map((e) => {
                      const readiness = e.prediction.readiness_percent ?? 0;
                      const readinessColor = readiness >= 70
                        ? 'text-green-400'
                        : readiness >= 40
                        ? 'text-amber-400'
                        : 'text-white/50';
                      const barColor = readiness >= 70
                        ? 'bg-green-500'
                        : readiness >= 40
                        ? 'bg-amber-500'
                        : 'bg-white/20';
                      const readinessLabel = readiness >= 70
                        ? 'On track'
                        : readiness >= 40
                        ? 'Keep studying'
                        : 'Just getting started';

                      return (
                        <div key={e.enrollment_id} className="bg-surface-elevated border border-border rounded-2xl p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="text-white font-semibold">{e.track.name}</p>
                              <div className="flex items-center gap-2 flex-wrap mt-1">
                                {e.target_score && (
                                  <span className="text-xs text-white/40">
                                    Aiming for: <span className="text-white/70">{e.target_score}</span>
                                  </span>
                                )}
                                {e.days_to_exam != null && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent-light">
                                    {e.days_to_exam}d to exam
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-xl font-bold tabular-nums ${readinessColor}`}>{readiness}%</p>
                              <p className="text-white/40 text-xs mt-0.5">ready · {readinessLabel}</p>
                            </div>
                          </div>

                          {/* Readiness bar */}
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
                              style={{ width: `${Math.max(3, readiness)}%` }}
                            />
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setPracticeTrack(e.track)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
                            >
                              <Target className="h-3.5 w-3.5" /> Practice quiz
                            </button>
                            <button
                              onClick={() => router.push(`/exams/mock/${e.track.id}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm transition-colors"
                            >
                              <FileText className="h-3.5 w-3.5" /> Mock exam
                            </button>
                            <button
                              onClick={() => buildPath(e)}
                              disabled={busy === e.enrollment_id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-white/70 hover:text-white text-sm disabled:opacity-50 transition-colors"
                            >
                              <Compass className="h-3.5 w-3.5" /> Build study path
                            </button>
                            <button
                              onClick={() => setLogMockModal(e)}
                              disabled={busy === e.enrollment_id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-white/70 hover:text-white text-sm disabled:opacity-50 transition-colors"
                            >
                              <TrendingUp className="h-3.5 w-3.5" /> Log mock score
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Available tracks */}
              <section className="mt-8">
                <h2 className="text-white font-semibold mb-1">Available tracks</h2>
                <p className="text-white/40 text-xs mb-3">
                  Pick an exam to start building a focused study plan.
                </p>
                <div className="space-y-3">
                  {tracks.map((t) => {
                    const isEnrolled = enrolledTypes.has(t.exam_type);
                    return (
                      <div key={t.id} className="bg-surface-elevated border border-border rounded-2xl p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-white font-medium">{t.name}</p>
                            <p className="text-white/50 text-sm mt-0.5">{t.description}</p>
                            <p className="text-white/30 text-xs mt-2">
                              {t.score_scale} · {t.sections.map((s) => s.name).join(', ')}
                            </p>
                          </div>
                          <button
                            onClick={() => setEnrollModal(t)}
                            disabled={busy === t.id}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                              isEnrolled
                                ? 'bg-surface border border-border text-white/60 hover:text-white'
                                : 'bg-accent text-white hover:opacity-90'
                            }`}
                          >
                            {isEnrolled ? 'Update' : 'Enroll'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {enrollModal && (
        <EnrollModal
          track={enrollModal}
          onClose={() => setEnrollModal(null)}
          onDone={() => { setEnrollModal(null); void load(); }}
        />
      )}

      {logMockModal && (
        <LogMockModal
          enrollment={logMockModal}
          onClose={() => setLogMockModal(null)}
          onDone={() => { setLogMockModal(null); void load(); }}
        />
      )}

      <QuizModal
        isOpen={!!practiceTrack}
        onClose={() => setPracticeTrack(null)}
        topicName={practiceTrack ? `${practiceTrack.name} practice` : undefined}
      />
    </>
  );
}
