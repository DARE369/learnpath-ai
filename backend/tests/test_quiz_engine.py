import pytest
import math
from datetime import datetime
from sqlalchemy.orm import Session
from uuid import uuid4

from models import (
    User, Topic, QuizSession, QuizQuestion, QuizResponse, ConceptMastery, FSRSCard
)
from services.quiz_engine_service import QuizEngineService


@pytest.fixture
def db_session(db: Session):
    """Get database session"""
    return db


@pytest.fixture
def test_user(db_session: Session):
    """Create a test user"""
    user = User(
        email=f"test_{uuid4()}@example.com",
        password_hash="hashed_password",
        full_name="Test User"
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def test_topic(db_session: Session):
    """Create a test topic"""
    topic = Topic(
        name=f"Test Topic {uuid4()}",
        description="A test topic for quizzes",
        category="Testing"
    )
    db_session.add(topic)
    db_session.commit()
    return topic


@pytest.fixture
def test_questions(db_session: Session, test_topic: Topic):
    """Create test quiz questions"""
    questions = []
    for i in range(10):
        question = QuizQuestion(
            topic_id=test_topic.id,
            question_text=f"What is {i}+{i}?",
            question_type="multiple_choice",
            options=[
                {"text": str(i*2), "id": "A", "correct": True},
                {"text": str(i*2+1), "id": "B", "correct": False},
                {"text": str(i*2-1), "id": "C", "correct": False},
            ],
            correct_answer_id="A",
            explanation=f"The answer is {i*2} because {i}+{i}={i*2}",
            explanation_for_each_option={
                "A": "Correct!",
                "B": "Incorrect",
                "C": "Incorrect"
            },
            concept_id=f"math_concept_{i}",
            difficulty_parameter=float(i - 5) / 2,
            discrimination_parameter=1.0
        )
        db_session.add(question)
        questions.append(question)

    db_session.commit()
    return questions


class TestQuizEngineService:
    """Test quiz engine service"""

    @pytest.mark.asyncio
    async def test_start_quiz_session(
        self,
        db_session: Session,
        test_user: User,
        test_topic: Topic,
        test_questions: list
    ):
        """Test starting a quiz session"""
        service = QuizEngineService()

        result = await service.start_quiz_session(
            db=db_session,
            user_id=test_user.id,
            quiz_type="section",
            topic_id=test_topic.id
        )

        assert result["session_id"] is not None
        assert result["question"] is not None
        assert result["question_number"] == 1
        assert result["total_questions"] == 5

        # Verify session was created in DB
        session = db_session.query(QuizSession).filter(
            QuizSession.id == result["session_id"]
        ).first()

        assert session is not None
        assert session.user_id == test_user.id

    @pytest.mark.asyncio
    async def test_get_user_ability_new_user(
        self,
        db_session: Session,
        test_user: User
    ):
        """Test ability estimation for new user (should be 0.0)"""
        service = QuizEngineService()

        ability = await service._get_user_ability(db_session, test_user.id)

        assert ability == 0.0

    def test_irt_probability_calculation(self):
        """Test IRT probability calculation"""
        # P(correct) = 1 / (1 + e^(-1.7 * a * (θ - b)))
        # When θ = b (learner ability equals question difficulty),
        # P(correct) should be 0.5

        a, b, theta = 1.0, 0.0, 0.0
        exponent = -1.7 * a * (theta - b)
        p = 1.0 / (1.0 + math.exp(exponent))

        assert abs(p - 0.5) < 0.01  # Should be very close to 0.5

    @pytest.mark.asyncio
    async def test_ability_update_correct_answer(
        self,
        db_session: Session,
        test_questions: list
    ):
        """Test ability increases when answering correctly"""
        service = QuizEngineService()
        question = test_questions[0]

        initial_ability = 0.0
        new_ability = await service._update_ability_estimate(
            current_ability=initial_ability,
            question=question,
            is_correct=True
        )

        assert new_ability > initial_ability

    @pytest.mark.asyncio
    async def test_ability_update_incorrect_answer(
        self,
        db_session: Session,
        test_questions: list
    ):
        """Test ability decreases when answering incorrectly"""
        service = QuizEngineService()
        question = test_questions[0]

        initial_ability = 0.0
        new_ability = await service._update_ability_estimate(
            current_ability=initial_ability,
            question=question,
            is_correct=False
        )

        assert new_ability < initial_ability

    def test_confidence_calibration_high_confidence_correct(self):
        """Test confidence calibration: high confidence + correct = well calibrated"""
        service = QuizEngineService()

        is_calibrated = service._check_confidence_calibration(
            confidence_rating=9,
            is_correct=True
        )

        assert is_calibrated is True

    def test_confidence_calibration_high_confidence_wrong(self):
        """Test confidence calibration: high confidence + wrong = not calibrated"""
        service = QuizEngineService()

        is_calibrated = service._check_confidence_calibration(
            confidence_rating=9,
            is_correct=False
        )

        assert is_calibrated is False

    def test_confidence_calibration_low_confidence_wrong(self):
        """Test confidence calibration: low confidence + wrong = OK"""
        service = QuizEngineService()

        is_calibrated = service._check_confidence_calibration(
            confidence_rating=2,
            is_correct=False
        )

        assert is_calibrated is True

    @pytest.mark.asyncio
    async def test_submit_answer(
        self,
        db_session: Session,
        test_user: User,
        test_topic: Topic,
        test_questions: list
    ):
        """Test submitting an answer to a question"""
        service = QuizEngineService()

        # Start quiz session
        session_result = await service.start_quiz_session(
            db=db_session,
            user_id=test_user.id,
            quiz_type="section",
            topic_id=test_topic.id
        )

        session_id = session_result["session_id"]
        question_id = session_result["question"]["id"]

        # Submit answer
        feedback = await service.submit_answer(
            db=db_session,
            session_id=session_id,
            question_id=question_id,
            user_answer="A",  # Correct answer
            confidence_rating=5,
            time_spent_seconds=30,
            user_id=test_user.id
        )

        assert feedback["is_correct"] is True
        assert feedback["explanation"] is not None
        assert "ability_updated" in feedback

        # Verify response was saved
        response = db_session.query(QuizResponse).filter(
            QuizResponse.quiz_session_id == session_id
        ).first()

        assert response is not None
        assert response.is_correct is True
        assert response.confidence_rating == 5

    @pytest.mark.asyncio
    async def test_complete_quiz_session(
        self,
        db_session: Session,
        test_user: User,
        test_topic: Topic,
        test_questions: list
    ):
        """Test completing a quiz session"""
        service = QuizEngineService()

        # Start quiz
        session_result = await service.start_quiz_session(
            db=db_session,
            user_id=test_user.id,
            quiz_type="section",
            topic_id=test_topic.id
        )

        session_id = session_result["session_id"]

        # Answer 5 questions
        for i in range(5):
            session = db_session.query(QuizSession).filter(
                QuizSession.id == session_id
            ).first()

            if session.questions_answered < session.total_questions:
                next_q = await service._select_next_question(
                    db=db_session,
                    user_id=test_user.id,
                    current_ability=session.estimated_ability,
                    quiz_type="section",
                    topic_id=test_topic.id
                )

                if next_q:
                    await service.submit_answer(
                        db=db_session,
                        session_id=session_id,
                        question_id=next_q["id"],
                        user_answer="A",
                        confidence_rating=5,
                        time_spent_seconds=30,
                        user_id=test_user.id
                    )

        # Complete quiz
        results = await service.complete_quiz_session(
            db=db_session,
            session_id=session_id,
            user_id=test_user.id
        )

        assert results["score_percent"] >= 0
        assert results["score_percent"] <= 100
        assert "performance_level" in results
        assert "recommendation" in results

        # Verify session was completed
        completed_session = db_session.query(QuizSession).filter(
            QuizSession.id == session_id
        ).first()

        assert completed_session.session_completed_at is not None
        assert completed_session.score_percent == results["score_percent"]
