import re
import logging
from typing import Optional

import anthropic

from config import settings

logger = logging.getLogger(__name__)

EQS_QUESTIONS = [
    "Is the information presented factually accurate and up-to-date?",
    "Is the content logically structured with a clear progression from basics to complex?",
    "Does the video provide concrete examples or real-world demonstrations?",
    "Is the difficulty level appropriate and consistent throughout?",
    "Does the video avoid significant gaps or oversimplifications that could mislead learners?",
    "Does the presenter explain concepts clearly using accessible language?",
    "Does the video summarize or reinforce key takeaways to aid retention?",
    "Does the video encourage viewer engagement (questions, exercises, or prompts)?",
    "Does the presenter demonstrate expertise in the subject matter?",
    "Is the audio clear and speech understandable?",
    "Is the pacing appropriate — neither too rushed nor too slow?",
    "Is the video free from major errors, off-topic tangents, or poor production issues?",
    "Does the video begin with clear learning objectives or stated goals?",
    "Would a learner gain meaningful, applicable knowledge from watching this?",
]

TIER_LABELS = {1: "Excellent", 2: "Good", 3: "Fair", 4: "Poor"}


def _compute_tier(score: int) -> int:
    if score >= 85:
        return 1
    if score >= 65:
        return 2
    if score >= 40:
        return 3
    return 4


def _parse_answers(text: str) -> list:
    answers = []
    for i in range(1, 15):
        pattern = rf"^\s*{i}[\.\)]\s*(YES|NO)\b"
        match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
        answers.append(match.group(1).upper() == "YES" if match else False)
    return answers


def _parse_assessment(text: str) -> str:
    match = re.search(r"ASSESSMENT:\s*(.+)", text, re.DOTALL | re.IGNORECASE)
    return match.group(1).strip() if match else ""


class EQSService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-opus-4-7"

    async def score_video(
        self,
        youtube_id: str,
        title: str,
        transcript: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict:
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")

        transcript_excerpt = (transcript or "")[:4000]
        description_text = description or "Not provided"
        questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(EQS_QUESTIONS))

        prompt = f"""You are an educational content quality assessor. Evaluate this YouTube video using the binary rubric below.

Video Title: {title}
Description: {description_text}
Transcript excerpt:
{transcript_excerpt}

Answer each question with YES or NO:
{questions_text}

Then provide a brief 2-3 sentence overall assessment.

Format your response exactly as:
1. YES/NO
2. YES/NO
3. YES/NO
4. YES/NO
5. YES/NO
6. YES/NO
7. YES/NO
8. YES/NO
9. YES/NO
10. YES/NO
11. YES/NO
12. YES/NO
13. YES/NO
14. YES/NO

ASSESSMENT: [your 2-3 sentence assessment]"""

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=self.model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        answers = _parse_answers(response_text)
        yes_count = sum(answers)
        score = round(yes_count / len(EQS_QUESTIONS) * 100)
        tier = _compute_tier(score)

        logger.info(
            f"EQS score for {youtube_id}: {score} (tier {tier}, {yes_count}/14 yes)"
        )

        return {
            "youtube_id": youtube_id,
            "score": score,
            "tier": tier,
            "tier_label": TIER_LABELS[tier],
            "answers": answers,
            "yes_count": yes_count,
            "reasoning": _parse_assessment(response_text),
        }
