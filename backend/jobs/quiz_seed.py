"""
Idempotent quiz-question seeding (NEW-PACKET-C).

Runs on startup from main.py's lifespan: if the quiz_questions table is empty,
insert a small bank of sample questions so the quiz works out of the box. Safe
to run on every boot — it no-ops the moment any question already exists, so it
never duplicates or overwrites curated content added later.

Questions are seeded with topic_id=None (the column is nullable); the adaptive
selector only filters by topic when a quiz explicitly requests one, so untyped
questions are always eligible for the default "quick quiz".
"""

import logging

logger = logging.getLogger(__name__)

SAMPLE_QUESTIONS = [
    {
        "question_text": "What is the capital of France?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "Paris", "id": "A"},
            {"text": "London", "id": "B"},
            {"text": "Berlin", "id": "C"},
            {"text": "Madrid", "id": "D"},
        ],
        "correct_answer_id": "A",
        "explanation": "Paris is the capital and largest city of France.",
        "explanation_for_each_option": {
            "A": "Correct! Paris is the capital of France.",
            "B": "London is the capital of the United Kingdom.",
            "C": "Berlin is the capital of Germany.",
            "D": "Madrid is the capital of Spain.",
        },
        "concept_id": "geography_capitals",
        "difficulty_parameter": -1.0,
        "discrimination_parameter": 1.2,
        "tags": ["geography", "easy", "capital_cities"],
    },
    {
        "question_text": "What is the chemical symbol for Gold?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "Au", "id": "A"},
            {"text": "Ag", "id": "B"},
            {"text": "Go", "id": "C"},
            {"text": "Gd", "id": "D"},
        ],
        "correct_answer_id": "A",
        "explanation": "Au is the chemical symbol for Gold, from its Latin name 'aurum'.",
        "explanation_for_each_option": {
            "A": "Correct! Au is the symbol for Gold.",
            "B": "Ag is the symbol for Silver.",
            "C": "Go is not a valid chemical symbol.",
            "D": "Gd is the symbol for Gadolinium.",
        },
        "concept_id": "chemistry_elements",
        "difficulty_parameter": 0.5,
        "discrimination_parameter": 1.1,
        "tags": ["chemistry", "medium", "periodic_table"],
    },
    {
        "question_text": "What is the derivative of x^2 + 3x + 5?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "2x + 3", "id": "A"},
            {"text": "x + 3", "id": "B"},
            {"text": "2x + 5", "id": "C"},
            {"text": "x^2 + 3", "id": "D"},
        ],
        "correct_answer_id": "A",
        "explanation": "The derivative of x^2 is 2x, of 3x is 3, and of 5 is 0.",
        "explanation_for_each_option": {
            "A": "Correct! Using the power rule and linearity of differentiation.",
            "B": "This would be the derivative of x^2/2 + 3x.",
            "C": "This misses the derivative of 3x.",
            "D": "This is not applying the power rule correctly.",
        },
        "concept_id": "calculus_derivatives",
        "difficulty_parameter": 1.5,
        "discrimination_parameter": 1.3,
        "tags": ["mathematics", "calculus", "derivatives", "hard"],
    },
    {
        "question_text": "Which planet is closest to the Sun?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "Mercury", "id": "A"},
            {"text": "Venus", "id": "B"},
            {"text": "Earth", "id": "C"},
            {"text": "Mars", "id": "D"},
        ],
        "correct_answer_id": "A",
        "explanation": "Mercury is the closest planet to the Sun in our solar system.",
        "explanation_for_each_option": {
            "A": "Correct! Mercury is the first planet from the Sun.",
            "B": "Venus is the second planet from the Sun.",
            "C": "Earth is the third planet from the Sun.",
            "D": "Mars is the fourth planet from the Sun.",
        },
        "concept_id": "astronomy_solar_system",
        "difficulty_parameter": -0.8,
        "discrimination_parameter": 1.2,
        "tags": ["astronomy", "easy", "solar_system"],
    },
    {
        "question_text": "What is the photosynthesis equation?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "6CO2 + 6H2O + light -> C6H12O6 + 6O2", "id": "A"},
            {"text": "6C6H12O6 + 6O2 -> 6CO2 + 6H2O + energy", "id": "B"},
            {"text": "CO2 + H2O -> CH4 + O2", "id": "C"},
            {"text": "C6H12O6 -> 2C2H5OH + 2CO2", "id": "D"},
        ],
        "correct_answer_id": "A",
        "explanation": "Photosynthesis converts CO2 and water into glucose and oxygen using light.",
        "explanation_for_each_option": {
            "A": "Correct! This is the balanced equation for photosynthesis.",
            "B": "This is the equation for cellular respiration.",
            "C": "This is not a valid biological equation.",
            "D": "This is the equation for fermentation.",
        },
        "concept_id": "biology_photosynthesis",
        "difficulty_parameter": 0.8,
        "discrimination_parameter": 1.25,
        "tags": ["biology", "medium", "photosynthesis"],
    },
    {
        "question_text": "In what year did the Titanic sink?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "1912", "id": "A"},
            {"text": "1920", "id": "B"},
            {"text": "1905", "id": "C"},
            {"text": "1915", "id": "D"},
        ],
        "correct_answer_id": "A",
        "explanation": "The RMS Titanic sank on April 15, 1912, after hitting an iceberg.",
        "explanation_for_each_option": {
            "A": "Correct! The Titanic sank in 1912.",
            "B": "This is 8 years too late.",
            "C": "This is 7 years too early.",
            "D": "This is 3 years too late.",
        },
        "concept_id": "history_maritime",
        "difficulty_parameter": -0.5,
        "discrimination_parameter": 1.1,
        "tags": ["history", "easy", "maritime"],
    },
    {
        "question_text": "What is the smallest prime number?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "2", "id": "A"},
            {"text": "1", "id": "B"},
            {"text": "3", "id": "C"},
            {"text": "0", "id": "D"},
        ],
        "correct_answer_id": "A",
        "explanation": "2 is the smallest and only even prime number.",
        "explanation_for_each_option": {
            "A": "Correct! 2 is the smallest prime number.",
            "B": "1 is not considered a prime number.",
            "C": "3 is a prime number but not the smallest.",
            "D": "0 is not a prime number.",
        },
        "concept_id": "mathematics_primes",
        "difficulty_parameter": -1.5,
        "discrimination_parameter": 1.0,
        "tags": ["mathematics", "easy", "primes"],
    },
    {
        "question_text": "Which of these is NOT a noble gas?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "Helium", "id": "A"},
            {"text": "Nitrogen", "id": "B"},
            {"text": "Neon", "id": "C"},
            {"text": "Argon", "id": "D"},
        ],
        "correct_answer_id": "B",
        "explanation": "Nitrogen is not a noble gas. Noble gases are He, Ne, Ar, Kr, Xe, Rn.",
        "explanation_for_each_option": {
            "A": "Helium is a noble gas.",
            "B": "Correct! Nitrogen is not a noble gas.",
            "C": "Neon is a noble gas.",
            "D": "Argon is a noble gas.",
        },
        "concept_id": "chemistry_noble_gases",
        "difficulty_parameter": 0.2,
        "discrimination_parameter": 1.2,
        "tags": ["chemistry", "medium", "periodic_table"],
    },
]


def seed_quiz_questions_if_empty() -> int:
    """Insert SAMPLE_QUESTIONS only when quiz_questions is empty.

    Returns the number of questions inserted (0 if the table already had any).
    Never raises — seeding is best-effort and must not block startup.
    """
    from database import _get_session_factory
    from models import QuizQuestion

    db = _get_session_factory()()
    try:
        existing = db.query(QuizQuestion).count()
        if existing > 0:
            logger.info(f"Quiz seed: {existing} questions already present, skipping")
            return 0

        for q in SAMPLE_QUESTIONS:
            db.add(QuizQuestion(
                topic_id=None,
                question_text=q["question_text"],
                question_type=q["question_type"],
                options=q["options"],
                correct_answer_id=q["correct_answer_id"],
                explanation=q["explanation"],
                explanation_for_each_option=q["explanation_for_each_option"],
                concept_id=q["concept_id"],
                difficulty_parameter=q["difficulty_parameter"],
                discrimination_parameter=q["discrimination_parameter"],
                tags=q.get("tags", []),
            ))
        db.commit()
        logger.info(f"Quiz seed: inserted {len(SAMPLE_QUESTIONS)} sample questions")
        return len(SAMPLE_QUESTIONS)
    except Exception as e:
        db.rollback()
        logger.error(f"Quiz seed failed: {e}", exc_info=True)
        return 0
    finally:
        db.close()
