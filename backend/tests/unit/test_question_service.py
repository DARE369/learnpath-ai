"""Unit tests for QuestionService — Anthropic client is fully mocked."""

import json
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from services.question_service import QuestionService, _parse_json_response, _CORRECT_INTERVALS, _INCORRECT_INTERVALS


# ─── _parse_json_response ─────────────────────────────────────────────────────

class TestParseJsonResponse:
    def test_bare_json(self):
        text = '{"question": "What?", "score": 80}'
        result = _parse_json_response(text)
        assert result["question"] == "What?"
        assert result["score"] == 80

    def test_json_in_code_fence(self):
        text = '```json\n{"question": "What?"}\n```'
        result = _parse_json_response(text)
        assert result["question"] == "What?"

    def test_raises_on_no_json(self):
        with pytest.raises(ValueError):
            _parse_json_response("No JSON here at all.")


# ─── generate_question ────────────────────────────────────────────────────────

class TestGenerateQuestion:
    def _make_service(self):
        svc = QuestionService()
        svc.api_key = "test_key"
        return svc

    def _mock_response(self, payload: dict) -> MagicMock:
        msg = MagicMock()
        msg.content = [MagicMock(text=json.dumps(payload))]
        return msg

    @pytest.mark.asyncio
    async def test_returns_required_keys(self):
        payload = {
            "question": "What is supervised learning?",
            "type": "free_text",
            "correct_answer": "Training on labelled data.",
            "explanation": "Because labels guide the model.",
            "difficulty": "medium",
            "estimated_time_seconds": 90,
        }
        svc = self._make_service()
        with patch("services.question_service.anthropic.AsyncAnthropic") as Cls:
            inst = Cls.return_value
            inst.messages.create = AsyncMock(return_value=self._mock_response(payload))
            result = await svc.generate_question("ML basics summary", "Supervised Learning")

        assert result["question"] == payload["question"]
        assert result["type"] == "free_text"
        assert result["correct_answer"] == payload["correct_answer"]
        assert result["difficulty"] == "medium"
        assert result["estimated_time_seconds"] == 90

    @pytest.mark.asyncio
    async def test_missing_api_key_raises(self):
        svc = QuestionService()
        svc.api_key = None
        with pytest.raises(ValueError, match="CLAUDE_API_KEY"):
            await svc.generate_question("summary", "concept")

    @pytest.mark.asyncio
    async def test_uses_given_difficulty(self):
        payload = {
            "question": "Hard question?",
            "type": "free_text",
            "correct_answer": "Hard answer",
            "explanation": "Hard reason",
            "difficulty": "hard",
            "estimated_time_seconds": 180,
        }
        svc = self._make_service()
        with patch("services.question_service.anthropic.AsyncAnthropic") as Cls:
            inst = Cls.return_value
            inst.messages.create = AsyncMock(return_value=self._mock_response(payload))
            result = await svc.generate_question("summary", "concept", difficulty="hard")
        assert result["difficulty"] == "hard"


# ─── evaluate_answer ──────────────────────────────────────────────────────────

class TestEvaluateAnswer:
    def _make_service(self):
        svc = QuestionService()
        svc.api_key = "test_key"
        return svc

    def _mock_response(self, payload: dict) -> MagicMock:
        msg = MagicMock()
        msg.content = [MagicMock(text=json.dumps(payload))]
        return msg

    @pytest.mark.asyncio
    async def test_correct_answer_scores_high(self):
        payload = {
            "is_correct": True,
            "score": 92,
            "explanation": "Excellent",
            "feedback": "Well done!",
            "next_difficulty": "harder",
            "key_insight": "The key is X.",
        }
        svc = self._make_service()
        with patch("services.question_service.anthropic.AsyncAnthropic") as Cls:
            inst = Cls.return_value
            inst.messages.create = AsyncMock(return_value=self._mock_response(payload))
            result = await svc.evaluate_answer("Q?", "Correct", "Correct", "medium")

        assert result["is_correct"] is True
        assert result["score"] == 92
        assert result["next_difficulty"] == "harder"

    @pytest.mark.asyncio
    async def test_incorrect_answer_scores_low(self):
        payload = {
            "is_correct": False,
            "score": 20,
            "explanation": "Off track",
            "feedback": "Keep trying!",
            "next_difficulty": "easier",
            "key_insight": "Think about X.",
        }
        svc = self._make_service()
        with patch("services.question_service.anthropic.AsyncAnthropic") as Cls:
            inst = Cls.return_value
            inst.messages.create = AsyncMock(return_value=self._mock_response(payload))
            result = await svc.evaluate_answer("Q?", "Correct", "Wrong answer", "medium")

        assert result["is_correct"] is False
        assert result["score"] == 20
        assert result["next_difficulty"] == "easier"

    @pytest.mark.asyncio
    async def test_partial_answer_scores_mid(self):
        payload = {
            "is_correct": False,
            "score": 65,
            "explanation": "Partly right",
            "feedback": "Good start!",
            "next_difficulty": "same",
            "key_insight": "Add more detail.",
        }
        svc = self._make_service()
        with patch("services.question_service.anthropic.AsyncAnthropic") as Cls:
            inst = Cls.return_value
            inst.messages.create = AsyncMock(return_value=self._mock_response(payload))
            result = await svc.evaluate_answer("Q?", "Correct", "Partial answer", "medium")

        assert 51 <= result["score"] <= 79

    @pytest.mark.asyncio
    async def test_score_clamped_to_0_100(self):
        payload = {"is_correct": True, "score": 999, "explanation": "", "feedback": "", "next_difficulty": "same", "key_insight": ""}
        svc = self._make_service()
        with patch("services.question_service.anthropic.AsyncAnthropic") as Cls:
            inst = Cls.return_value
            inst.messages.create = AsyncMock(return_value=self._mock_response(payload))
            result = await svc.evaluate_answer("Q?", "A", "A", "easy")
        assert result["score"] <= 100

    @pytest.mark.asyncio
    async def test_missing_api_key_raises(self):
        svc = QuestionService()
        svc.api_key = None
        with pytest.raises(ValueError, match="CLAUDE_API_KEY"):
            await svc.evaluate_answer("Q?", "A", "B", "easy")


# ─── schedule_next_review ─────────────────────────────────────────────────────

class TestScheduleNextReview:
    def _make_service(self):
        return QuestionService()

    def test_correct_first_review_is_3_days(self):
        svc = self._make_service()
        result = svc.schedule_next_review("concept", is_correct=True, times_reviewed=0)
        assert result["interval_days"] == _CORRECT_INTERVALS[0]
        assert result["times_reviewed"] == 1

    def test_correct_second_review_is_7_days(self):
        svc = self._make_service()
        result = svc.schedule_next_review("concept", is_correct=True, times_reviewed=1)
        assert result["interval_days"] == _CORRECT_INTERVALS[1]

    def test_correct_third_plus_review_is_30_days(self):
        svc = self._make_service()
        result = svc.schedule_next_review("concept", is_correct=True, times_reviewed=5)
        assert result["interval_days"] == _CORRECT_INTERVALS[-1]

    def test_incorrect_first_review_is_1_day(self):
        svc = self._make_service()
        result = svc.schedule_next_review("concept", is_correct=False, times_reviewed=0)
        assert result["interval_days"] == _INCORRECT_INTERVALS[0]

    def test_incorrect_subsequent_review_is_3_days(self):
        svc = self._make_service()
        result = svc.schedule_next_review("concept", is_correct=False, times_reviewed=2)
        assert result["interval_days"] == _INCORRECT_INTERVALS[-1]

    def test_review_date_is_future(self):
        svc = self._make_service()
        result = svc.schedule_next_review("concept", is_correct=True, times_reviewed=0)
        review_date = datetime.fromisoformat(result["review_date"])
        assert review_date > datetime.utcnow()

    def test_times_reviewed_increments(self):
        svc = self._make_service()
        result = svc.schedule_next_review("concept", is_correct=True, times_reviewed=2)
        assert result["times_reviewed"] == 3


# ─── get_conceptual_explanation ───────────────────────────────────────────────

class TestGetConceptualExplanation:
    @pytest.mark.asyncio
    async def test_returns_string(self):
        svc = QuestionService()
        svc.api_key = "test_key"
        with patch("services.question_service.anthropic.AsyncAnthropic") as Cls:
            inst = Cls.return_value
            msg = MagicMock()
            msg.content = [MagicMock(text="Great insight about this concept.")]
            inst.messages.create = AsyncMock(return_value=msg)
            result = await svc.get_conceptual_explanation("my answer", "ML")
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_no_api_key_returns_fallback(self):
        svc = QuestionService()
        svc.api_key = None
        result = await svc.get_conceptual_explanation("some answer", "Photosynthesis")
        assert isinstance(result, str)
        assert "Photosynthesis" in result
