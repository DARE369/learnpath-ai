"""
Unit tests for VideoChunkingService quiz generation (Phase 1 fix).

Guards the regression where `_generate_quiz` called the async
`generate_question` WITHOUT awaiting it, so every chapter silently fell back to
a single hard-coded free-text question. These tests assert the async MCQ path is
actually awaited and produces real multiple-choice questions, and that the
free-text fallback only fires when Claude yields nothing.

Claude is mocked — no network. DB uses in-memory SQLite scoped to the chapter
quiz tables.
"""

import uuid
from unittest.mock import patch

import pytest

from services.video_chunking_service import video_chunking_service

# The DB-backed tests below use the shared `db` fixture from tests/conftest.py,
# which yields a real database session or SKIPS when none is reachable. The
# chapter-quiz models use Postgres-specific UUID + ARRAY columns that SQLite
# can't bind, so — matching the repo's quiz-engine test convention — we don't
# fake a SQLite DB; we exercise persistence against real Postgres when present
# and rely on the pure-async tests (which need no DB) everywhere else.


def _make_chunk(db):
    from models import VideoChunk
    chunk = VideoChunk(
        video_id=uuid.uuid4(),
        chunk_number=1,
        title="Gradient Descent",
        description="",
        start_timestamp="0:00",
        end_timestamp="2:30",
        start_seconds=0,
        end_seconds=150,
        duration_seconds=150,
        learning_objective="Understand how gradient descent minimises a loss function",
        key_concepts=["learning rate", "loss surface"],
        summary="Gradient descent iteratively steps downhill on the loss surface.",
        ai_generated=True,
        ai_model="claude-sonnet-4-6",
    )
    db.add(chunk)
    db.commit()
    db.refresh(chunk)
    return chunk


def test_generate_quiz_produces_real_mcqs(db):
    """When Claude returns MCQs, they persist as multiple_choice with options."""
    from models import ChapterQuiz, ChapterQuizQuestion

    fake_mcqs = [
        {
            "question": "What does the learning rate control?",
            "type": "multiple_choice",
            "options": [
                {"text": "Step size", "correct": True},
                {"text": "The dataset size", "correct": False},
                {"text": "Number of layers", "correct": False},
                {"text": "Batch order", "correct": False},
            ],
            "explanation": "The learning rate scales each descent step.",
        },
        {
            "question": "Gradient descent moves in which direction?",
            "type": "multiple_choice",
            "options": [
                {"text": "Downhill on the loss surface", "correct": True},
                {"text": "Uphill on the loss surface", "correct": False},
                {"text": "Randomly", "correct": False},
                {"text": "Along the x-axis only", "correct": False},
            ],
            "explanation": "It follows the negative gradient.",
        },
    ]
    chunk = _make_chunk(db)

    # Patch the async MCQ generator so the test asserts the AWAIT wiring +
    # persistence, not Claude itself.
    async def _fake(*args, **kwargs):
        return fake_mcqs

    with patch.object(video_chunking_service, "_generate_mcqs", side_effect=_fake):
        video_chunking_service._generate_quiz(db, chunk)

    quiz = db.query(ChapterQuiz).filter(ChapterQuiz.chunk_id == chunk.id).first()
    assert quiz is not None
    assert quiz.question_count == 2

    qs = (
        db.query(ChapterQuizQuestion)
        .filter(ChapterQuizQuestion.chapter_quiz_id == quiz.id)
        .order_by(ChapterQuizQuestion.question_number)
        .all()
    )
    assert len(qs) == 2
    for q in qs:
        assert q.question_type == "multiple_choice"
        assert isinstance(q.options, list) and len(q.options) == 4
        assert sum(1 for o in q.options if o.get("correct")) == 1


def test_generate_quiz_falls_back_when_no_mcqs(db):
    """When Claude yields nothing, a single free-text fallback is stored."""
    from models import ChapterQuiz, ChapterQuizQuestion

    chunk = _make_chunk(db)

    async def _empty(*args, **kwargs):
        return []

    with patch.object(video_chunking_service, "_generate_mcqs", side_effect=_empty):
        video_chunking_service._generate_quiz(db, chunk)

    quiz = db.query(ChapterQuiz).filter(ChapterQuiz.chunk_id == chunk.id).first()
    qs = (
        db.query(ChapterQuizQuestion)
        .filter(ChapterQuizQuestion.chapter_quiz_id == quiz.id)
        .all()
    )
    assert len(qs) == 1
    assert qs[0].question_type == "free_text"


def test_chapter_quiz_updates_concept_mastery(db):
    """A passing chapter quiz advances ConceptMastery for each key concept."""
    from models import VideoChunk, ConceptMastery

    user_id = uuid.uuid4()
    chunk = _make_chunk(db)  # key_concepts = ["learning rate", "loss surface"]

    video_chunking_service._update_concept_mastery(db, user_id, chunk, quiz_score=90)

    rows = db.query(ConceptMastery).filter(ConceptMastery.user_id == user_id).all()
    concepts = {r.concept_id: r for r in rows}
    assert set(concepts) == {"learning rate", "loss surface"}
    for r in rows:
        assert r.questions_attempted == 1
        assert r.questions_correct == 1  # passed (>=60)
        assert r.accuracy_percent == 100


def test_failed_chapter_quiz_enqueues_fsrs_review(db):
    """Failing a chapter quiz enqueues exactly one dedup'd FSRS review card."""
    from models import FSRSCard

    user_id = uuid.uuid4()
    chunk = _make_chunk(db)

    # Two failed attempts -> still one card (dedup on user+chunk).
    video_chunking_service._update_concept_mastery(db, user_id, chunk, quiz_score=40)
    video_chunking_service._update_concept_mastery(db, user_id, chunk, quiz_score=20)

    cards = db.query(FSRSCard).filter(
        FSRSCard.user_id == user_id,
        FSRSCard.source_type == "chapter_quiz",
    ).all()
    assert len(cards) == 1
    assert cards[0].source_id == chunk.id


@pytest.mark.asyncio
async def test_generate_mcqs_returns_empty_without_api_key():
    """No CLAUDE_API_KEY -> generator returns [] (never raises)."""
    with patch("config.settings.CLAUDE_API_KEY", None):
        out = await video_chunking_service._generate_mcqs(
            "Some chapter", "some content", ["concept"]
        )
    assert out == []


@pytest.mark.asyncio
async def test_generate_mcqs_drops_malformed_questions():
    """Questions without exactly one correct option are discarded."""
    import json as _json

    class _Msg:
        def __init__(self, text):
            self.content = [type("C", (), {"text": text})()]

    payload = {
        "questions": [
            {  # valid
                "question": "Q1?",
                "options": [
                    {"text": "a", "correct": True},
                    {"text": "b", "correct": False},
                    {"text": "c", "correct": False},
                    {"text": "d", "correct": False},
                ],
                "explanation": "e",
            },
            {  # invalid: two correct
                "question": "Q2?",
                "options": [
                    {"text": "a", "correct": True},
                    {"text": "b", "correct": True},
                ],
                "explanation": "e",
            },
        ]
    }

    class _FakeClient:
        def __init__(self, *a, **k):
            self.messages = self

        async def create(self, *a, **k):
            return _Msg(_json.dumps(payload))

    with patch("config.settings.CLAUDE_API_KEY", "test-key"), patch(
        "anthropic.AsyncAnthropic", _FakeClient
    ):
        out = await video_chunking_service._generate_mcqs(
            "Chapter", "content here", ["c1"]
        )

    assert len(out) == 1
    assert out[0]["question"] == "Q1?"
    assert out[0]["type"] == "multiple_choice"
