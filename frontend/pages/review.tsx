'use client';
import { PartyPopper, Check, X } from 'lucide-react';

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      : null;
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

interface Option { id: string; text: string; }
interface ReviewCard {
  card_id: string;
  card_type?: 'quiz' | 'flashcard';
  state: string;
  reps: number;
  lapses: number;
  question?: { id: string; text: string; type: string; options: Option[]; concept: string };
  flashcard?: { front: string; back: string; concept: string };
}
interface ReviewFeedback {
  is_correct: boolean;
  next_due_days: number;
  state: string;
  explanation?: string;
  correct_answer_id?: string;
  back?: string;
}

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<ReviewFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const fetchDue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quiz/review/due', { headers: authHeaders() });
      const data = await res.json();
      setCards(data.cards || []);
      setIndex(0);
      setSelected(null);
      setFeedback(null);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDue(); }, [fetchDue]);

  const card = cards[index];
  const isFlashcard = card?.card_type === 'flashcard';

  const submitAnswer = async (answer: string) => {
    if (!card) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quiz/review/${card.card_id}/answer`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ answer }),
      });
      const data = await res.json();
      setFeedback(data);
      setReviewedCount((n) => n + 1);
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setSelected(null);
    setRevealed(false);
    setFeedback(null);
    setIndex((i) => i + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allDone = !card;

  return (
    <>
      <Head><title>Review — LearnPath AI</title></Head>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Spaced Repetition Review</h1>
            <p className="text-white/50 mt-1 text-sm">
              Questions you missed resurface here at the optimal time to lock them into memory.
            </p>
          </div>

          {allDone ? (
            <div className="bg-surface-elevated border border-border rounded-2xl p-10 text-center">
              <PartyPopper className="mx-auto mb-4 h-12 w-12 text-accent-light" />
              <h2 className="text-xl font-semibold text-white">
                {reviewedCount > 0 ? 'Review complete!' : "You're all caught up"}
              </h2>
              <p className="text-white/50 mt-2">
                {reviewedCount > 0
                  ? `You reviewed ${reviewedCount} card${reviewedCount === 1 ? '' : 's'}. Come back when more are due.`
                  : 'No cards are due right now. Missed quiz questions will appear here over time.'}
              </p>
              <div className="flex gap-3 justify-center mt-6">
                <button onClick={fetchDue} className="px-4 py-2 bg-surface border border-border rounded-lg text-white/70 hover:text-white transition">
                  Refresh
                </button>
                <Link href="/dashboard" className="px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition">
                  Back to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-surface-elevated border border-border rounded-2xl p-6">
              <div className="flex justify-between text-xs text-white/40 mb-4">
                <span>Card {index + 1} of {cards.length}</span>
                <span className="capitalize">{card.state} · {card.lapses} lapse{card.lapses === 1 ? '' : 's'}</span>
              </div>

              {isFlashcard ? (
                /* ── Flashcard: flip + self-grade ── */
                <>
                  <p className="text-lg text-white font-medium mb-4">{card.flashcard?.front}</p>
                  {(revealed || feedback) && (
                    <div className="rounded-xl border border-border bg-surface p-4 mb-2">
                      <p className="text-white/80 text-sm">{card.flashcard?.back}</p>
                    </div>
                  )}
                  {feedback && (
                    <p className="text-white/40 text-xs mt-2">
                      {feedback.is_correct ? 'Nice recall.' : 'Keep at it.'} Next review in{' '}
                      {feedback.next_due_days} day{feedback.next_due_days === 1 ? '' : 's'}.
                    </p>
                  )}
                  <div className="mt-6">
                    {feedback ? (
                      <button onClick={handleNext} className="w-full px-4 py-3 bg-accent text-white rounded-xl font-medium hover:opacity-90 transition">
                        {index + 1 < cards.length ? 'Next card' : 'Finish'}
                      </button>
                    ) : !revealed ? (
                      <button onClick={() => setRevealed(true)} className="w-full px-4 py-3 bg-surface border border-border text-white rounded-xl font-medium hover:border-white/20 transition">
                        Reveal answer
                      </button>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          onClick={() => submitAnswer('missed')}
                          disabled={submitting}
                          className="flex flex-1 items-center justify-center gap-1.5 px-4 py-3 bg-red-500/15 text-red-300 border border-red-500/40 rounded-xl font-medium hover:bg-red-500/25 transition disabled:opacity-50"
                        >
                          <X className="h-4 w-4" /> Missed it
                        </button>
                        <button
                          onClick={() => submitAnswer('got_it')}
                          disabled={submitting}
                          className="flex flex-1 items-center justify-center gap-1.5 px-4 py-3 bg-green-500/15 text-green-300 border border-green-500/40 rounded-xl font-medium hover:bg-green-500/25 transition disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" /> Got it
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ── Quiz question: multiple choice ── */
                <>
                  <p className="text-lg text-white font-medium mb-5">{card.question?.text}</p>

                  <div className="space-y-2.5">
                    {(card.question?.options || []).map((opt) => {
                      const isPicked = selected === opt.id;
                      const isAnswerCorrect = feedback && feedback.correct_answer_id === opt.id;
                      const isPickedWrong = feedback && isPicked && !feedback.is_correct;
                      return (
                        <button
                          key={opt.id}
                          disabled={!!feedback || submitting}
                          onClick={() => setSelected(opt.id)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                            isAnswerCorrect
                              ? 'border-green-500/60 bg-green-500/10 text-green-300'
                              : isPickedWrong
                              ? 'border-red-500/60 bg-red-500/10 text-red-300'
                              : isPicked
                              ? 'border-accent bg-accent/10 text-white'
                              : 'border-border bg-surface text-white/70 hover:text-white hover:border-white/20'
                          }`}
                        >
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>

                  {feedback && (
                    <div className={`mt-5 rounded-xl p-4 ${feedback.is_correct ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                      <p className={`flex items-center gap-1.5 font-semibold ${feedback.is_correct ? 'text-green-400' : 'text-red-400'}`}>
                        {feedback.is_correct ? <><Check className="h-4 w-4" /> Correct</> : <><X className="h-4 w-4" /> Not quite</>}
                      </p>
                      {feedback.explanation && <p className="text-white/70 text-sm mt-1.5">{feedback.explanation}</p>}
                      <p className="text-white/40 text-xs mt-2">
                        Next review in {feedback.next_due_days} day{feedback.next_due_days === 1 ? '' : 's'}.
                      </p>
                    </div>
                  )}

                  <div className="mt-6">
                    {feedback ? (
                      <button onClick={handleNext} className="w-full px-4 py-3 bg-accent text-white rounded-xl font-medium hover:opacity-90 transition">
                        {index + 1 < cards.length ? 'Next card' : 'Finish'}
                      </button>
                    ) : (
                      <button
                        onClick={() => selected && submitAnswer(selected)}
                        disabled={!selected || submitting}
                        className="w-full px-4 py-3 bg-accent text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Checking…' : 'Submit'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
