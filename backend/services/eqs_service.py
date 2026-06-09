"""
Educational Quality Score (EQS) service — v2.

Scores YouTube videos on 4 weighted dimensions (total 0-100):
  Content Quality  (0-45): depth/accuracy, explanation quality, structure, completeness
  Level Match      (0-25): vocabulary fit, prior knowledge fit, pacing — calibrated per user
  Topic Fit        (0-15): query relevance, approach appropriateness for topic type
  Credibility      (0-15): creator credibility, view count reach, engagement quality

Score tiers:
  85-100  Excellent (tier 1)
  65-84   Good      (tier 2)
  40-64   Fair      (tier 3)
  0-39    Poor      (tier 4)

Improvements over v1 binary rubric:
  - Numeric 0-N sub-scores replace YES/NO binary — far more signal per call
  - User proficiency level baked into Level Match calibration
  - Topic type adaptation: Claude infers category (DIY, medical, coding…) and
    applies appropriate expectations per topic
  - Real credibility signals: view count, like count, channel name
  - Removed unmeasurable questions (audio clarity, production from transcript alone)
  - Removed Q13 penalty for tutors who dive straight in without stating objectives
"""

import json
import logging
import re
from typing import List, Optional

import anthropic

from config import settings

logger = logging.getLogger(__name__)

TIER_LABELS = {1: "Excellent", 2: "Good", 3: "Fair", 4: "Poor"}

DIMENSION_MAXES = {
    "content_quality": {
        "depth_accuracy": 15,
        "explanation_quality": 15,
        "structural_coherence": 10,
        "completeness": 5,
    },
    "level_match": {
        "vocabulary_fit": 10,
        "prior_knowledge_fit": 10,
        "pacing": 5,
    },
    "topic_fit": {
        "query_relevance": 10,
        "approach_fit": 5,
    },
    "credibility": {
        "creator_credibility": 5,
        "audience_reach": 5,
        "engagement_quality": 5,
    },
}

# content_quality=45, level_match=25, topic_fit=15, credibility=15  →  total=100
DIMENSION_TOTALS = {dim: sum(sub.values()) for dim, sub in DIMENSION_MAXES.items()}


def _compute_tier(score: int) -> int:
    if score >= 85:
        return 1
    if score >= 65:
        return 2
    if score >= 40:
        return 3
    return 4


def _fmt_count(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n)


class EQSService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-sonnet-4-6"

    def _build_prompt(
        self,
        *,
        query: str,
        title: str,
        channel_name: str,
        duration_seconds: int,
        view_count: int,
        like_count: int,
        description: str,
        transcript: str,
        user_level: str,
        learning_styles: List[str],
    ) -> str:
        if user_level:
            level_line = f"Learner level: **{user_level}** — calibrate all Level Match scores to this"
        else:
            level_line = "Learner level: unknown — score for general accessibility"

        styles_line = (
            f"\nLearning styles: {', '.join(learning_styles)}" if learning_styles else ""
        )

        if duration_seconds:
            m, s = divmod(duration_seconds, 60)
            duration_str = f"{m}:{s:02d}"
        else:
            duration_str = "unknown"

        views_str = _fmt_count(view_count) if view_count else "unknown"
        likes_str = _fmt_count(like_count) if like_count else "unknown"
        desc_block = description[:400].strip() if description else "(none)"

        if transcript:
            transcript_block = transcript[:3500].strip()
        else:
            transcript_block = (
                "(not available — score Content Quality based on title, description, "
                "and what a video with this title would typically contain)"
            )

        level_label = user_level or "general audience"

        return f"""You are an expert educational content evaluator for a learning platform.

LEARNER CONTEXT:
{level_line}{styles_line}
Search query: "{query}"

VIDEO:
Title: {title}
Channel: {channel_name or 'unknown'}
Duration: {duration_str}
Views: {views_str} | Likes: {likes_str}
Description: {desc_block}

Transcript excerpt:
{transcript_block}

---
Score this video on 4 dimensions. Each score is an INTEGER from 0 to its stated maximum.
Be honest — don't inflate scores. A mediocre explanation should score 6-9/15, not 13+.

First, infer the topic type from the content (coding tutorial, medical explainer, DIY craft,
lifestyle habit, academic concept, etc.) and apply appropriate expectations:
  - DIY / practical skill  → prioritise demonstration clarity and step-by-step coverage
  - Medical / scientific   → prioritise accuracy, evidence, and safe framing
  - Coding / technical     → prioritise working examples and correct implementation
  - Academic / conceptual  → prioritise conceptual clarity and example-driven reasoning
  - Lifestyle / soft skill → prioritise actionability and relatable framing

1. CONTENT QUALITY (max 45 total)
   - depth_accuracy (0-15): Correct facts, substantive depth — not just surface mentions
   - explanation_quality (0-15): Explains WHY not just WHAT; uses analogies, examples,
     builds genuine understanding rather than enumerating facts
   - structural_coherence (0-10): Logical progression; builds systematically; doesn't jump randomly
   - completeness (0-5): Covers what the title and description promise

2. LEVEL MATCH (max 25 total) — calibrate to: {level_label}
   - vocabulary_fit (0-10): Vocabulary and assumed knowledge right for a {level_label} learner?
     (too basic = low; too advanced = low; just right = high)
   - prior_knowledge_fit (0-10): Assumes appropriate prerequisites for this level?
   - pacing (0-5): Moves at an appropriate speed for {level_label}?

3. TOPIC FIT (max 15 total)
   - query_relevance (0-10): How directly does this teach "{query}"?
     (tangentially related = 1-4; covers it but not the focus = 5-7; squarely on topic = 8-10)
   - approach_fit (0-5): For this topic type, is the content approach appropriate?
     (heavy theory for a practical topic = low; no examples for a conceptual topic = low)

4. CREDIBILITY & REACH (max 15 total)
   - creator_credibility (0-5): Institutional/well-known edu channel = 4-5;
     identifiable expert = 3-4; unknown creator = 1-2
   - audience_reach (0-5): View count signal —
     1M+ = 5; 100K-1M = 4; 10K-100K = 3; 1K-10K = 2; <1K = 0-1; unknown = 2
   - engagement_quality (0-5): Like count and like/view ratio — high ratio signals genuine value

Return EXACTLY this JSON with no text before or after:
{{
  "content_quality": {{
    "depth_accuracy": int,
    "explanation_quality": int,
    "structural_coherence": int,
    "completeness": int
  }},
  "level_match": {{
    "vocabulary_fit": int,
    "prior_knowledge_fit": int,
    "pacing": int
  }},
  "topic_fit": {{
    "query_relevance": int,
    "approach_fit": int
  }},
  "credibility": {{
    "creator_credibility": int,
    "audience_reach": int,
    "engagement_quality": int
  }},
  "reasoning": "2-3 sentences: overall assessment, main strengths, main gaps"
}}"""

    def _parse_response(self, text: str) -> dict:
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON found in EQS response")
        data = json.loads(json_match.group())

        out: dict = {}
        total = 0
        for dim, sub_maxes in DIMENSION_MAXES.items():
            dim_data = data.get(dim) or {}
            out[dim] = {}
            for sub_key, max_val in sub_maxes.items():
                raw = dim_data.get(sub_key, 0)
                try:
                    val = max(0, min(int(raw), max_val))
                except (TypeError, ValueError):
                    val = 0
                out[dim][sub_key] = val
                total += val

        out["reasoning"] = str(data.get("reasoning", "")).strip()
        out["total"] = total
        return out

    async def score_video(
        self,
        youtube_id: str,
        title: str,
        transcript: Optional[str] = None,
        description: Optional[str] = None,
        query: str = "",
        channel_name: str = "",
        duration_seconds: int = 0,
        view_count: int = 0,
        like_count: int = 0,
        user_level: str = "",
        learning_styles: Optional[List[str]] = None,
    ) -> dict:
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")

        prompt = self._build_prompt(
            query=query,
            title=title,
            channel_name=channel_name,
            duration_seconds=duration_seconds,
            view_count=view_count,
            like_count=like_count,
            description=description or "",
            transcript=transcript or "",
            user_level=user_level,
            learning_styles=learning_styles or [],
        )

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=self.model,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )

        parsed = self._parse_response(message.content[0].text)
        score = parsed["total"]
        tier = _compute_tier(score)

        cq = sum(parsed["content_quality"].values())
        lm = sum(parsed["level_match"].values())
        tf = sum(parsed["topic_fit"].values())
        cr = sum(parsed["credibility"].values())
        logger.info(
            f"EQS {youtube_id}: {score}/100 tier={tier} | "
            f"content={cq}/45 level={lm}/25 topic={tf}/15 cred={cr}/15"
        )

        return {
            "youtube_id": youtube_id,
            "score": score,
            "tier": tier,
            "tier_label": TIER_LABELS[tier],
            "dimensions": {
                dim: {
                    "scores": parsed[dim],
                    "total": sum(parsed[dim].values()),
                    "max": DIMENSION_TOTALS[dim],
                }
                for dim in DIMENSION_MAXES
            },
            "reasoning": parsed["reasoning"],
            # kept for any downstream code that reads these fields
            "answers": [],
            "yes_count": 0,
        }
