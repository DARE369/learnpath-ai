'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import QuizInterface from './QuizInterface';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId?: string;
  topicName?: string;
}

export default function QuizModal({ isOpen, onClose, topicId, topicName }: QuizModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {topicName ? `${topicName} - Knowledge Check` : 'Knowledge Check'}
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogHeader>
        <QuizInterface topicId={topicId} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
