"use client";
import React, { useState } from "react";
import FeedbackCard from "./FeedbackCard";

interface FeedbackState {
  score: number;
  isCorrect: boolean;
  explanation: string;
  feedback: string;
  keyInsight: string;
}

interface QuestionCardProps {
  sessionId: string | null;
  question: string;
  questionType: "free_text" | "multiple_choice";
  options?: string[];
  correctAnswer: string;
  difficulty: string;
  estimatedTime?: number;
  conceptName?: string;
  topicId?: string;
  onAnswerSubmit: (score: number, feedback: string) => void;
  onSkip?: () => void;
}

const CONFIDENCE_LABELS = ["Not sure", "Slight idea", "Fairly sure", "Confident", "Very sure"];

function ConfidenceStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {CONFIDENCE_LABELS.map((label, i) => {
        const filled = i < value;
        return (
          <button
            key={i}
            onClick={() => onChange(i + 1)}
            title={label}
            className="group relative"
          >
            <svg
              className={`w-5 h-5 transition-colors ${filled ? "text-amber-400" : "text-white/20 hover:text-white/40"}`}
              fill={filled ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-1 text-xs text-white/30">{CONFIDENCE_LABELS[value - 1]}</span>
      )}
    </div>
  );
}

export default function QuestionCard({
  sessionId,
  question,
  questionType,
  options,
  correctAnswer,
  difficulty,
  estimatedTime,
  conceptName,
  topicId,
  onAnswerSubmit,
  onSkip,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<FeedbackState | null>(null);

  const studentAnswer =
    questionType === "multiple_choice" && selectedOption !== null
      ? options?.[selectedOption] ?? ""
      : answer;

  const canSubmit = studentAnswer.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/questions/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          correct_answer: correctAnswer,
          student_answer: studentAnswer.trim(),
          difficulty,
          ...(conceptName ? { concept_name: conceptName } : {}),
          ...(topicId ? { topic_id: topicId } : {}),
        }),
      });
      if (!res.ok) throw new Error("Evaluation failed");
      const data = await res.json();
      setFeedbackState({
        score: data.score ?? 0,
        isCorrect: data.is_correct ?? false,
        explanation: data.explanation ?? "",
        feedback: data.feedback ?? "",
        keyInsight: data.key_insight ?? "",
      });
    } catch {
      setError("Couldn't evaluate your answer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (feedbackState) {
    return (
      <FeedbackCard
        score={feedbackState.score}
        isCorrect={feedbackState.isCorrect}
        explanation={feedbackState.explanation}
        feedback={feedbackState.feedback}
        keyInsight={feedbackState.keyInsight}
        onContinue={() => onAnswerSubmit(feedbackState.score, feedbackState.feedback)}
      />
    );
  }

  return (
    <div className="bg-[#1c1c1c] rounded-2xl border border-indigo-500/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Comprehension Check</span>
        </div>
        <div className="flex items-center gap-3">
          {estimatedTime && (
            <span className="text-xs text-white/25">{Math.ceil(estimatedTime / 60)} min</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            difficulty === "easy"
              ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
              : difficulty === "hard"
              ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
              : "text-amber-400 border-amber-500/30 bg-amber-500/10"
          }`}>
            {difficulty}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Question */}
        <p className="text-base text-white/90 leading-relaxed font-medium">{question}</p>

        {/* Answer input */}
        {questionType === "multiple_choice" && options ? (
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setSelectedOption(i)}
                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  selectedOption === i
                    ? "border-indigo-500/60 bg-indigo-500/10 text-white"
                    : "border-white/[0.08] bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white/80"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                  selectedOption === i ? "border-indigo-400 bg-indigo-400" : "border-white/30"
                }`} />
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here…"
            rows={4}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors leading-relaxed"
          />
        )}

        {/* Confidence */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30 whitespace-nowrap">Confidence:</span>
          <ConfidenceStars value={confidence} onChange={setConfidence} />
        </div>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Evaluating…
              </>
            ) : (
              "Submit Answer"
            )}
          </button>
          {onSkip && (
            <button onClick={onSkip} className="text-sm text-white/25 hover:text-white/50 transition-colors">
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
