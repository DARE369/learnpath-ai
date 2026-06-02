"""
Script to seed sample quiz questions into the database.
Run this after creating the quiz tables with alembic.
"""

import asyncio
import os
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models import QuizQuestion, Topic

SAMPLE_QUESTIONS = [
    {
        "question_text": "What is the capital of France?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "Paris", "id": "A"},
            {"text": "London", "id": "B"},
            {"text": "Berlin", "id": "C"},
            {"text": "Madrid", "id": "D"}
        ],
        "correct_answer_id": "A",
        "explanation": "Paris is the capital and largest city of France.",
        "explanation_for_each_option": {
            "A": "Correct! Paris is the capital of France.",
            "B": "London is the capital of the United Kingdom.",
            "C": "Berlin is the capital of Germany.",
            "D": "Madrid is the capital of Spain."
        },
        "concept_id": "geography_capitals",
        "difficulty_parameter": -1.0,
        "discrimination_parameter": 1.2,
        "tags": ["geography", "easy", "capital_cities"]
    },
    {
        "question_text": "What is the chemical symbol for Gold?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "Au", "id": "A"},
            {"text": "Ag", "id": "B"},
            {"text": "Go", "id": "C"},
            {"text": "Gd", "id": "D"}
        ],
        "correct_answer_id": "A",
        "explanation": "Au is the chemical symbol for Gold, derived from its Latin name 'aurum'.",
        "explanation_for_each_option": {
            "A": "Correct! Au is the symbol for Gold.",
            "B": "Ag is the symbol for Silver.",
            "C": "Go is not a valid chemical symbol.",
            "D": "Gd is the symbol for Gadolinium."
        },
        "concept_id": "chemistry_elements",
        "difficulty_parameter": 0.5,
        "discrimination_parameter": 1.1,
        "tags": ["chemistry", "medium", "periodic_table"]
    },
    {
        "question_text": "What is the derivative of x^2 + 3x + 5?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "2x + 3", "id": "A"},
            {"text": "x + 3", "id": "B"},
            {"text": "2x + 5", "id": "C"},
            {"text": "x^2 + 3", "id": "D"}
        ],
        "correct_answer_id": "A",
        "explanation": "The derivative of x^2 is 2x, the derivative of 3x is 3, and the derivative of 5 is 0.",
        "explanation_for_each_option": {
            "A": "Correct! Using power rule and linearity of differentiation.",
            "B": "This would be the derivative of x^2/2 + 3x.",
            "C": "This misses the derivative of 3x.",
            "D": "This is not applying the power rule correctly."
        },
        "concept_id": "calculus_derivatives",
        "difficulty_parameter": 1.5,
        "discrimination_parameter": 1.3,
        "tags": ["mathematics", "calculus", "derivatives", "hard"]
    },
    {
        "question_text": "Which planet is closest to the Sun?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "Mercury", "id": "A"},
            {"text": "Venus", "id": "B"},
            {"text": "Earth", "id": "C"},
            {"text": "Mars", "id": "D"}
        ],
        "correct_answer_id": "A",
        "explanation": "Mercury is the closest planet to the Sun in our solar system.",
        "explanation_for_each_option": {
            "A": "Correct! Mercury is the first planet from the Sun.",
            "B": "Venus is the second planet from the Sun.",
            "C": "Earth is the third planet from the Sun.",
            "D": "Mars is the fourth planet from the Sun."
        },
        "concept_id": "astronomy_solar_system",
        "difficulty_parameter": -0.8,
        "discrimination_parameter": 1.2,
        "tags": ["astronomy", "easy", "solar_system"]
    },
    {
        "question_text": "What is the photosynthesis equation?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "6CO2 + 6H2O + light → C6H12O6 + 6O2", "id": "A"},
            {"text": "6C6H12O6 + 6O2 → 6CO2 + 6H2O + energy", "id": "B"},
            {"text": "CO2 + H2O → CH4 + O2", "id": "C"},
            {"text": "C6H12O6 → 2C2H5OH + 2CO2", "id": "D"}
        ],
        "correct_answer_id": "A",
        "explanation": "Photosynthesis converts carbon dioxide and water into glucose and oxygen using light energy.",
        "explanation_for_each_option": {
            "A": "Correct! This is the balanced equation for photosynthesis.",
            "B": "This is the equation for cellular respiration.",
            "C": "This is not a valid biological equation.",
            "D": "This is the equation for fermentation."
        },
        "concept_id": "biology_photosynthesis",
        "difficulty_parameter": 0.8,
        "discrimination_parameter": 1.25,
        "tags": ["biology", "medium", "photosynthesis"]
    },
    {
        "question_text": "In what year did the Titanic sink?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "1912", "id": "A"},
            {"text": "1920", "id": "B"},
            {"text": "1905", "id": "C"},
            {"text": "1915", "id": "D"}
        ],
        "correct_answer_id": "A",
        "explanation": "The RMS Titanic sank on April 15, 1912, after hitting an iceberg.",
        "explanation_for_each_option": {
            "A": "Correct! The Titanic sank in 1912.",
            "B": "This is 8 years too late.",
            "C": "This is 7 years too early.",
            "D": "This is 3 years too late."
        },
        "concept_id": "history_maritime",
        "difficulty_parameter": -0.5,
        "discrimination_parameter": 1.1,
        "tags": ["history", "easy", "maritime"]
    },
    {
        "question_text": "What is the smallest prime number?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "2", "id": "A"},
            {"text": "1", "id": "B"},
            {"text": "3", "id": "C"},
            {"text": "0", "id": "D"}
        ],
        "correct_answer_id": "A",
        "explanation": "2 is the smallest and only even prime number.",
        "explanation_for_each_option": {
            "A": "Correct! 2 is the smallest prime number.",
            "B": "1 is not considered a prime number.",
            "C": "3 is a prime number but not the smallest.",
            "D": "0 is not a prime number."
        },
        "concept_id": "mathematics_primes",
        "difficulty_parameter": -1.5,
        "discrimination_parameter": 1.0,
        "tags": ["mathematics", "easy", "primes"]
    },
    {
        "question_text": "Which of these is NOT a noble gas?",
        "question_type": "multiple_choice",
        "options": [
            {"text": "Helium", "id": "A"},
            {"text": "Nitrogen", "id": "B"},
            {"text": "Neon", "id": "C"},
            {"text": "Argon", "id": "D"}
        ],
        "correct_answer_id": "B",
        "explanation": "Nitrogen is not a noble gas. Noble gases include He, Ne, Ar, Kr, Xe, and Rn.",
        "explanation_for_each_option": {
            "A": "Helium is a noble gas.",
            "B": "Correct! Nitrogen is not a noble gas.",
            "C": "Neon is a noble gas.",
            "D": "Argon is a noble gas."
        },
        "concept_id": "chemistry_noble_gases",
        "difficulty_parameter": 0.2,
        "discrimination_parameter": 1.2,
        "tags": ["chemistry", "medium", "periodic_table"]
    },
]


async def seed_questions(db: Session):
    """Add sample questions to the database"""

    # Check if questions already exist
    existing = db.query(QuizQuestion).count()
    if existing > 0:
        print(f"Database already has {existing} questions. Skipping seed.")
        return

    # Get or create default topic
    default_topic = db.query(Topic).filter(
        Topic.name == "General Knowledge"
    ).first()

    if not default_topic:
        default_topic = Topic(
            name="General Knowledge",
            description="A collection of general knowledge questions",
            category="General"
        )
        db.add(default_topic)
        db.commit()

    # Add sample questions
    for q_data in SAMPLE_QUESTIONS:
        question = QuizQuestion(
            topic_id=default_topic.id,
            question_text=q_data["question_text"],
            question_type=q_data["question_type"],
            options=q_data["options"],
            correct_answer_id=q_data["correct_answer_id"],
            explanation=q_data["explanation"],
            explanation_for_each_option=q_data["explanation_for_each_option"],
            concept_id=q_data["concept_id"],
            difficulty_parameter=q_data["difficulty_parameter"],
            discrimination_parameter=q_data["discrimination_parameter"],
            tags=q_data.get("tags", [])
        )
        db.add(question)

    db.commit()
    print(f"Added {len(SAMPLE_QUESTIONS)} sample quiz questions")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        asyncio.run(seed_questions(db))
        print("Quiz questions seeded successfully!")
    except Exception as e:
        print(f"Error seeding questions: {e}")
    finally:
        db.close()
