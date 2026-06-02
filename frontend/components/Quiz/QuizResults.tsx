'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, BarChart3, CheckCircle, AlertCircle } from 'lucide-react';

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

  const getPerformanceEmoji = (level: string) => {
    switch (level) {
      case 'expert':
        return '⭐';
      case 'above_average':
        return '👏';
      case 'average':
        return '💪';
      default:
        return '📚';
    }
  };

  return (
    <div className="quiz-results w-full max-w-4xl mx-auto space-y-6">
      {/* Main Score Card */}
      <Card className={`border-2 ${getPerformanceBg(results.performance_level)}`}>
        <CardHeader>
          <CardTitle className="text-center">Quiz Complete!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <span className="text-6xl">{getPerformanceEmoji(results.performance_level)}</span>
            <div>
              <div className={`text-6xl font-bold ${getPerformanceColor(results.performance_level)}`}>
                {results.score_percent}%
              </div>
              <div className={`text-xl font-semibold ${getPerformanceColor(results.performance_level)}`}>
                {results.performance_level.replace('_', ' ').toUpperCase()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-sm text-gray-600 mb-1">Score</div>
              <div className="text-2xl font-bold text-gray-900">
                {results.correct_answers}/{results.total_questions}
              </div>
              <div className="text-xs text-gray-500 mt-1">correct</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <BarChart3 className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <div className="text-sm text-gray-600 mb-1">Your Rank</div>
              <div className="text-2xl font-bold text-gray-900">
                {results.percentile}%
              </div>
              <div className="text-xs text-gray-500 mt-1">of learners</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl mb-2">⏱️</div>
              <div className="text-sm text-gray-600 mb-1">Time Spent</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatTime(results.time_spent_seconds)}
              </div>
              <div className="text-xs text-gray-500 mt-1">total</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Concept Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weak Concepts */}
        {results.weak_concepts.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                Focus Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {results.weak_concepts.map((concept) => (
                  <div
                    key={concept}
                    className="p-3 bg-white rounded border border-red-200 text-sm text-gray-700"
                  >
                    📖 {concept}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Strong Concepts */}
        {results.strong_concepts.length > 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                Mastered Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {results.strong_concepts.map((concept) => (
                  <div
                    key={concept}
                    className="p-3 bg-white rounded border border-green-200 text-sm text-gray-700"
                  >
                    ⭐ {concept}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recommendation */}
      <Card className="border-indigo-200 bg-indigo-50">
        <CardHeader>
          <CardTitle className="text-indigo-700">Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">{results.recommendation}</p>
          {results.next_actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {results.next_actions.map((action, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="gap-2"
                >
                  {action.type === 'review' ? '📚 Review' : '🚀 Advance'}
                  {action.concept && ` ${action.concept}`}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          onClick={onClose}
          className="h-12 text-base gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          Continue Learning
        </Button>
        <Button
          variant="outline"
          className="h-12 text-base"
        >
          📊 View Detailed Analytics
        </Button>
      </div>
    </div>
  );
}
