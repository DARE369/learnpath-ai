'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  BookOpen, Target, Trophy, Briefcase, Languages, FlaskConical,
  Wrench, Sparkles, Check, ArrowRight, ArrowLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

type GoalType = 'waec_jamb' | 'sat_ielts' | 'general';

interface WAECSubject { id: string; name: string; code: string; category: string }
interface DiagnosticQuestion { id: string; topic_id: string | null; question: string; options: string[] }

// ─── Goal options ─────────────────────────────────────────────────────────────

const GOAL_OPTIONS = [
  {
    id: 'waec_jamb' as GoalType,
    label: 'WAEC / JAMB',
    icon: Trophy,
    desc: 'Nigerian secondary school and university entrance exams',
    badge: '🇳🇬 Most popular',
  },
  {
    id: 'sat_ielts' as GoalType,
    label: 'SAT / IELTS / TOEFL',
    icon: Target,
    desc: 'International standardised tests and English proficiency exams',
    badge: null,
  },
  {
    id: 'general' as GoalType,
    label: 'Professional or Personal',
    icon: Sparkles,
    desc: 'Career skills, DIY, coding, languages, or anything else',
    badge: null,
  },
];

const SS_LEVELS = [
  { id: 'SS1', label: 'SS1', desc: 'First year senior secondary' },
  { id: 'SS2', label: 'SS2', desc: 'Second year — heading into exam prep' },
  { id: 'SS3', label: 'SS3', desc: 'Final year — exam is close' },
];

const INTL_EXAMS = [
  { id: 'ielts', label: 'IELTS', desc: 'International English Language Testing System' },
  { id: 'toefl', label: 'TOEFL', desc: 'Test of English as a Foreign Language' },
  { id: 'sat',   label: 'SAT',   desc: 'US college admissions standardised test' },
  { id: 'act',   label: 'ACT',   desc: 'Alternative US college admissions test' },
];

const LEARNING_STYLES = [
  { id: 'video',       label: 'Video lessons',       icon: '🎬' },
  { id: 'text',        label: 'Reading & Notes',      icon: '📖' },
  { id: 'interactive', label: 'Practice questions',   icon: '✏️' },
  { id: 'audio',       label: 'Audio / Podcasts',     icon: '🎧' },
  { id: 'visual',      label: 'Diagrams & Charts',    icon: '📊' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current ? 'w-6 bg-accent' : i === current ? 'w-3 bg-accent/60' : 'w-3 bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

function Card({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition-all ${
        selected
          ? 'border-accent bg-accent/10 shadow-glow-sm'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { accessToken, refresh } = useAuth();

  // Shared
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [learningStyles, setLearningStyles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // WAEC/JAMB path
  const [subjects, setSubjects] = useState<WAECSubject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [ssLevel, setSsLevel] = useState('');
  const [examDate, setExamDate] = useState('');

  // Diagnostic
  const [diagSubjectIndex, setDiagSubjectIndex] = useState(0);
  const [diagQuestions, setDiagQuestions] = useState<DiagnosticQuestion[]>([]);
  const [diagAnswers, setDiagAnswers] = useState<number[]>([]);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<{ score_percent: number; weak_topics: string[]; message: string } | null>(null);
  const [allDiagResults, setAllDiagResults] = useState<Record<string, typeof diagResult>>({});

  // SAT/IELTS path
  const [intlExam, setIntlExam] = useState('');
  const [testDate, setTestDate] = useState('');

  // General path
  const [generalTopic, setGeneralTopic] = useState('');

  // Step control
  const [step, setStep] = useState(0);

  const authHeader = accessToken
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }
    : { 'Content-Type': 'application/json' };

  // Load subjects for WAEC path
  useEffect(() => {
    if (goalType === 'waec_jamb' && subjects.length === 0) {
      fetch('/api/curriculum/subjects', { headers: authHeader })
        .then(r => r.json())
        .then(d => setSubjects(d.subjects || []))
        .catch(() => {});
    }
  }, [goalType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step definitions per path ──────────────────────────────────────────────

  // WAEC: 0=goal, 1=subjects, 2=ss_level, 3=exam_date, 4=diagnostic, 5=styles, 6=done
  // SAT:  0=goal, 1=exam_select, 2=test_date, 3=styles, 4=done
  // GENERAL: 0=goal, 1=topic, 2=styles, 3=done

  const totalSteps = !goalType ? 1 : goalType === 'waec_jamb' ? 7 : goalType === 'sat_ielts' ? 5 : 4;

  // ── Diagnostic flow ────────────────────────────────────────────────────────

  const loadDiagnosticForCurrentSubject = useCallback(async () => {
    if (!selectedSubjects[diagSubjectIndex] || !ssLevel) return;
    setDiagLoading(true);
    setDiagQuestions([]);
    setDiagAnswers([]);
    setDiagResult(null);
    try {
      const res = await fetch('/api/curriculum/diagnostic/start', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ subject_id: selectedSubjects[diagSubjectIndex], ss_level: ssLevel }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDiagQuestions(data.questions || []);
    } catch {
      setError('Could not load diagnostic questions. We\'ll skip this for now.');
      advanceDiagnosticOrFinish({});
    } finally {
      setDiagLoading(false);
    }
  }, [selectedSubjects, diagSubjectIndex, ssLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitDiagnostic = useCallback(async () => {
    const subjectId = selectedSubjects[diagSubjectIndex];
    if (!subjectId || diagQuestions.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/curriculum/diagnostic/submit', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          subject_id: subjectId,
          ss_level: ssLevel,
          questions: diagQuestions,
          answers: diagAnswers,
        }),
      });
      const data = await res.json();
      setDiagResult(data);
      const newResults = { ...allDiagResults, [subjectId]: data };
      setAllDiagResults(newResults);
    } catch {
      setError('Could not save diagnostic result. Moving on.');
      advanceDiagnosticOrFinish({});
    } finally {
      setSaving(false);
    }
  }, [selectedSubjects, diagSubjectIndex, diagQuestions, diagAnswers, ssLevel, allDiagResults]); // eslint-disable-line react-hooks/exhaustive-deps

  function advanceDiagnosticOrFinish(results: Record<string, typeof diagResult>) {
    const nextIdx = diagSubjectIndex + 1;
    if (nextIdx < selectedSubjects.length) {
      setDiagSubjectIndex(nextIdx);
      setDiagResult(null);
    } else {
      setStep(s => s + 1); // move to learning styles
    }
  }

  useEffect(() => {
    if (goalType === 'waec_jamb' && step === 4) {
      void loadDiagnosticForCurrentSubject();
    }
  }, [step, diagSubjectIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save final onboarding to backend ──────────────────────────────────────

  const completeOnboarding = useCallback(async () => {
    setSaving(true);
    try {
      // Save goal + level
      await fetch('/api/learner/onboarding/1', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          study_goals: goalType === 'waec_jamb'
            ? ['waec']
            : goalType === 'sat_ielts'
            ? [intlExam || 'sat']
            : ['hobby'],
        }),
      });

      // Save level
      await fetch('/api/learner/onboarding/2', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ level: 'intermediate', test_taken: false, test_score: null }),
      });

      // Save deadline
      const deadline = examDate || testDate;
      if (deadline) {
        await fetch('/api/learner/onboarding/3', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({ deadline_date: deadline, target_score: 7 }),
        });
      }

      // Save learning styles
      await fetch('/api/learner/onboarding/5', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ learning_styles: learningStyles }),
      });

      // Mark complete
      await fetch('/api/learner/onboarding/6', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({}),
      });

      await refresh();
      router.replace('/dashboard');
    } catch {
      setError('Something went wrong saving your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [goalType, intlExam, examDate, testDate, learningStyles, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ────────────────────────────────────────────────────────────

  const canAdvance = () => {
    if (step === 0) return !!goalType;
    if (!goalType) return false;

    if (goalType === 'waec_jamb') {
      if (step === 1) return selectedSubjects.length >= 1;
      if (step === 2) return !!ssLevel;
      if (step === 3) return !!examDate;
      if (step === 4) return diagQuestions.length === 0 || diagAnswers.length === diagQuestions.length;
      if (step === 5) return learningStyles.length >= 1;
    }
    if (goalType === 'sat_ielts') {
      if (step === 1) return !!intlExam;
      if (step === 2) return !!testDate;
      if (step === 3) return learningStyles.length >= 1;
    }
    if (goalType === 'general') {
      if (step === 1) return generalTopic.trim().length >= 3;
      if (step === 2) return learningStyles.length >= 1;
    }
    return true;
  };

  const handleNext = async () => {
    setError('');
    if (!canAdvance()) return;

    // Diagnostic submit before advancing
    if (goalType === 'waec_jamb' && step === 4 && diagResult === null && diagQuestions.length > 0) {
      await submitDiagnostic();
      return; // submitDiagnostic sets diagResult; user clicks "Continue" to advance
    }

    // Last step — complete onboarding
    const lastStep = goalType === 'waec_jamb' ? 5 : goalType === 'sat_ielts' ? 3 : 2;
    if (step === lastStep) {
      await completeOnboarding();
      return;
    }

    setStep(s => s + 1);
  };

  const handleBack = () => {
    setError('');
    if (step === 0) return;
    // When going back from diagnostic, reset diagnostic state
    if (goalType === 'waec_jamb' && step === 4) {
      setDiagSubjectIndex(0);
      setDiagQuestions([]);
      setDiagAnswers([]);
      setDiagResult(null);
    }
    setStep(s => s - 1);
  };

  const toggleStyle = (id: string) => {
    setLearningStyles(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjects(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const setDiagAnswer = (qi: number, answer: number) => {
    setDiagAnswers(prev => {
      const next = [...prev];
      next[qi] = answer;
      return next;
    });
  };

  // ── Render step ────────────────────────────────────────────────────────────

  const currentSubjectId = selectedSubjects[diagSubjectIndex];
  const currentSubjectName = subjects.find(s => s.id === currentSubjectId)?.name || currentSubjectId;

  const renderStep = () => {
    // STEP 0 — Goal selection (all paths)
    if (step === 0) {
      return (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-white">What are you studying for?</h1>
            <p className="mt-1.5 text-white/50 text-sm">Pick the option that best describes your goal.</p>
          </div>
          <div className="space-y-3">
            {GOAL_OPTIONS.map(g => (
              <Card key={g.id} selected={goalType === g.id} onClick={() => setGoalType(g.id)}>
                <div className="flex items-start gap-3">
                  <g.icon className="h-5 w-5 text-accent-light mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white text-sm">{g.label}</p>
                      {g.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-light font-medium">
                          {g.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{g.desc}</p>
                  </div>
                  {goalType === g.id && <Check className="h-4 w-4 text-accent flex-shrink-0" />}
                </div>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    // ── WAEC/JAMB PATH ──────────────────────────────────────────────────────

    if (goalType === 'waec_jamb') {
      if (step === 1) {
        return (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-white">Which subjects are you taking?</h1>
              <p className="mt-1.5 text-white/50 text-sm">Select all the subjects you need to pass. You&apos;ll get a personalised plan for each.</p>
            </div>
            {subjects.length === 0 ? (
              <div className="text-center py-8 text-white/40 text-sm">Loading subjects…</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {subjects.map(s => {
                  const sel = selectedSubjects.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSubject(s.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                        sel ? 'border-accent bg-accent/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium truncate">{s.name}</span>
                        {sel && <Check className="h-3.5 w-3.5 text-accent flex-shrink-0" />}
                      </div>
                      <p className="text-[10px] text-white/30 mt-0.5 capitalize">{s.category}</p>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedSubjects.length > 0 && (
              <p className="text-xs text-accent-light">{selectedSubjects.length} subject{selectedSubjects.length > 1 ? 's' : ''} selected</p>
            )}
          </div>
        );
      }

      if (step === 2) {
        return (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-white">Which year are you in?</h1>
              <p className="mt-1.5 text-white/50 text-sm">This helps us pitch the content at the right level.</p>
            </div>
            <div className="space-y-3">
              {SS_LEVELS.map(l => (
                <Card key={l.id} selected={ssLevel === l.id} onClick={() => setSsLevel(l.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{l.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{l.desc}</p>
                    </div>
                    {ssLevel === l.id && <Check className="h-4 w-4 text-accent" />}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      }

      if (step === 3) {
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + 14);
        return (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-white">When is your exam?</h1>
              <p className="mt-1.5 text-white/50 text-sm">We&apos;ll use this to build a realistic study schedule and show you how much time you have left.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/60">Exam date</label>
              <input
                type="date"
                value={examDate}
                min={minDate.toISOString().split('T')[0]}
                onChange={e => setExamDate(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            {examDate && (
              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                <p className="text-sm text-white/80">
                  You have{' '}
                  <span className="font-semibold text-accent-light">
                    {Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000)} days
                  </span>{' '}
                  to prepare. That&apos;s enough time to make a real difference.
                </p>
              </div>
            )}
          </div>
        );
      }

      if (step === 4) {
        // Diagnostic
        if (diagLoading) {
          return (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-white/60 text-sm">Building your {currentSubjectName} diagnostic…</p>
            </div>
          );
        }

        if (diagResult !== null) {
          const pct = diagResult.score_percent;
          const bar = Math.max(4, pct);
          return (
            <div className="space-y-5">
              <div>
                <p className="text-xs text-accent-light font-semibold uppercase tracking-wider mb-1">
                  {currentSubjectName} result
                </p>
                <h1 className="text-2xl font-bold text-white">You scored {pct}%</h1>
                <p className="mt-1.5 text-white/50 text-sm">{diagResult.message}</p>
              </div>

              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${bar}%` }}
                />
              </div>

              {diagResult.weak_topics.length > 0 && (
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
                  <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">Focus areas</p>
                  <div className="flex flex-wrap gap-2">
                    {diagResult.weak_topics.map(t => (
                      <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/20">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {diagSubjectIndex < selectedSubjects.length - 1 ? (
                <p className="text-sm text-white/50">
                  Next: <span className="text-white">{subjects.find(s => s.id === selectedSubjects[diagSubjectIndex + 1])?.name}</span>
                </p>
              ) : (
                <p className="text-sm text-white/50">All diagnostics complete. Let&apos;s set up your learning preferences.</p>
              )}
            </div>
          );
        }

        // Showing questions
        const answered = diagAnswers.filter(a => a !== undefined).length;
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">
                  {currentSubjectName} diagnostic
                  {selectedSubjects.length > 1 && ` (${diagSubjectIndex + 1}/${selectedSubjects.length})`}
                </p>
                <span className="text-xs text-white/40">{answered}/{diagQuestions.length} answered</span>
              </div>
              <h1 className="text-lg font-bold text-white">Quick knowledge check</h1>
              <p className="text-white/50 text-xs mt-0.5">10 questions — no pressure, just to find your starting point.</p>
            </div>

            <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
              {diagQuestions.map((q, qi) => (
                <div key={q.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5">
                  <p className="text-sm text-white font-medium leading-snug">
                    <span className="text-white/30 mr-1.5">{qi + 1}.</span>{q.question}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {q.options.map((opt, oi) => {
                      const sel = diagAnswers[qi] === oi;
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setDiagAnswer(qi, oi)}
                          className={`text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                            sel
                              ? 'border-accent bg-accent/15 text-white'
                              : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white/80'
                          }`}
                        >
                          <span className="font-semibold mr-1.5 text-white/30">{['A', 'B', 'C', 'D'][oi]}.</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      if (step === 5) {
        return renderStylesStep();
      }
    }

    // ── SAT / IELTS PATH ────────────────────────────────────────────────────

    if (goalType === 'sat_ielts') {
      if (step === 1) {
        return (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-white">Which exam are you preparing for?</h1>
              <p className="mt-1.5 text-white/50 text-sm">We&apos;ll tailor your study path to the right format and content.</p>
            </div>
            <div className="space-y-3">
              {INTL_EXAMS.map(e => (
                <Card key={e.id} selected={intlExam === e.id} onClick={() => setIntlExam(e.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{e.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{e.desc}</p>
                    </div>
                    {intlExam === e.id && <Check className="h-4 w-4 text-accent" />}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      }

      if (step === 2) {
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + 14);
        return (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-white">When is your test?</h1>
              <p className="mt-1.5 text-white/50 text-sm">
                We&apos;ll use this to pace your study plan. If you don&apos;t have a date yet, pick a target and adjust later.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/60">Test date</label>
              <input
                type="date"
                value={testDate}
                min={minDate.toISOString().split('T')[0]}
                onChange={e => setTestDate(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10">
              <p className="text-xs text-white/50">
                We&apos;ll show you a readiness score as you study — not a predicted grade, just an honest indicator of your progress toward your aim.
              </p>
            </div>
          </div>
        );
      }

      if (step === 3) return renderStylesStep();
    }

    // ── GENERAL PATH ────────────────────────────────────────────────────────

    if (goalType === 'general') {
      if (step === 1) {
        return (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-white">What do you want to learn?</h1>
              <p className="mt-1.5 text-white/50 text-sm">
                Type anything — a skill, a subject, a project, a question you want answered.
              </p>
            </div>
            <textarea
              rows={3}
              value={generalTopic}
              onChange={e => setGeneralTopic(e.target.value)}
              placeholder="e.g. How to start a business, Python programming, home electrical wiring, French language basics…"
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-accent/50 transition-colors resize-none leading-relaxed"
            />
            <p className="text-xs text-white/30">
              We&apos;ll build a curated learning path from the best videos and resources available.
            </p>
          </div>
        );
      }

      if (step === 2) return renderStylesStep();
    }

    return null;
  };

  function renderStylesStep() {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">How do you learn best?</h1>
          <p className="mt-1.5 text-white/50 text-sm">Select everything that applies. We&apos;ll weight your content mix accordingly.</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {LEARNING_STYLES.map(s => {
            const sel = learningStyles.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleStyle(s.id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                  sel ? 'border-accent bg-accent/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20'
                }`}
              >
                <span className="text-lg">{s.icon}</span>
                <span className="text-sm font-medium">{s.label}</span>
                {sel && <Check className="ml-auto h-4 w-4 text-accent" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── CTA label ─────────────────────────────────────────────────────────────

  const ctaLabel = () => {
    if (saving) return 'Saving…';
    if (!goalType) return 'Continue';

    if (goalType === 'waec_jamb') {
      if (step === 4) {
        if (diagResult !== null) return diagSubjectIndex < selectedSubjects.length - 1 ? 'Next subject' : 'Continue';
        if (diagQuestions.length > 0) return 'Submit answers';
        return 'Skip';
      }
      if (step === 5) return 'Create my plan';
    }
    if (goalType === 'sat_ielts' && step === 3) return 'Create my plan';
    if (goalType === 'general' && step === 2) return 'Start learning';

    return 'Continue';
  };

  const handleCtaClick = async () => {
    // If on diagnostic result, advance to next subject or next step
    if (goalType === 'waec_jamb' && step === 4 && diagResult !== null) {
      const nextIdx = diagSubjectIndex + 1;
      if (nextIdx < selectedSubjects.length) {
        setDiagSubjectIndex(nextIdx);
        setDiagResult(null);
      } else {
        setStep(s => s + 1);
      }
      return;
    }
    await handleNext();
  };

  return (
    <>
      <Head><title>Get started — LearnPath AI</title></Head>

      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold text-lg">LearnPath AI</span>
          </div>

          {/* Progress */}
          {goalType && (
            <div className="mb-6">
              <ProgressDots total={totalSteps} current={step} />
            </div>
          )}

          {/* Step content */}
          <div className="min-h-[360px]">
            {renderStep()}
          </div>

          {/* Error */}
          {error && (
            <p className="mt-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white/50 hover:text-white text-sm transition-colors disabled:opacity-30"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={handleCtaClick}
              disabled={saving || !canAdvance()}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              {ctaLabel()}
              {!saving && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
