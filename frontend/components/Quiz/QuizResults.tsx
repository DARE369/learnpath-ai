'use client';

import React from 'react';
import { Star, ThumbsUp, TrendingUp, BookOpen, Check, BarChart3, Clock, AlertTriangle, Rocket, ArrowRight } from 'lucide-react';

interface QuizResultsProps {
  results: {
    session_id: string;
    score_percent: number;
    correct_answers: number;
    total_questions: number;
    performance_level: string;
    weak_concepts: string[];
    strong_concepts: string[];
    recommendation: string;
    percentile: number;
    time_spent_seconds: number;
    next_actions: Array<{ type: string; concept?: string; message?: string }>;
  };
  onClose: () => void;
}

export default function QuizResults({ results, onClose }: QuizResultsProps) {
  const getPerformanceColor = (level: string) => {
    switch (level) {
      case 'expert':
        return 'text-green-600';
      case 'above_average':
        return 'text-blue-600';
      case 'average':
        return 'text-yellow-600';
      default:
        return 'text-red-600';
    }
  };

  const getPerformanceBg = (level: string) => {
    switch (level) {
      case 'expert':
        return 'bg-green-50';
      case 'above_average':
        return 'bg-blue-50';
      case 'average':
        return 'bg-yellow-50';
      default:
        return 'bg-red-50';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getPerformanceIcon = (level: string): React.ComponentType<{ className?: string }> => {
    switch (level) {
      case 'expert':
        return Star;
      case 'above_average':
        return ThumbsUp;
      case 'average':
        return TrendingUp;
      default:
        return BookOpen;
    }
  };
  const PerfIcon = getPerformanceIcon(results.performance_level);

  return (
    <div className="quiz-results mx-auto w-full max-w-4xl space-y-6">
      {/* Main Score Card */}
      <div className={`rounded-xl border-2 shadow-sm ${getPerformanceBg(results.performance_level)}`}>
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-center text-lg font-semibold text-white">Quiz Complete!</h2>
        </div>
        <div className="space-y-4 p-6 text-center">
          <div className="flex items-center justify-center gap-4">
            <PerfIcon className={`h-14 w-14 ${getPerformanceColor(results.performance_level)}`} />
            <div>
              <div className={`text-6xl font-bold ${getPerformanceColor(results.performance_level)}`}>
                {results.score_percent}%
              </div>
              <div className={`text-xl font-semibold ${getPerformanceColor(results.performance_level)}`}>
                {results.performance_level.replace('_', ' ').toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm">
          <div className="text-center">
            <Check className="mx-auto mb-2 h-6 w-6 text-green-600" />
            <div className="mb-1 text-sm text-white/60">Score</div>
            <div className="text-2xl font-bold text-white">
              {results.correct_answers}/{results.total_questions}
            </div>
            <div className="mt-1 text-xs text-white/50">correct</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm">
          <div className="text-center">
            <BarChart3 className="mx-auto mb-2 h-6 w-6 text-indigo-600" />
            <div className="mb-1 text-sm text-white/60">Your Rank</div>
            <div className="text-2xl font-bold text-white">{results.percentile}%</div>
            <div className="mt-1 text-xs text-white/50">of learners</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm">
          <div className="text-center">
            <Clock className="mx-auto mb-2 h-6 w-6 text-white/80" />
            <div className="mb-1 text-sm text-white/60">Time Spent</div>
            <div className="text-2xl font-bold text-white">
              {formatTime(results.time_spent_seconds)}
            </div>
            <div className="mt-1 text-xs text-white/50">total</div>
          </div>
        </div>
      </div>

      {/* Concept Analysis */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Weak Concepts */}
        {results.weak_concepts.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 shadow-sm">
            <div className="border-b border-red-100 px-6 py-4">
              <h3 className="flex items-center gap-2 font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4" />
                Focus Areas
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {results.weak_concepts.map((concept) => (
                  <div
                    key={concept}
                    className="flex items-center gap-2 rounded border border-red-200 bg-surface-elevated p-3 text-sm text-white/80"
                  >
                    <BookOpen className="h-4 w-4 text-red-500" /> {concept}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Strong Concepts */}
        {results.strong_concepts.length > 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 shadow-sm">
            <div className="border-b border-green-100 px-6 py-4">
              <h3 className="flex items-center gap-2 font-semibold text-green-700">
                <Check className="h-4 w-4" />
                Mastered Topics
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {results.strong_concepts.map((concept) => (
                  <div
                    key={concept}
                    className="flex items-center gap-2 rounded border border-green-200 bg-surface-elevated p-3 text-sm text-white/80"
                  >
                    <Star className="h-4 w-4 text-green-500" /> {concept}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recommendation */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 shadow-sm">
        <div className="border-b border-indigo-100 px-6 py-4">
          <h3 className="font-semibold text-indigo-700">Next Steps</h3>
        </div>
        <div className="p-6">
          <p className="mb-4 text-white/80">{results.recommendation}</p>
          {results.next_actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {results.next_actions.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-background"
                >
                  {action.type === 'review' ? <BookOpen className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
                  {action.type === 'review' ? 'Review' : 'Advance'}
                  {action.concept && ` ${action.concept}`}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-indigo-600 text-base font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <ArrowRight className="h-4 w-4" />
          Continue Learning
        </button>
        <button
          type="button"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated text-base font-medium text-white/80 transition-colors hover:bg-background"
        >
          <BarChart3 className="h-4 w-4" /> View Detailed Analytics
        </button>
      </div>
    </div>
  );
}
