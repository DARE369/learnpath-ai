'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  study_goals: string[];
  level: string;
  placement_test_taken: boolean;
  test_score: number | null;
  deadline_date: string;
  target_score: number;
  weekly_hours: number;
  preferred_times: string[];
  learning_styles: string[];
}

const EMPTY_FORM: FormData = {
  study_goals: [],
  level: 'intermediate',
  placement_test_taken: false,
  test_score: null,
  deadline_date: '',
  target_score: 7,
  weekly_hours: 10,
  preferred_times: [],
  learning_styles: [],
};

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const GOAL_OPTIONS = [
  { id: 'ielts',        label: 'IELTS Exam',          icon: '📚', desc: 'Prepare for IELTS, TOEFL or English proficiency exams' },
  { id: 'sat',          label: 'SAT / ACT Prep',       icon: '🎯', desc: 'US college admissions standardised test preparation' },
  { id: 'waec',         label: 'WAEC / JAMB',          icon: '🏆', desc: 'Nigerian secondary school and university entrance exams' },
  { id: 'professional', label: 'Professional Skill',   icon: '💼', desc: 'Data science, coding, finance, management and more' },
  { id: 'language',     label: 'Language Learning',    icon: '🗣️', desc: 'English, French, Yoruba or any other language' },
  { id: 'academic',     label: 'Academic Subject',     icon: '🔬', desc: 'Math, Physics, Chemistry, Biology and more' },
  { id: 'trades',       label: 'Trades / Practical',   icon: '🛠️', desc: 'Technical, vocational and hands-on skills' },
  { id: 'hobby',        label: 'Personal Interest',    icon: '🌟', desc: 'Learn something just for the love of it' },
];

const LEVEL_OPTIONS = [
  { id: 'beginner',     label: 'Beginner',     desc: "I'm new to this or still struggling with the basics" },
  { id: 'intermediate', label: 'Intermediate', desc: 'I understand the basics and want to build on them' },
  { id: 'advanced',     label: 'Advanced',     desc: "I'm confident and want to master advanced material" },
];

const PLACEMENT_QUESTIONS = [
  { id: 'p1',  diff: 'easy',   text: 'Which planet is closest to the Sun?',           opts: ['Mercury','Venus','Earth','Mars'] },
  { id: 'p2',  diff: 'easy',   text: 'What is 15 × 4?',                               opts: ['50','60','55','65'] },
  { id: 'p3',  diff: 'easy',   text: 'What is the chemical symbol for water?',        opts: ['H2O','CO2','O2','HO'] },
  { id: 'p4',  diff: 'medium', text: 'What is the derivative of x³?',                 opts: ['3x²','x²','3x','2x³'] },
  { id: 'p5',  diff: 'medium', text: 'In which country was Shakespeare born?',        opts: ['England','Ireland','Scotland','France'] },
  { id: 'p6',  diff: 'medium', text: 'What does CPU stand for?',                      opts: ['Central Processing Unit','Core Power Unit','Computer Processing Unit','Central Program Unit'] },
  { id: 'p7',  diff: 'medium', text: 'What is the capital of Australia?',             opts: ['Sydney','Melbourne','Canberra','Brisbane'] },
  { id: 'p8',  diff: 'hard',   text: 'What is the integral of 1/x?',                  opts: ['ln|x| + C','x⁻² + C','eˣ + C','x + C'] },
  { id: 'p9',  diff: 'hard',   text: 'Who developed the theory of general relativity?', opts: ['Einstein','Newton','Bohr','Heisenberg'] },
  { id: 'p10', diff: 'hard',   text: 'What does DNA stand for?',                      opts: ['Deoxyribonucleic Acid','Dinucleic Acid','Dinitrogen Acid','Deoxynuclein Acid'] },
];

const TIME_COMMITMENT = [5, 10, 15, 20];

const STUDY_TIMES = [
  { id: 'early_morning', label: 'Early Morning', time: '5 – 7 AM',  icon: '🌅' },
  { id: 'morning',       label: 'Morning',       time: '7 – 12 PM', icon: '☀️' },
  { id: 'afternoon',     label: 'Afternoon',     time: '12 – 5 PM', icon: '🌤️' },
  { id: 'evening',       label: 'Evening',       time: '5 – 9 PM',  icon: '🌆' },
  { id: 'late_night',    label: 'Late Night',    time: '9 PM+',     icon: '🌙' },
];

const LEARNING_STYLES = [
  { id: 'video',       label: 'Video lessons',         icon: '📹', desc: 'Learn by watching explanations and examples' },
  { id: 'audio',       label: 'Audio / Podcasts',      icon: '🎧', desc: 'Listen to lessons while doing other activities' },
  { id: 'text',        label: 'Reading & Notes',       icon: '📝', desc: 'Prefer text-based content and note-taking' },
  { id: 'interactive', label: 'Interactive Exercises', icon: '✏️', desc: 'Learn by doing lots of practice problems' },
  { id: 'discussion',  label: 'Discussion & Q&A',      icon: '💬', desc: 'Learn by asking questions and discussing' },
  { id: 'visual',      label: 'Visual Diagrams',       icon: '📊', desc: 'Prefer charts, graphs and concept maps' },
  { id: 'groups',      label: 'Study Groups',          icon: '🤝', desc: 'Learn best with others' },
];

const GOAL_LABEL: Record<string, string> = Object.fromEntries(GOAL_OPTIONS.map(g => [g.id, g.label]));

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-white/40 mb-2">
        <span>Step {current} of {total}</span>
        <span>{Math.round((current / total) * 100)}% complete</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div
          className="h-1.5 rounded-full bg-accent transition-all duration-500"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placement test mini-component
// ---------------------------------------------------------------------------

function PlacementTest({ onComplete }: { onComplete: (score: number, level: string) => void }) {
  const [qIdx, setQIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Use a simple sequential ordering for the client-side demo test
  const ANSWERS: Record<string, string> = {
    p1: 'Mercury', p2: '60', p3: 'H2O', p4: '3x²', p5: 'England',
    p6: 'Central Processing Unit', p7: 'Canberra',
    p8: 'ln|x| + C', p9: 'Einstein', p10: 'Deoxyribonucleic Acid',
  };

  const q = PLACEMENT_QUESTIONS[qIdx];

  const handleSelect = (opt: string) => {
    if (revealed) return;
    setSelected(opt);
    setRevealed(true);
    const isCorrect = opt === ANSWERS[q.id];
    if (isCorrect) setCorrect(c => c + 1);

    setTimeout(() => {
      if (qIdx + 1 >= PLACEMENT_QUESTIONS.length) {
        const total = qIdx + 1;
        const score = Math.round(((isCorrect ? correct + 1 : correct) / total) * 100);
        const level = score < 34 ? 'beginner' : score < 67 ? 'intermediate' : 'advanced';
        onComplete(score, level);
      } else {
        setQIdx(i => i + 1);
        setSelected(null);
        setRevealed(false);
      }
    }, 900);
  };

  const rightAnswer = ANSWERS[q.id];

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between text-sm text-white/50">
        <span>Question {qIdx + 1} / {PLACEMENT_QUESTIONS.length}</span>
        <span className="capitalize px-2 py-0.5 rounded-full bg-white/10 text-xs">{q.diff}</span>
      </div>
      <p className="text-white font-medium">{q.text}</p>
      <div className="grid grid-cols-1 gap-2">
        {q.opts.map(opt => {
          let cls = 'rounded-lg border p-3 text-sm text-left transition-all cursor-pointer ';
          if (!revealed) {
            cls += selected === opt
              ? 'border-accent bg-accent/20 text-white'
              : 'border-white/10 bg-white/5 text-white/80 hover:border-accent/50';
          } else {
            if (opt === rightAnswer) cls += 'border-green-500 bg-green-500/20 text-green-300';
            else if (opt === selected) cls += 'border-red-500 bg-red-500/20 text-red-300';
            else cls += 'border-white/10 bg-white/5 text-white/40';
          }
          return (
            <button key={opt} type="button" className={cls} onClick={() => handleSelect(opt)}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main onboarding component
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTest, setShowTest] = useState(false);
  const [pace, setPace] = useState<{ hours_per_week: number; hours_per_day: number; feasible: boolean } | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const TOTAL = 6;

  const set = (patch: Partial<FormData>) => setForm(f => ({ ...f, ...patch }));

  const toggleArr = <K extends keyof FormData>(key: K, val: string) => {
    const arr = form[key] as string[];
    set({ [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] } as any);
  };

  // -----------------------------------------------------------------------
  // Validation per step
  // -----------------------------------------------------------------------
  const validate = (): string | null => {
    if (step === 1 && form.study_goals.length === 0) return 'Please select at least one goal';
    if (step === 3 && !form.deadline_date) return 'Please pick a target date';
    if (step === 5 && form.learning_styles.length < 2) return 'Please select at least 2 learning styles';
    return null;
  };

  // -----------------------------------------------------------------------
  // Save step to backend
  // -----------------------------------------------------------------------
  const saveStep = useCallback(async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);

    const payloads: Record<number, object> = {
      1: { study_goals: form.study_goals },
      2: { level: form.level, test_taken: form.placement_test_taken, test_score: form.test_score },
      3: { deadline_date: form.deadline_date, target_score: form.target_score },
      4: { weekly_hours: form.weekly_hours, preferred_times: form.preferred_times },
      5: { learning_styles: form.learning_styles },
      6: {},
    };

    try {
      const res = await fetch(`/api/learner/onboarding/${step}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payloads[step]),
      });
      if (!res.ok) throw new Error('Failed to save — please try again');

      // After step 3 fetch pace
      if (step === 3) {
        const pr = await fetch('/api/learner/calculate-pace', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (pr.ok) setPace(await pr.json());
      }

      if (step === TOTAL) {
        router.replace('/dashboard');
      } else {
        setStep(s => s + 1);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [step, form, accessToken, router]);

  // -----------------------------------------------------------------------
  // Render step content
  // -----------------------------------------------------------------------
  const renderStep = () => {
    switch (step) {
      // ---- STEP 1: Goals ----
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">What do you want to achieve?</h2>
              <p className="mt-1 text-white/50">Select 1–2 goals that matter most to you</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GOAL_OPTIONS.map(g => {
                const sel = form.study_goals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleArr('study_goals', g.id)}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                      sel ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/5 hover:border-accent/40'
                    }`}
                  >
                    <span className="text-2xl">{g.icon}</span>
                    <div>
                      <p className={`font-medium ${sel ? 'text-white' : 'text-white/80'}`}>{g.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{g.desc}</p>
                    </div>
                    {sel && <span className="ml-auto text-accent">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );

      // ---- STEP 2: Level ----
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">What is your current level?</h2>
              <p className="mt-1 text-white/50">Choose the level that best describes you</p>
            </div>
            <div className="space-y-3">
              {LEVEL_OPTIONS.map(l => {
                const sel = form.level === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => set({ level: l.id, placement_test_taken: false })}
                    className={`w-full flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                      sel ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/5 hover:border-accent/40'
                    }`}
                  >
                    <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 ${sel ? 'border-accent bg-accent' : 'border-white/30'}`} />
                    <div>
                      <p className={`font-semibold capitalize ${sel ? 'text-white' : 'text-white/70'}`}>{l.label}</p>
                      <p className="text-sm text-white/40 mt-0.5">{l.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium text-white/70">
                Want a more accurate level? Take our 10-question placement test. <span className="text-white/40">(optional)</span>
              </p>
              {form.placement_test_taken ? (
                <p className="mt-2 text-sm text-green-400">
                  ✓ Test complete — score: {form.test_score}% → {form.level}
                </p>
              ) : !showTest ? (
                <button
                  type="button"
                  onClick={() => setShowTest(true)}
                  className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                >
                  Take Placement Test
                </button>
              ) : (
                <PlacementTest
                  onComplete={(score, level) => {
                    set({ placement_test_taken: true, test_score: score, level });
                    setShowTest(false);
                  }}
                />
              )}
            </div>
          </div>
        );

      // ---- STEP 3: Deadline ----
      case 3: {
        const hasIelts = form.study_goals.includes('ielts');
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + 28);
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">When do you want to achieve this?</h2>
              <p className="mt-1 text-white/50">Set a target date to help us pace your learning</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/60">Target date</label>
              <input
                type="date"
                value={form.deadline_date}
                min={minDate.toISOString().split('T')[0]}
                onChange={e => set({ deadline_date: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white [color-scheme:dark] focus:border-accent focus:outline-none"
              />
            </div>

            {hasIelts && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Target IELTS score</span>
                  <span className="font-bold text-accent">{form.target_score}</span>
                </div>
                <input
                  type="range" min={5} max={9} step={0.5}
                  value={form.target_score}
                  onChange={e => set({ target_score: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-white/30">
                  <span>5.0 (basic)</span>
                  <span>7.0 (proficient)</span>
                  <span>9.0 (native)</span>
                </div>
              </div>
            )}

            {pace && (
              <div className={`rounded-xl border p-4 ${pace.feasible ? 'border-green-500/40 bg-green-500/10' : 'border-yellow-500/40 bg-yellow-500/10'}`}>
                <p className="text-sm font-medium text-white/70">Required pace</p>
                <p className="text-3xl font-bold text-white mt-1">{pace.hours_per_week} hrs<span className="text-base text-white/50">/week</span></p>
                <p className="text-xs text-white/40 mt-0.5">({pace.hours_per_day} hrs/day)</p>
                {!pace.feasible && <p className="mt-2 text-xs text-yellow-400">⚠️ Very ambitious — consider extending your deadline</p>}
              </div>
            )}
          </div>
        );
      }

      // ---- STEP 4: Time commitment ----
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">How much time can you commit?</h2>
              <p className="mt-1 text-white/50">Per week — we&apos;ll build a schedule around this</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TIME_COMMITMENT.map(h => {
                const sel = form.weekly_hours === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => set({ weekly_hours: h })}
                    className={`rounded-xl border py-5 text-center transition-all ${
                      sel ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/5 hover:border-accent/40'
                    }`}
                  >
                    <p className={`text-2xl font-bold ${sel ? 'text-accent' : 'text-white'}`}>{h}</p>
                    <p className="text-xs text-white/40 mt-1">hours / week</p>
                  </button>
                );
              })}
            </div>

            <div>
              <p className="text-sm font-medium text-white/60 mb-3">Preferred study times <span className="text-white/30">(optional)</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STUDY_TIMES.map(t => {
                  const sel = form.preferred_times.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleArr('preferred_times', t.id)}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                        sel ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/5 hover:border-accent/40'
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <div>
                        <p className={`text-sm font-medium ${sel ? 'text-white' : 'text-white/70'}`}>{t.label}</p>
                        <p className="text-xs text-white/30">{t.time}</p>
                      </div>
                      {sel && <span className="ml-auto text-accent text-sm">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      // ---- STEP 5: Learning styles ----
      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">How do you prefer to learn?</h2>
              <p className="mt-1 text-white/50">Select 2–3 styles that resonate with you</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LEARNING_STYLES.map(s => {
                const sel = form.learning_styles.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const arr = form.learning_styles;
                      if (arr.includes(s.id)) {
                        set({ learning_styles: arr.filter(x => x !== s.id) });
                      } else if (arr.length < 4) {
                        set({ learning_styles: [...arr, s.id] });
                      }
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                      sel ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/5 hover:border-accent/40'
                    }`}
                  >
                    <span className="text-2xl">{s.icon}</span>
                    <div>
                      <p className={`font-medium text-sm ${sel ? 'text-white' : 'text-white/70'}`}>{s.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{s.desc}</p>
                    </div>
                    {sel && <span className="ml-auto text-accent flex-shrink-0">✓</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-white/30">{form.learning_styles.length}/4 selected (min 2)</p>
          </div>
        );

      // ---- STEP 6: Review ----
      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Your Learning Profile</h2>
              <p className="mt-1 text-white/50">Review your choices before we build your path</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/10">
              {[
                { icon: '🎯', label: 'Goals',           value: form.study_goals.map(g => GOAL_LABEL[g] || g).join(', ') || '—' },
                { icon: '📊', label: 'Level',           value: form.level.charAt(0).toUpperCase() + form.level.slice(1) },
                { icon: '📅', label: 'Target date',     value: form.deadline_date || '—' },
                { icon: '⏱️', label: 'Time/week',       value: `${form.weekly_hours} hours` },
                { icon: '💡', label: 'Learning styles', value: form.learning_styles.join(', ') || '—' },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3 px-5 py-4">
                  <span className="text-xl w-7 flex-shrink-0">{row.icon}</span>
                  <span className="text-sm text-white/50 w-28 flex-shrink-0">{row.label}</span>
                  <span className="text-sm font-medium text-white capitalize">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-5 text-center">
              <p className="text-lg font-bold text-white">You&apos;re all set! 🚀</p>
              <p className="text-sm text-white/50 mt-1">Click below and we&apos;ll recommend the perfect learning path for you.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // -----------------------------------------------------------------------
  // Page frame
  // -----------------------------------------------------------------------
  return (
    <>
      <Head>
        <title>Set up your profile — LearnPath AI</title>
      </Head>

      <div className="min-h-screen bg-background flex flex-col items-center justify-start px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white text-sm font-bold">L</span>
          </div>
          <span className="text-white font-semibold text-lg">LearnPath AI</span>
        </div>

        <div className="w-full max-w-xl">
          <div className="mb-8">
            <ProgressBar current={step} total={TOTAL} />
          </div>

          {/* Step content */}
          <div className="rounded-2xl border border-white/10 bg-surface-elevated p-6 sm:p-8">
            {renderStep()}

            {error && (
              <p className="mt-4 rounded-lg bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-8 flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => { setStep(s => s - 1); setError(''); }}
                  className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={saveStep}
                disabled={loading}
                className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving…' : step === TOTAL ? '🚀 Create My Path' : 'Next →'}
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-white/25">
            Your answers personalise your path — they can be updated any time in Settings.
          </p>
        </div>
      </div>
    </>
  );
}
