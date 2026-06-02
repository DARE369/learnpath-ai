from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, QuizSession, QuizQuestion
from dependencies import get_current_user
from services.quiz_engine_service import QuizEngineService

router = APIRouter(prefix="/api/quiz", tags=["quizzes"])
quiz_service = QuizEngineService()


@router.post("/start")
async def start_quiz(
    quiz_type: str = "section",
    topic_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a new quiz session"""
    try:
        result = await quiz_service.start_quiz_session(
            db=db,
            user_id=current_user.id,
            quiz_type=quiz_type,
            topic_id=topic_id
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{session_id}/answer")
async def submit_quiz_answer(
    session_id: str,
    question_id: str,
    answer: str,
    confidence: int,
    time_spent: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit answer to quiz question"""
    try:
        # Validate session belongs to user
        session = db.query(QuizSession).filter(
            QuizSession.id == session_id
        ).first()

        if not session or session.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Quiz session not found or unauthorized"
            )

        # Submit answer
        feedback = await quiz_service.submit_answer(
            db=db,
            session_id=session_id,
            question_id=question_id,
            user_answer=answer,
            confidence_rating=confidence,
            time_spent_seconds=time_spent,
            user_id=current_user.id
        )

        # Check if quiz is complete
        updated_session = db.query(QuizSession).filter(
            QuizSession.id == session_id
        ).first()

        if updated_session.questions_answered < updated_session.total_questions:
            # More questions
            next_q = await quiz_service._select_next_question(
                db=db,
                user_id=current_user.id,
                current_ability=updated_session.estimated_ability,
                quiz_type=updated_session.quiz_type,
                topic_id=updated_session.topic_id
            )

            if next_q:
                feedback["next_question"] = next_q
                feedback["question_number"] = updated_session.questions_answered + 1
        else:
            # Quiz complete
            feedback["quiz_complete"] = True
            results = await quiz_service.complete_quiz_session(
                db=db,
                session_id=session_id,
                user_id=current_user.id
            )
            feedback["results"] = results

        return feedback

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{session_id}/results")
async def get_quiz_results(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed quiz results"""
    try:
        results = await quiz_service.get_quiz_results(
            db=db,
            session_id=session_id,
            user_id=current_user.id
        )
        return results
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/questions/random")
async def get_random_question(
    topic_id: str = None,
    difficulty: str = "medium",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a random question for practice"""
    try:
        query = db.query(QuizQuestion)

        if topic_id:
            query = query.filter(QuizQuestion.topic_id == topic_id)

        question = query.first()

        if not question:
            raise ValueError("No questions available")

        return {
            "id": str(question.id),
            "text": question.question_text,
            "type": question.question_type,
            "options": question.options or [],
            "concept": question.concept_id
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
