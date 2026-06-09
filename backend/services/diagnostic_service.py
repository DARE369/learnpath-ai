"""
Diagnostic Assessment Service.

Generates 10 multiple-choice questions covering a WAEC subject at a given SS
level, evaluates the user's answers, and maps results to weak/strong topics.
Questions are generated fresh by Claude so they are always varied.
"""

import json
import logging
import re
from typing import Dict, List, Optional

import anthropic

from config import settings
from services.curriculum_service import curriculum_service

logger = logging.getLogger(__name__)

QUESTION_COUNT = 10


class DiagnosticService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-haiku-4-5-20251001"   # Haiku: fast + cheap for diagnostics

    # ── Question generation ───────────────────────────────────────────────────

    async def generate_questions(
        self,
        db,
        subject_id: str,
        ss_level: str,
    ) -> List[Dict]:
        """
        Generate QUESTION_COUNT MCQs covering the subject at this SS level.
        Returns list of {id, topic_id, question, options, correct_index, explanation}.
        """
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")

        subject = curriculum_service.get_subject(db, subject_id)
        if not subject:
            raise ValueError(f"Unknown subject: {subject_id}")

        topic_list = curriculum_service.topics_as_prompt_list(db, subject_id, ss_level)

        prompt = f"""You are writing a diagnostic assessment for Nigerian WAEC {subject['name']} at {ss_level} level.

Generate exactly {QUESTION_COUNT} multiple-choice questions. Spread them across different topics so you test breadth, not just one area. Each question must:
- Be answerable by a Nigerian secondary school student studying for WAEC
- Have exactly 4 options labeled A, B, C, D
- Have one clearly correct answer
- Include a brief explanation of why the correct answer is right

CURRICULUM TOPICS FOR {ss_level} (use the topic IDs exactly as shown):
{topic_list}

Return ONLY valid JSON in this exact shape, no text outside the JSON:
{{
  "questions": [
    {{
      "topic_id": "exact-topic-id-from-list",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Brief explanation of the correct answer."
    }}
  ]
}}

correct_index is 0-based (0=A, 1=B, 2=C, 3=D). Vary difficulty: 3 easy, 4 medium, 3 hard."""

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=self.model,
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text
        questions = self._parse_questions(raw)
        # Tag each question with a sequential id
        for i, q in enumerate(questions):
            q["id"] = f"dq-{i}"
        logger.info(f"Generated {len(questions)} diagnostic questions for {subject_id} {ss_level}")
        return questions

    def _parse_questions(self, text: str) -> List[Dict]:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if not match:
            return []
        try:
            data = json.loads(match.group())
            qs = data.get("questions", [])
            valid = []
            for q in qs:
                if (
                    isinstance(q.get("question"), str)
                    and isinstance(q.get("options"), list)
                    and len(q["options"]) == 4
                    and isinstance(q.get("correct_index"), int)
                    and 0 <= q["correct_index"] <= 3
                ):
                    valid.append(q)
            return valid[:QUESTION_COUNT]
        except (json.JSONDecodeError, KeyError):
            return []

    # ── Result analysis ───────────────────────────────────────────────────────

    def analyze_results(
        self,
        questions: List[Dict],
        answers: List[int],       # list of selected option indices (0-3), -1 = skipped
    ) -> Dict:
        """
        Score the diagnostic and identify weak/strong topics.
        Returns:
          score_percent, correct, total, topic_scores, weak_topic_ids, strong_topic_ids
        """
        topic_scores: Dict[str, Dict] = {}
        correct_total = 0

        for i, q in enumerate(questions):
            topic_id = q.get("topic_id", "unknown")
            if topic_id not in topic_scores:
                topic_scores[topic_id] = {"correct": 0, "total": 0}

            topic_scores[topic_id]["total"] += 1
            user_answer = answers[i] if i < len(answers) else -1
            if user_answer == q.get("correct_index"):
                correct_total += 1
                topic_scores[topic_id]["correct"] += 1

        total = len(questions)
        score_percent = round(correct_total / total * 100) if total else 0

        weak_topic_ids = [
            tid for tid, s in topic_scores.items()
            if s["total"] > 0 and s["correct"] / s["total"] < 0.5
        ]
        strong_topic_ids = [
            tid for tid, s in topic_scores.items()
            if s["total"] > 0 and s["correct"] / s["total"] >= 0.75
        ]

        return {
            "score_percent": score_percent,
            "correct": correct_total,
            "total": total,
            "topic_scores": topic_scores,
            "weak_topic_ids": weak_topic_ids,
            "strong_topic_ids": strong_topic_ids,
        }

    def save_result(
        self,
        db,
        user_id,
        subject_id: str,
        ss_level: str,
        analysis: Dict,
    ):
        """Persist the diagnostic result and update the readiness score."""
        from models import DiagnosticResult
        import uuid as _uuid

        result = DiagnosticResult(
            user_id=user_id,
            subject_id=subject_id,
            ss_level=ss_level,
            total_questions=analysis["total"],
            correct_answers=analysis["correct"],
            score_percent=analysis["score_percent"],
            topic_scores=analysis["topic_scores"],
            weak_topic_ids=analysis["weak_topic_ids"],
        )
        db.add(result)
        db.commit()
        db.refresh(result)

        # Bootstrap the readiness score from this diagnostic
        from services.readiness_service import readiness_service
        readiness_service.update_from_diagnostic(
            db, user_id=user_id, subject_id=subject_id, diagnostic_score=analysis["score_percent"],
            weak_topic_ids=analysis["weak_topic_ids"], strong_topic_ids=analysis["strong_topic_ids"],
        )
        return result


diagnostic_service = DiagnosticService()
