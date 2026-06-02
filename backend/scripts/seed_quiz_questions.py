"""
Manually seed sample quiz questions into the database.

The same seeding now also runs automatically on backend startup (see
jobs/quiz_seed.py, wired into main.py's lifespan). This script is kept for
ad-hoc/local use and simply delegates to that shared, idempotent seeder, so
there is a single source of truth for the question bank.

Usage:
    python scripts/seed_quiz_questions.py
"""

from jobs.quiz_seed import seed_quiz_questions_if_empty

if __name__ == "__main__":
    inserted = seed_quiz_questions_if_empty()
    if inserted:
        print(f"Quiz questions seeded successfully! Added {inserted} questions.")
    else:
        print("Quiz questions already present (or seeding failed) — nothing added.")
