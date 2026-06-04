'use client';

import React from 'react';
import QuizInterface from './QuizInterface';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId?: string;
  topicName?: string;
  concept?: string;
  onComplete?: (scorePercent: number) => void;
}

export default function QuizModal({ isOpen, onClose, topicId, topicName, concept, onComplete }: QuizModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {topicName ? `${topicName} - Knowledge Check` : 'Knowledge Check'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quiz"
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="p-6">
          <QuizInterface topicId={topicId} concept={concept} onClose={onClose} onComplete={onComplete} />
        </div>
      </div>
    </div>
  );
}
