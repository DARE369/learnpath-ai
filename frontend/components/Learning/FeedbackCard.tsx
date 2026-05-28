"use client";
import React from "react";

interface FeedbackCardProps {
  score: number;
  isCorrect: boolean;
  explanation: string;
  feedback: string;
  keyInsight: string;
  onContinue: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 51 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <span className="text-2xl font-bold" style={{ color }}>{score}%</span>
    </div>
  );
}

export default function FeedbackCard({
  score,
  isCorrect,
  explanation,
  feedback,
  keyInsight,
  onContinue,
}: FeedbackCardProps) {
  const tier =
    score >= 80 ? "correct" : score >= 51 ? "partial" : "incorrect";

  const tierConfig = {
    correct: {
      label: "Great answer!",
      labelColor: "text-emerald-400",
      badgeBg: "bg-emerald-500/10 border-emerald-500/20",
      icon: (
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    partial: {
      label: "Almost there!",
      labelColor: "text-amber-400",
      badgeBg: "bg-amber-500/10 border-amber-500/20",
      icon: (
        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        </svg>
      ),
    },
    incorrect: {
      label: "Keep going!",
      labelColor: "text-rose-400",
      badgeBg: "bg-rose-500/10 border-rose-500/20",
      icon: (
        <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
  };

  const cfg = tierConfig[tier];

  return (
    <div className="bg-[#1c1c1c] rounded-2xl border border-white/[0.06] overflow-hidden">
      {/* Score header */}
      <div className="flex items-center gap-6 p-6 border-b border-white/[0.06]">
        <ScoreRing score={score} />
        <div className="flex-1 min-w-0">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${cfg.badgeBg} ${cfg.labelColor} mb-2`}>
            {cfg.icon}
            {cfg.label}
          </div>
          <p className="text-sm text-white/60 leading-relaxed line-clamp-3">{explanation}</p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4">
        {/* Encouragement */}
        {feedback && (
          <p className="text-sm text-white/50 leading-relaxed">{feedback}</p>
        )}

        {/* Key insight */}
        {keyInsight && (
          <div className="flex gap-3 p-3.5 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/20">
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a7 7 0 015.293 11.586l-.879 1.17A3 3 0 0114 17v1a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1a3 3 0 00-2.414-2.244l-.879-1.17A7 7 0 0112 2zm0 18a1 1 0 110 2 1 1 0 010-2z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-400 mb-0.5">Key insight</p>
              <p className="text-sm text-white/70 leading-relaxed">{keyInsight}</p>
            </div>
          </div>
        )}

        {/* Continue */}
        <button
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          Continue
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
