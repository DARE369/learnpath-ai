import math
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from models import (
    QuizSession, QuizQuestion, QuizResponse, ConceptMastery, FSRSCard
)


class QuizEngineService:
    """
    Main quiz service: Generate questions, track responses, update IRT model
    Implements Item Response Theory (IRT) for adaptive difficulty
    """

    async def start_quiz_session(
        self,
        db: Session,
        user_id: str,
        quiz_type: str = "section",
        topic_id: str = None
    ) -> dict:
        """Start new quiz session"""

        session = QuizSession(
            user_id=user_id,
            topic_id=topic_id,
            quiz_type=quiz_type,
            total_questions=5,
            estimated_ability=await self._get_user_ability(db, user_id)
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        # Generate first question
        first_question = await self._select_next_question(
            db,
            user_id,
            session.estimated_ability,
            quiz_type,
            topic_id
        )

        if not first_question:
            raise ValueError("No questions available for this quiz")

        return {
            "session_id": str(session.id),
            "question": first_question,
            "question_number": 1,
            "total_questions": 5
        }

    async def _get_user_ability(self, db: Session, user_id: str) -> float:
        """
        Estimate learner's overall ability (θ)
        Based on recent quiz performance
        Default: 0.0 (average)
        """

        # Get last 10 quiz responses
        recent_responses = db.query(QuizResponse).filter(
            QuizResponse.user_id == user_id
        ).order_by(desc(QuizResponse.created_at)).limit(10).all()

        if not recent_responses:
            return 0.0  # New user = average

        # Use most recent ability estimate
        return recent_responses[0].learner_ability_after or 0.0

    async def _select_next_question(
        self,
        db: Session,
        user_id: str,
        current_ability: float,
        quiz_type: str,
        topic_id: str
    ) -> dict:
        """
        Select question using IRT:
        1. Get question pool
        2. Score each by relevance + difficulty match
        3. Select best match (goal: P(correct) ≈ 0.65)
        """

        # Get question pool
        query = db.query(QuizQuestion)

        if quiz_type == "section" and topic_id:
            query = query.filter(QuizQuestion.topic_id == topic_id)

        questions = query.all()

        if not questions:
            return None

        # Score each question using IRT
        scored_questions = []

        for q in questions:
            # IRT model: P(correct) = 1 / (1 + e^(-1.7 * a * (θ - b)))
            a = q.discrimination_parameter or 1.0  # 'a' in IRT
            b = q.difficulty_parameter or 0.0  # 'b' in IRT

            # Calculate probability user would answer correctly
            exponent = -1.7 * a * (current_ability - b)
            p_correct = 1.0 / (1.0 + math.exp(exponent))

            # Score: How close is P(correct) to target 0.65?
            difficulty_score = 1.0 - abs(p_correct - 0.65)

            scored_questions.append({
                "question": q,
                "p_correct": p_correct,
                "difficulty_score": difficulty_score
            })

        if not scored_questions:
            return None

        # Select question with best difficulty match
        best = max(scored_questions, key=lambda x: x["difficulty_score"])

        return {
            "id": str(best["question"].id),
            "text": best["question"].question_text,
            "type": best["question"].question_type,
            "options": best["question"].options or [],
            "concept": best["question"].concept_id
        }

    async def submit_answer(
        self,
        db: Session,
        session_id: str,
        question_id: str,
        user_answer: str,
        confidence_rating: int,
        time_spent_seconds: int,
        user_id: str
    ) -> dict:
        """
        Process user's answer and return immediate feedback
        + Calculate new ability estimate
        """

        # Get question & session
        question = db.query(QuizQuestion).filter(
            QuizQuestion.id == question_id
        ).first()

        session = db.query(QuizSession).filter(
            QuizSession.id == session_id
        ).first()

        if not question or not session:
            raise ValueError("Question or session not found")

        # Check if correct
        is_correct = user_answer == question.correct_answer_id

        # Get user's current ability before this question
        ability_before = session.estimated_ability or 0.0

        # Update ability using IRT
        ability_after = await self._update_ability_estimate(
            ability_before,
            question,
            is_correct
        )

        # Check confidence calibration
        confidence_appropriate = self._check_confidence_calibration(
            confidence_rating,
            is_correct
        )

        # Save response
        response_record = QuizResponse(
            user_id=user_id,
            quiz_session_id=session_id,
            question_id=question_id,
            user_answer_id=user_answer,
            is_correct=is_correct,
            confidence_rating=confidence_rating,
            confidence_appropriate=confidence_appropriate,
            time_spent_seconds=time_spent_seconds,
            learner_ability_before=ability_before,
            learner_ability_after=ability_after
        )

        db.add(response_record)

        # Update session
        session.questions_answered += 1
        if is_correct:
            session.correct_answers += 1
        session.estimated_ability = ability_after
        session.total_time_seconds += time_spent_seconds

        db.commit()
        db.refresh(response_record)

        # If answer wrong, mark for FSRS spaced repetition
        if not is_correct:
            await self._add_to_spaced_repetition(
                db,
                user_id,
                question_id,
                "quiz_question"
            )

        # Return immediate feedback
        return {
            "is_correct": is_correct,
            "explanation": question.explanation,
            "explanation_for_choice": (
                question.explanation_for_each_option.get(user_answer, "")
                if question.explanation_for_each_option else ""
            ),
            "confidence_feedback": (
                "Well-calibrated! ✓" if confidence_appropriate
                else "Overconfident or underconfident"
            ),
            "next_question_difficulty": "harder" if is_correct else "easier",
            "ability_updated": ability_after
        }

    async def _update_ability_estimate(
        self,
        current_ability: float,
        question: QuizQuestion,
        is_correct: bool
    ) -> float:
        """
        Bayesian update of ability estimate
        If correct: ability goes up
        If wrong: ability goes down
        Magnitude depends on question difficulty
        """

        # IRT parameters
        a = question.discrimination_parameter or 1.0
        b = question.difficulty_parameter or 0.0

        # Prior: P(correct) under current ability
        exponent = -1.7 * a * (current_ability - b)
        p_correct = 1.0 / (1.0 + math.exp(exponent))

        # Fisher information (precision of this question)
        fisher_info = 1.7 * 1.7 * a * a * p_correct * (1 - p_correct)

        # Learning rate
        learning_rate = 0.3 / (1 + fisher_info)

        # Update
        if is_correct:
            new_ability = current_ability + learning_rate * 0.5
        else:
            new_ability = current_ability - learning_rate * 0.5

        # Clamp to reasonable range
        return max(-3.0, min(3.0, new_ability))

    def _check_confidence_calibration(
        self,
        confidence_rating: int,
        is_correct: bool
    ) -> bool:
        """
        Check if confidence matches reality
        High confidence + correct = well calibrated
        High confidence + wrong = overconfident
        Low confidence + wrong = OK (expected)
        """

        if confidence_rating >= 7:  # High confidence
            return is_correct
        elif confidence_rating <= 4:  # Low confidence
            return not is_correct  # May be wrong, that's OK
        else:  # Medium confidence
            return True

    async def _add_to_spaced_repetition(
        self,
        db: Session,
        user_id: str,
        question_id: str,
        source_type: str
    ):
        """
        Add failed question to FSRS spaced repetition queue
        """

        card = FSRSCard(
            user_id=user_id,
            source_type=source_type,
            source_id=question_id,
            state="new",
            due_date=datetime.utcnow(),
            difficulty=5.0,
            stability=1.0
        )

        db.add(card)
        db.commit()

    async def complete_quiz_session(
        self,
        db: Session,
        session_id: str,
        user_id: str
    ) -> dict:
        """
        Finalize quiz: Calculate final score, generate analytics, recommendations
        """

        session = db.query(QuizSession).filter(
            QuizSession.id == session_id
        ).first()

        if not session:
            raise ValueError("Session not found")

        # Get all responses in this session
        responses = db.query(QuizResponse).filter(
            QuizResponse.quiz_session_id == session_id
        ).all()

        # Calculate overall score
        total_count = len(responses)
        score_percent = (
            int((session.correct_answers / total_count) * 100)
            if total_count > 0 else 0
        )

        # Analyze by concept
        concept_performance = {}
        for response in responses:
            question = db.query(QuizQuestion).filter(
                QuizQuestion.id == response.question_id
            ).first()

            if question:
                concept = question.concept_id or "unknown"

                if concept not in concept_performance:
                    concept_performance[concept] = {"correct": 0, "total": 0}

                concept_performance[concept]["total"] += 1
                if response.is_correct:
                    concept_performance[concept]["correct"] += 1

        # Identify weak/strong concepts
        weak_concepts = [
            c for c, data in concept_performance.items()
            if data["total"] > 0 and (data["correct"] / data["total"] * 100) < 60
        ]

        strong_concepts = [
            c for c, data in concept_performance.items()
            if data["total"] > 0 and (data["correct"] / data["total"] * 100) > 80
        ]

        # Determine performance level
        if score_percent < 50:
            performance_level = "below_average"
            recommendation = "Review fundamental concepts"
        elif score_percent < 70:
            performance_level = "average"
            recommendation = f"Good effort! Focus on: {', '.join(weak_concepts) if weak_concepts else 'core concepts'}"
        elif score_percent < 85:
            performance_level = "above_average"
            recommendation = "Excellent work! Keep reinforcing weak areas"
        else:
            performance_level = "expert"
            recommendation = "Mastered this topic! Ready for advanced material"

        # Update session with final results
        session.session_completed_at = datetime.utcnow()
        session.score_percent = score_percent
        session.weak_concepts = weak_concepts
        session.strong_concepts = strong_concepts
        session.performance_level = performance_level
        session.recommendation = recommendation

        if total_count > 0:
            session.avg_time_per_question = int(session.total_time_seconds / total_count)

        db.commit()

        # Update concept mastery
        for concept, data in concept_performance.items():
            if data["total"] > 0:
                accuracy = int((data["correct"] / data["total"]) * 100)
                is_mastered = accuracy >= 80

                mastery = db.query(ConceptMastery).filter(
                    and_(
                        ConceptMastery.user_id == user_id,
                        ConceptMastery.concept_id == concept
                    )
                ).first()

                if mastery:
                    mastery.questions_attempted += data["total"]
                    mastery.questions_correct += data["correct"]
                    mastery.accuracy_percent = int(
                        (mastery.questions_correct / mastery.questions_attempted) * 100
                    )
                    mastery.is_mastered = is_mastered
                    if is_mastered:
                        mastery.mastered_date = datetime.utcnow()
                else:
                    mastery = ConceptMastery(
                        user_id=user_id,
                        concept_id=concept,
                        questions_attempted=data["total"],
                        questions_correct=data["correct"],
                        accuracy_percent=accuracy,
                        is_mastered=is_mastered,
                        mastered_date=datetime.utcnow() if is_mastered else None
                    )
                    db.add(mastery)

        db.commit()

        # Calculate peer comparison (percentile)
        all_sessions = db.query(QuizSession).filter(
            QuizSession.score_percent.isnot(None)
        ).all()

        better_than_count = sum(
            1 for s in all_sessions if s.score_percent < score_percent
        )
        percentile = (
            int((better_than_count / len(all_sessions)) * 100)
            if all_sessions else 50
        )

        return {
            "session_id": str(session.id),
            "score_percent": score_percent,
            "correct_answers": session.correct_answers,
            "total_questions": total_count,
            "performance_level": performance_level,
            "weak_concepts": weak_concepts,
            "strong_concepts": strong_concepts,
            "recommendation": recommendation,
            "percentile": percentile,
            "time_spent_seconds": session.total_time_seconds,
            "next_actions": [
                {"type": "review", "concept": c} for c in weak_concepts
            ] if weak_concepts else [
                {"type": "advance", "message": "You're ready for the next topic!"}
            ]
        }

    async def get_quiz_results(
        self,
        db: Session,
        session_id: str,
        user_id: str
    ) -> dict:
        """Get detailed quiz results"""

        session = db.query(QuizSession).filter(
            and_(
                QuizSession.id == session_id,
                QuizSession.user_id == user_id
            )
        ).first()

        if not session:
            raise ValueError("Quiz session not found")

        return {
            "id": str(session.id),
            "score": session.score_percent,
            "level": session.performance_level,
            "recommendation": session.recommendation,
            "weak_concepts": session.weak_concepts,
            "strong_concepts": session.strong_concepts,
            "total_time_seconds": session.total_time_seconds,
            "completed_at": session.session_completed_at.isoformat() if session.session_completed_at else None
        }
