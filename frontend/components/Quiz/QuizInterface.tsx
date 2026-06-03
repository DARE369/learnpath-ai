'use client';

import React, { useState, useEffect, useCallback } from 'react';
import QuizResults from './QuizResults';

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
      : null;
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

interface Question {
  id: string;
  text: string;
  type: string;
  options: Array<{ text: string; id: string }>;
  concept: string;
}

interface Feedback {
  is_correct: boolean;
  explanation: string;
  explanation_for_choice: string;
  confidence_feedback: string;
  next_question_difficulty: string;
  ability_updated: number;
  quiz_complete?: boolean;
  results?: any;
  next_question?: Question;
  question_number?: number;
}

export default function QuizInterface({ sessionId, topicId, onClose }: {
  sessionId?: string;
  topicId?: string;
  onClose: () => void;
}) {
  const [currentSessionId, setCurrentSessionId] = useState(sessionId || null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [timeStarted, setTimeStarted] = useState<number>(Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizResults, setQuizResults] = useState<any>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(5);

  const startQuiz = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('quiz_type', 'section');
      if (topicId) params.append('topic_id', topicId);

      const response = await fetch(`/api/quiz/start?${params.toString()}`, {
        method: 'POST',
        headers: authHeaders(),
      });

      if (!response.ok) throw new Error('Failed to start quiz');
      const data = await response.json();

      setCurrentSessionId(data.session_id);
      setQuestion(data.question);
      setTotalQuestions(data.total_questions);
      setQuestionNumber(data.question_number);
      setTimeStarted(Date.now());
      setSelectedAnswer(null);
      setConfidence(5);
      setSubmitted(false);
      setFeedback(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error starting quiz');
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  // Start quiz on mount
  useEffect(() => {
    startQuiz();
  }, [startQuiz]);

  const handleSubmit = async () => {
    if (!selectedAnswer || !currentSessionId || !question) return;

    setLoading(true);
    setError(null);
    try {
      const timeSpent = Math.floor((Date.now() - timeStarted) / 1000);

      const response = await fetch(`/api/quiz/${currentSessionId}/answer`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          question_id: question.id,
          answer: selectedAnswer,
          confidence: confidence,
          time_spent: timeSpent
        })
      });

      if (!response.ok) throw new Error('Failed to submit answer');
      const result = await response.json();

      setFeedback(result);
      setSubmitted(true);

      if (result.quiz_complete) {
        // Quiz finished
        setQuizResults(result.results);
      } else if (result.next_question) {
        // Move to next question after delay
        setTimeout(() => {
          setQuestion(result.next_question);
          setSelectedAnswer(null);
          setConfidence(5);
          setSubmitted(false);
          setFeedback(null);
          setQuestionNumber(result.question_number);
          setTimeStarted(Date.now());
        }, 2500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting answer');
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  };

  if (quizResults) {
    return <QuizResults results={quizResults} onClose={onClose} />;
  }

  if (loading && !question) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-6 pb-6 pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500"></div>
              <p className="text-gray-600">Loading question...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-xl border-2 border-red-500 bg-white shadow-sm">
        <div className="px-6 pb-6 pt-6">
          <div className="mb-4 text-red-600">{error}</div>
          <button
            type="button"
            onClick={startQuiz}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="quiz-container mx-auto w-full max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Knowledge Check</h2>
            <div className="text-sm text-gray-600">
              Question {questionNumber} of {totalQuestions}
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-indigo-600 transition-all"
              style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* Question */}
          <div className="question-section">
            <p className="text-lg font-semibold text-gray-900 mb-6">{question.text}</p>

            {/* Options */}
            <div className="space-y-3">
              {question.options.map((option: any) => (
                <button
                  key={option.id}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    selectedAnswer === option.id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-indigo-400'
                  } ${submitted ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'} ${
                    submitted && option.correct && 'border-green-500 bg-green-50'
                  } ${
                    submitted && selectedAnswer === option.id && !option.correct
                      ? 'border-red-500 bg-red-50'
                      : ''
                  }`}
                  onClick={() => !submitted && setSelectedAnswer(option.id)}
                  disabled={submitted}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg ${
                      selectedAnswer === option.id ? 'text-indigo-600' : 'text-gray-400'
                    }`}>
                      {selectedAnswer === option.id ? '◉' : '○'}
                    </span>
                    <span className="text-gray-900">{option.text}</span>
                    {submitted && option.correct && <span className="ml-auto text-green-600">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Confidence Slider */}
          {!submitted && (
            <div className="confidence-section border-t pt-6">
              <label className="text-sm font-medium text-gray-700 mb-4 block">
                How confident are you in this answer?
              </label>
              <div className="flex items-center gap-4">
                <span className="w-16 text-xs text-gray-600">Not sure</span>
                <input
                  type="range"
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  min={1}
                  max={10}
                  step={1}
                  className="flex-1 accent-indigo-600"
                />
                <span className="w-16 text-right text-xs text-gray-600">Very sure</span>
              </div>
              <div className="text-center mt-2 text-sm font-semibold text-indigo-600">
                {confidence}/10
              </div>
            </div>
          )}

          {/* Feedback (shown after submit) */}
          {submitted && feedback && (
            <div className={`feedback-section border-t pt-6 ${
              feedback.is_correct ? 'bg-green-50' : 'bg-red-50'
            } p-4 rounded-lg`}>
              <h3 className={`text-lg font-semibold mb-2 ${
                feedback.is_correct ? 'text-green-700' : 'text-red-700'
              }`}>
                {feedback.is_correct ? '✓ Correct!' : '✗ Not quite'}
              </h3>
              <p className="text-gray-700 mb-3">{feedback.explanation}</p>

              <details className="mb-3">
                <summary className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  Why is this {feedback.is_correct ? 'right' : 'wrong'}?
                </summary>
                <p className="mt-2 text-gray-700 text-sm">{feedback.explanation_for_choice}</p>
              </details>

              {feedback.confidence_feedback && (
                <p className="text-sm text-gray-700 italic">
                  {feedback.confidence_feedback}
                </p>
              )}

              {feedback.quiz_complete ? (
                <p className="text-sm text-gray-700 mt-3">Quiz complete! Loading results...</p>
              ) : (
                <p className="text-sm text-gray-700 mt-3">Next question loading...</p>
              )}
            </div>
          )}

          {/* Submit Button */}
          {!submitted && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedAnswer || loading}
              className="h-12 w-full rounded-lg bg-indigo-600 text-base font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Answer'}
            </button>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Exit Quiz
          </button>
        </div>
      </div>
    </div>
  );
}
