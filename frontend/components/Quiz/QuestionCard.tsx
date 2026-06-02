'use client';

import React, { useState } from 'react';

interface QuestionCardProps {
  question: {
    id: string;
    text: string;
    type: string;
    options: Array<{ text: string; id: string }>;
    concept: string;
  };
  onAnswer?: (answerId: string, isCorrect: boolean) => void;
  disabled?: boolean;
}

export default function QuestionCard({ question, onAnswer, disabled = false }: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect] = useState<boolean | null>(null);

  const handleSelect = (optionId: string) => {
    if (!submitted && !disabled) {
      setSelectedAnswer(optionId);
    }
  };

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    setSubmitted(true);
    onAnswer?.(selectedAnswer, true);
  };

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">{question.text}</h3>
      </div>
      <div className="space-y-4 p-6">
        <div className="space-y-3">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                selectedAnswer === option.id
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-400'
              } ${disabled || submitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => handleSelect(option.id)}
              disabled={disabled || submitted}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-lg ${
                    selectedAnswer === option.id ? 'text-indigo-600' : 'text-gray-400'
                  }`}
                >
                  {selectedAnswer === option.id ? '◉' : '○'}
                </span>
                <span className="text-gray-900">{option.text}</span>
              </div>
            </button>
          ))}
        </div>

        {!submitted && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedAnswer || disabled}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check Answer
          </button>
        )}

        {submitted && selectedAnswer && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-gray-700">
              {isCorrect ? (
                <span className="flex items-center gap-2 text-green-700">
                  <span>✓</span>
                  Great job!
                </span>
              ) : (
                <span className="flex items-center gap-2 text-red-700">
                  <span>✗</span>
                  Not quite, try again!
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
