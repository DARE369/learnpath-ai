"""
AI Tutor Service — Lexi.

Lexi is a Socratic AI tutor specialised in the Nigerian WAEC curriculum.
She guides students to discover answers rather than handing them over directly.

Design principles:
  - Socratic first: ask a guiding question before explaining
  - Context-aware: knows what video/topic the student is currently studying
  - Curriculum-grounded: references actual WAEC syllabus topics
  - Encouraging but honest: never falsely praises wrong answers
  - Concise: 2-4 sentences per turn unless a detailed explanation is essential
  - Cost-optimised: uses Claude Haiku (fast, cheap) for real-time chat
"""

import logging
import uuid
from typing import Dict, List, Optional

import anthropic

from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Lexi, an AI study tutor for LearnPath AI — a learning platform built for Nigerian secondary school students preparing for WAEC and other exams.

YOUR APPROACH — SOCRATIC TUTORING:
1. When a student asks a question, first assess what they already know with a short targeted question.
2. Build on their knowledge with a hint or analogy before giving the answer.
3. Ask them to try the concept themselves.
4. Confirm their understanding.
5. Only give the direct answer if they are genuinely stuck after 2-3 attempts.

Never just solve homework or exam questions for them. Explain principles, not just answers.

YOUR PERSONALITY:
- Warm, encouraging, patient — students should feel safe asking "dumb" questions
- Use simple, clear language appropriate for secondary school level
- Draw analogies to everyday Nigerian life when helpful (e.g., comparing electrical circuits to water pipes, or fractions to sharing food)
- Be honest when an answer is wrong: "Not quite — think about..." not false praise
- Keep responses concise: 2-4 sentences unless a full explanation is genuinely needed

CURRICULUM KNOWLEDGE:
You are deeply familiar with the WAEC syllabus for:
- Mathematics: Circle theorems, quadratic equations, matrices, sequences, trigonometry, mensuration, calculus
- Biology: Cell biology, genetics (Mendel's laws), ecology, reproduction, excretion
- Chemistry: Organic chemistry (benzene, alkenes, esters), periodic table, electrolysis, bonding
- Physics: Electricity, optics, waves, motion (kinematics), magnetism
- Economics: Demand/supply elasticity, national income, market structures
- English Language: Essay types, oral English phonetics, comprehension, concord
- Government: Nigerian constitution (1999), federalism, international organisations
- Commerce: Banking, insurance, business documents, types of trade

COMMON STUDENT STRUGGLES (address these with extra care):
- Why benzene doesn't decolourise bromine water (aromaticity — delocalised electrons)
- Circle theorems (angle at centre = 2× angle at circumference)
- Mendel's dihybrid crosses (9:3:3:1 ratio)
- Matrices: finding inverses
- Electrolysis: discharge of ions at electrodes
- English concord (subject-verb agreement)

RESPONSE FORMAT:
- Do NOT use markdown headers or bullet points in casual conversation — write naturally
- Only use a numbered list or short bullets when giving a step-by-step explanation
- End with a question that checks understanding, unless the student is just saying thank you

IMPORTANT: Never generate exam answers, never write full essays for students, never solve past questions directly."""


class TutorService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-haiku-4-5-20251001"

    # ── Session management ────────────────────────────────────────────────────

    def get_or_create_session(
        self,
        db,
        user_id,
        subject: Optional[str] = None,
        topic_id: Optional[str] = None,
        video_title: Optional[str] = None,
        learning_path_id: Optional[str] = None,
    ) -> str:
        """
        Return an existing open session for this user+context, or create one.
        Returns the session_id as a string.
        """
        from models import TutorSession
        from datetime import datetime, timedelta

        # Reuse a recent session for the same subject/topic (within 2 hours)
        cutoff = datetime.utcnow() - timedelta(hours=2)
        existing = (
            db.query(TutorSession)
            .filter(
                TutorSession.user_id == user_id,
                TutorSession.last_message_at >= cutoff,
                TutorSession.subject == subject,
            )
            .order_by(TutorSession.last_message_at.desc())
            .first()
        )
        if existing:
            return str(existing.id)

        session = TutorSession(
            user_id=user_id,
            subject=subject,
            topic_id=topic_id,
            video_title=video_title,
            learning_path_id=learning_path_id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return str(session.id)

    def get_history(self, db, session_id: str) -> List[Dict]:
        """Return the last 20 messages for context."""
        from models import TutorMessage
        import uuid as _uuid

        try:
            sid = _uuid.UUID(session_id)
        except (ValueError, AttributeError):
            return []

        rows = (
            db.query(TutorMessage)
            .filter(TutorMessage.session_id == sid)
            .order_by(TutorMessage.created_at)
            .limit(20)
            .all()
        )
        return [{"role": r.role, "content": r.content} for r in rows]

    # ── Core chat ─────────────────────────────────────────────────────────────

    async def chat(
        self,
        db,
        user_id,
        session_id: str,
        user_message: str,
        subject: Optional[str] = None,
        topic_title: Optional[str] = None,
        video_title: Optional[str] = None,
    ) -> Dict:
        """
        Send a message to Lexi and get a response.
        Saves both turns to TutorMessage. Returns {session_id, reply, message_count}.
        """
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")

        import uuid as _uuid
        from models import TutorSession, TutorMessage
        from datetime import datetime

        # Load session
        try:
            sid = _uuid.UUID(session_id)
        except (ValueError, AttributeError):
            raise ValueError("Invalid session_id")

        session = db.query(TutorSession).filter(TutorSession.id == sid).first()
        if not session:
            raise ValueError("Session not found")

        # Build context injection for the system prompt
        context_parts = []
        if subject:
            context_parts.append(f"Subject: {subject}")
        if topic_title:
            context_parts.append(f"Current topic: {topic_title}")
        if video_title:
            context_parts.append(f"Currently watching: \"{video_title}\"")
        context_note = (
            "\n\nCURRENT STUDY CONTEXT:\n" + "\n".join(context_parts)
            if context_parts else ""
        )

        system = SYSTEM_PROMPT + context_note

        # Build message history for the API call
        history = self.get_history(db, session_id)
        messages = history + [{"role": "user", "content": user_message.strip()}]

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        response = await client.messages.create(
            model=self.model,
            max_tokens=500,
            system=system,
            messages=messages,
        )
        reply = response.content[0].text.strip()

        # Persist both turns
        db.add(TutorMessage(session_id=sid, role="user", content=user_message.strip()))
        db.add(TutorMessage(session_id=sid, role="assistant", content=reply))

        session.message_count = (session.message_count or 0) + 2
        session.last_message_at = datetime.utcnow()
        db.commit()

        return {
            "session_id": session_id,
            "reply": reply,
            "message_count": session.message_count,
        }


tutor_service = TutorService()
