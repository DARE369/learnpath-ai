import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { Card } from "../ui-v2/primitives";
import { color, font } from "../ui-v2/tokens";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
}

interface Option { id: string; text: string; }
interface ReviewCard {
  card_id: string;
  card_type?: "quiz" | "flashcard";
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

const STATE_BADGE: Record<string, { bg: string; fg: string }> = {
  new: { bg: color.surfaceElevated, fg: color.textFaint },
  learning: { bg: color.warning.bg, fg: color.warning.fg },
  review: { bg: color.info.bg, fg: color.info.fg },
};

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
      const res = await fetch("/api/quiz/review/due", { headers: authHeaders() });
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
  const isFlashcard = card?.card_type === "flashcard";

  const submitAnswer = async (answer: string) => {
    if (!card) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quiz/review/${card.card_id}/answer`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ answer }) });
      const data = await res.json();
      setFeedback(data);
      setReviewedCount((n) => n + 1);
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => { setSelected(null); setRevealed(false); setFeedback(null); setIndex((i) => i + 1); };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const allDone = !card;
  const badge = card ? STATE_BADGE[card.state] || STATE_BADGE.new : STATE_BADGE.new;

  return (
    <>
      <Head><title>Review — LearnPath AI</title></Head>
      <div style={{ maxWidth: 640, margin: "0 auto", fontFamily: font.body }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 26, margin: "0 0 8px" }}>Review</h1>

        {!allDone && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, color: color.textFaint }}>{index + 1} of {cards.length} due today</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 100, background: badge.bg, color: badge.fg }}>{card.state}</span>
                {card.lapses > 0 && <span style={{ fontFamily: font.mono, fontSize: 11, color: color.danger.fg }}>{card.lapses} lapse{card.lapses === 1 ? "" : "s"}</span>}
              </div>
            </div>
            <div style={{ height: 5, background: color.surfaceElevated, borderRadius: 100, marginBottom: 24, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round((index / cards.length) * 100)}%`, background: "#2B3A67", borderRadius: 100 }} />
            </div>
          </>
        )}

        {allDone ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              {reviewedCount > 0 ? "Review complete!" : "You're all caught up"}
            </div>
            <div style={{ fontSize: 14, color: color.textFaint, marginBottom: 20 }}>
              {reviewedCount > 0
                ? `You reviewed ${reviewedCount} card${reviewedCount === 1 ? "" : "s"}. Come back when more are due.`
                : "No cards are due right now. Missed quiz questions will appear here over time."}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={fetchDue} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${color.border}`, background: "#fff", color: color.ink, cursor: "pointer" }}>Refresh</button>
              <Link href="/dashboard" style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Back to Dashboard</Link>
            </div>
          </div>
        ) : isFlashcard ? (
          <>
            <div onClick={() => !revealed && setRevealed(true)} style={{ cursor: revealed ? "default" : "pointer" }}>
              <Card padding="lg" style={{ minHeight: 220, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontFamily: font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.textFaint, marginBottom: 14 }}>{card.flashcard?.concept}</div>
                <div style={{ fontFamily: font.display, fontWeight: 500, fontSize: 18, lineHeight: 1.4, marginBottom: 16 }}>{card.flashcard?.front}</div>
                {!revealed ? (
                  <div style={{ fontSize: 12.5, color: color.textFaint }}>Tap to reveal answer</div>
                ) : (
                  <div style={{ borderTop: `1px solid ${color.borderMuted}`, paddingTop: 16, width: "100%" }}>
                    <div style={{ fontSize: 15 }}>{card.flashcard?.back}</div>
                  </div>
                )}
              </Card>
            </div>
            {revealed && (
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => submitAnswer("missed")} disabled={submitting} style={{ flex: 1, padding: 14, fontSize: 14, fontWeight: 600, borderRadius: 9, border: `1px solid #E7B7AE`, background: color.danger.bg, color: color.danger.fg, cursor: "pointer" }}>1 · Didn&rsquo;t know it</button>
                <button onClick={() => submitAnswer("got_it")} disabled={submitting} style={{ flex: 1, padding: 14, fontSize: 14, fontWeight: 600, borderRadius: 9, border: `1px solid #A9D3C0`, background: color.success.bg, color: color.success.fg, cursor: "pointer" }}>2 · Got it</button>
              </div>
            )}
          </>
        ) : (
          <Card padding="lg" style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.textFaint, marginBottom: 16, textAlign: "center" }}>{card.question?.concept} · missed question</div>
            <div style={{ fontFamily: font.display, fontWeight: 500, fontSize: 19, lineHeight: 1.4, marginBottom: 22, textAlign: "center" }}>{card.question?.text}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {(card.question?.options || []).map((opt) => {
                const isPicked = selected === opt.id;
                const isAnswerCorrect = feedback && feedback.correct_answer_id === opt.id;
                const isPickedWrong = feedback && isPicked && !feedback.is_correct;
                const bg = isAnswerCorrect ? color.success.bg : isPickedWrong ? color.danger.bg : isPicked ? "#EFF1F7" : "#fff";
                const bd = isAnswerCorrect ? "#A9D3C0" : isPickedWrong ? "#E7B7AE" : isPicked ? "#2B3A67" : color.border;
                return (
                  <button key={opt.id} disabled={!!feedback || submitting} onClick={() => setSelected(opt.id)} style={{ textAlign: "left", padding: "12px 14px", fontSize: 13.5, borderRadius: 8, border: `1px solid ${bd}`, background: bg, color: color.ink, cursor: feedback ? "default" : "pointer" }}>
                    {opt.text}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {feedback && (
          <>
            <div style={{ borderRadius: 10, padding: "14px 16px", marginBottom: 14, background: feedback.is_correct ? color.success.bg : color.danger.bg, color: feedback.is_correct ? color.success.fg : color.danger.fg }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                {isFlashcard ? (feedback.is_correct ? "Got it — nice recall." : "That's okay — it'll come back around soon.") : feedback.is_correct ? "Correct" : "Not quite"}
              </div>
              {feedback.explanation && <div style={{ fontSize: 12.5, marginTop: 4 }}>{feedback.explanation}</div>}
              <div style={{ fontSize: 12.5, marginTop: 3 }}>Next review in {feedback.next_due_days} day{feedback.next_due_days === 1 ? "" : "s"}.</div>
            </div>
            <button onClick={handleNext} style={{ width: "100%", padding: 13, fontSize: 14, fontWeight: 600, borderRadius: 9, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>
              {index + 1 < cards.length ? "Continue" : "Finish"}
            </button>
          </>
        )}

        {!isFlashcard && !feedback && !allDone && (
          <button onClick={() => selected && submitAnswer(selected)} disabled={!selected || submitting} style={{ width: "100%", padding: 13, fontSize: 14, fontWeight: 600, borderRadius: 9, border: "none", background: selected ? "#2B3A67" : "#B7BDD1", color: "#fff", cursor: selected ? "pointer" : "not-allowed" }}>
            {submitting ? "Checking…" : "Submit"}
          </button>
        )}
      </div>
      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
