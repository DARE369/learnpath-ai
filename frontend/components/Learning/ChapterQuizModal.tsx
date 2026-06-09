import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, ChevronRight, Trophy } from 'lucide-react';
import type { QuizQuestion } from './ChaptersList';

interface Props {
  chunkId: string;
  chapterTitle: string;
  questions: QuizQuestion[];
  accessToken: string | null;
  onClose: () => void;
  onComplete: (scorePercent: number) => void;
}

type AnswerState = 'idle' | 'correct' | 'wrong';

export default function ChapterQuizModal({
  chunkId,
  chapterTitle,
  questions,
  accessToken,
  onClose,
  onComplete,
}: Props) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const validQuestions = questions.filter(
    (q) => q.question_text && q.options?.length > 0
  );

  const current = validQuestions[qIndex];
  const total = validQuestions.length;

  const authHeaders: Record<string, string> = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};

  const saveScore = useCallback(
    (score: number) => {
      fetch(`/api/chunks/detail/${chunkId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ watched_seconds: 0, quiz_score: score }),
      }).catch(() => {});
    },
    [chunkId, accessToken], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleSelect = (optIdx: number) => {
    if (answerState !== 'idle') return;
    const opt = current.options[optIdx];
    const isCorrect = opt.correct;
    setSelected(optIdx);
    setAnswerState(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setCorrectCount((n) => n + 1);
  };

  const handleNext = () => {
    if (qIndex < total - 1) {
      setQIndex((i) => i + 1);
      setSelected(null);
      setAnswerState('idle');
    } else {
      const finalPct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      saveScore(finalPct);
      setDone(true);
    }
  };

  // Recalculate score at done screen properly
  const finalPct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  if (!total) {
    // No valid questions — skip straight through
    onComplete(100);
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="min-w-0">
            <p className="text-xs text-white/30 uppercase tracking-wider">Chapter quiz</p>
            <h2 className="text-sm font-semibold text-white truncate">{chapterTitle}</h2>
          </div>
          {!done && (
            <span className="text-xs text-white/30 bg-white/5 px-2.5 py-1 rounded-full flex-shrink-0">
              {qIndex + 1} / {total}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!done && (
          <div className="h-0.5 bg-white/5">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${((qIndex + (answerState !== 'idle' ? 1 : 0)) / total) * 100}%` }}
            />
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">
          {done ? (
            // ── Result screen ──────────────────────────────────────────────
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                finalPct >= 50 ? 'bg-emerald-500/20' : 'bg-red-500/20'
              }`}>
                <Trophy className={`w-8 h-8 ${finalPct >= 50 ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{finalPct}%</p>
                <p className="text-sm text-white/50 mt-1">
                  {correctCount} of {total} correct
                </p>
              </div>
              <p className="text-sm text-white/40">
                {finalPct >= 80
                  ? 'Excellent work! Ready for the next chapter.'
                  : finalPct >= 50
                  ? 'Good effort. Keep watching to solidify this.'
                  : 'Review the chapter summary if anything is unclear.'}
              </p>
              <div className="flex items-center gap-3 mt-2 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors"
                >
                  Stay here
                </button>
                <button
                  type="button"
                  onClick={() => onComplete(finalPct)}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-white transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  Next chapter <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            // ── Question screen ────────────────────────────────────────────
            <div className="flex flex-col gap-4">
              <p className="text-base font-medium text-white leading-snug">
                {current.question_text}
              </p>

              <div className="flex flex-col gap-2">
                {current.options.map((opt, i) => {
                  const isSelected = selected === i;
                  const reveal = answerState !== 'idle';
                  let cls =
                    'w-full text-left rounded-xl border px-4 py-3 text-sm transition-all ';
                  if (!reveal) {
                    cls +=
                      'border-white/10 bg-white/[0.03] text-white/80 hover:border-indigo-500/40 hover:bg-indigo-500/5 cursor-pointer';
                  } else if (opt.correct) {
                    cls += 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300';
                  } else if (isSelected && !opt.correct) {
                    cls += 'border-red-500/50 bg-red-500/10 text-red-300';
                  } else {
                    cls += 'border-white/5 bg-white/[0.02] text-white/30';
                  }

                  return (
                    <button
                      key={i}
                      type="button"
                      className={cls}
                      onClick={() => handleSelect(i)}
                      disabled={reveal}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full border border-current/30 text-xs flex items-center justify-center font-medium">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span>{opt.text}</span>
                        {reveal && opt.correct && (
                          <CheckCircle className="ml-auto h-4 w-4 text-emerald-400 flex-shrink-0" />
                        )}
                        {reveal && isSelected && !opt.correct && (
                          <XCircle className="ml-auto h-4 w-4 text-red-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {answerState !== 'idle' && current.explanation && (
                <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  answerState === 'correct'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200/80'
                    : 'bg-red-500/10 border border-red-500/20 text-red-200/80'
                }`}>
                  {current.explanation}
                </div>
              )}

              {/* Next / Skip */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-white/25 hover:text-white/50 transition-colors"
                >
                  Skip quiz
                </button>
                {answerState !== 'idle' && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition-colors"
                  >
                    {qIndex < total - 1 ? 'Next' : 'Finish'}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
