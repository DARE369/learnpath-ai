import json
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import anthropic

from config import settings

logger = logging.getLogger(__name__)

# Spaced repetition intervals (days)
_CORRECT_INTERVALS = [3, 7, 30]
_INCORRECT_INTERVALS = [1, 3]


def _parse_json_response(text: str) -> dict:
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No valid JSON in Claude response")


class QuestionService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-sonnet-4-6"

    async def generate_question(
        self,
        video_summary: str,
        concept_name: str,
        difficulty: str = "medium",
    ) -> Dict:
        """Generate a comprehension question from a video summary."""
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")

        prompt = f"""Create a comprehension question testing understanding of {concept_name}.
Video summary: {video_summary[:3000]}

The question should:
1. Test conceptual understanding, not memorization
2. Be unanswerable by searching the transcript verbatim
3. Have one clearly correct answer
4. Be at {difficulty} difficulty for a motivated learner

Respond ONLY in this JSON format:
{{
  "question": "What is...",
  "type": "free_text",
  "correct_answer": "The full correct answer",
  "explanation": "Why this answer is correct",
  "difficulty": "{difficulty}",
  "estimated_time_seconds": 120
}}"""

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=self.model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        data = _parse_json_response(message.content[0].text)
        logger.info(f"Question generated for concept '{concept_name}' at {difficulty} difficulty")
        return {
            "question": data.get("question", ""),
            "type": data.get("type", "free_text"),
            "options": data.get("options"),
            "correct_answer": data.get("correct_answer", ""),
            "explanation": data.get("explanation", ""),
            "difficulty": data.get("difficulty", difficulty),
            "estimated_time_seconds": data.get("estimated_time_seconds", 120),
        }

    async def evaluate_answer(
        self,
        question: str,
        correct_answer: str,
        student_answer: str,
        difficulty: str = "medium",
    ) -> Dict:
        """Evaluate a student's answer using Claude and return scored feedback."""
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")

        prompt = f"""Grade this student answer. Be encouraging but accurate.

Question: {question}
Model answer: {correct_answer}
Student answer: {student_answer}
Difficulty: {difficulty}

Scoring:
- 80-100: correct or substantially correct
- 51-79: partially correct, missing key detail
- 0-50: incorrect or too vague

Respond ONLY in JSON:
{{
  "is_correct": true,
  "score": 85,
  "explanation": "Concise reason for this score",
  "feedback": "2-sentence encouraging message to the student",
  "next_difficulty": "harder",
  "key_insight": "The single most important thing to understand here"
}}

next_difficulty must be one of: easier, same, harder"""

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=self.model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        data = _parse_json_response(message.content[0].text)
        score = max(0, min(100, int(data.get("score", 0))))
        logger.info(f"Answer evaluated — score: {score}")
        return {
            "is_correct": bool(data.get("is_correct", score >= 80)),
            "score": score,
            "explanation": data.get("explanation", ""),
            "feedback": data.get("feedback", ""),
            "next_difficulty": data.get("next_difficulty", "same"),
            "key_insight": data.get("key_insight", ""),
        }

    def schedule_next_review(
        self,
        concept_name: str,
        is_correct: bool,
        times_reviewed: int,
    ) -> Dict:
        """Return spaced-repetition schedule for the next review of a concept."""
        schedule = _CORRECT_INTERVALS if is_correct else _INCORRECT_INTERVALS
        idx = min(times_reviewed, len(schedule) - 1)
        interval_days = schedule[idx]
        review_date = datetime.utcnow() + timedelta(days=interval_days)
        logger.info(f"Scheduled review of '{concept_name}' in {interval_days} days")
        return {
            "review_date": review_date.isoformat(),
            "interval_days": interval_days,
            "times_reviewed": times_reviewed + 1,
        }

    async def get_conceptual_explanation(self, answer: str, concept: str) -> str:
        """Generate a brief conceptual explanation tailored to the student's answer."""
        if not self.api_key:
            return f"The key to understanding {concept} lies in grasping its underlying principles and how it connects to broader ideas."

        prompt = f"""A student answered a question about '{concept}' with:
"{answer}"

Write 2-3 sentences that help them deepen their understanding. Be encouraging, non-judgmental, and focus on the concept — not on whether their answer was right or wrong."""

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=self.model,
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()


question_service = QuestionService()
