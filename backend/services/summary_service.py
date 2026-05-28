import json
import logging
import re
from typing import Optional

import anthropic

from config import settings

logger = logging.getLogger(__name__)


def _word_count(text: str) -> int:
    return len(text.split()) if text else 0


def _parse_json_response(text: str) -> dict:
    """Extract JSON from Claude's response, handling markdown code fences."""
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No valid JSON found in Claude response")


class SummaryService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-sonnet-4-6"

    async def generate_summary(
        self,
        youtube_id: str,
        transcript: str,
        title: Optional[str] = None,
        max_length: int = 500,
    ) -> dict:
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")

        title_text = title or "Unknown"
        transcript_excerpt = transcript[:6000]

        prompt = f"""You are a learning assistant. Create a structured summary of this educational video.

Title: {title_text}
Transcript:
{transcript_excerpt}

Return a JSON object with exactly this structure:
{{
  "summary": "3-5 sentence overview (max {max_length} words)",
  "key_concepts": ["concept1", "concept2", "concept3", "concept4", "concept5"],
  "sections": [
    {{"title": "section title", "content": "brief description of what is covered"}}
  ]
}}

Requirements:
- summary: 3-5 sentences, max {max_length} words
- key_concepts: 5-8 most important concepts or terms
- sections: 3-6 logical topic sections from the video

Return only the JSON object, no other text."""

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        data = _parse_json_response(response_text)

        concept_count = len(data.get("key_concepts", []))
        logger.info(f"Summary generated for {youtube_id}: {concept_count} concepts")

        return {
            "youtube_id": youtube_id,
            "summary": data.get("summary", ""),
            "key_concepts": data.get("key_concepts", []),
            "sections": data.get("sections", []),
            "word_count": _word_count(data.get("summary", "")),
        }
