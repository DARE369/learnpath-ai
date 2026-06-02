'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';

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
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleSelect = (optionId: string) => {
    if (!submitted && !disabled) {
      setSelectedAnswer(optionId);
    }
  };

  const handleSubmit = () => {
    if (!selectedAnswer) return;

    // For now, we'll just check client-side
    // In a real implementation, this would call the API
    setSubmitted(true);

    // Determine correctness (this is a mock - real implementation would use the correct_answer_id)
    // For now, we'll just allow the user to see their selection
    onAnswer?.(selectedAnswer, true);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">{question.text}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {question.options.map((option) => (
            <button
              key={option.id}
              className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                selectedAnswer === option.id
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-400'
              } ${disabled || submitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => handleSelect(option.id)}
              disabled={disabled || submitted}
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg ${
                  selectedAnswer === option.id ? 'text-indigo-600' : 'text-gray-400'
                }`}>
                  {selectedAnswer === option.id ? '◉' : '○'}
                </span>
                <span className="text-gray-900">{option.text}</span>
              </div>
            </button>
          ))}
        </div>

        {!submitted && (
          <Button
            onClick={handleSubmit}
            disabled={!selectedAnswer || disabled}
            className="w-full"
          >
            Check Answer
          </Button>
        )}

        {submitted && selectedAnswer && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">
              {isCorrect ? (
                <span className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  Great job!
                </span>
              ) : (
                <span className="flex items-center gap-2 text-red-700">
                  <XCircle className="w-5 h-5" />
                  Not quite, try again!
                </span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
