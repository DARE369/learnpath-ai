"""
WAEC Curriculum Service.

Loads the curriculum JSON from backend/data/waec_curriculum.json and seeds
the waec_subjects + waec_topics tables on first run. Provides query helpers
used by the diagnostic, tutor and readiness services.
"""

import json
import logging
import os
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_CURRICULUM_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "waec_curriculum.json")


def _load_json() -> dict:
    with open(_CURRICULUM_PATH, encoding="utf-8") as f:
        return json.load(f)


class CurriculumService:

    # ── Seeding ───────────────────────────────────────────────────────────────

    def seed(self, db: Session) -> int:
        """
        Seed waec_subjects and waec_topics from the JSON file.
        Idempotent — skips rows that already exist. Returns count of new rows.
        """
        from models import WAECSubject, WAECTopic

        data = _load_json()
        created = 0

        for subj in data.get("subjects", []):
            sid = subj["id"]
            if not db.query(WAECSubject).filter(WAECSubject.id == sid).first():
                db.add(WAECSubject(
                    id=sid,
                    name=subj["name"],
                    code=subj["code"],
                    category=subj["category"],
                    description=subj.get("description", ""),
                ))
                created += 1

            for topic in subj.get("topics", []):
                tid = topic["id"]
                if not db.query(WAECTopic).filter(WAECTopic.id == tid).first():
                    db.add(WAECTopic(
                        id=tid,
                        subject_id=sid,
                        title=topic["title"],
                        ss_level=topic["ss_level"],
                        order=topic.get("order", 0),
                        exam_weight=topic.get("exam_weight", 5),
                        description=topic.get("description", ""),
                        subtopics=topic.get("subtopics", []),
                    ))
                    created += 1

        db.commit()
        if created:
            logger.info(f"Curriculum seeded: {created} new rows")
        return created

    # ── Queries ───────────────────────────────────────────────────────────────

    def get_subjects(self, db: Session) -> List[Dict]:
        from models import WAECSubject
        rows = db.query(WAECSubject).order_by(WAECSubject.name).all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "code": r.code,
                "category": r.category,
                "description": r.description,
            }
            for r in rows
        ]

    def get_subject(self, db: Session, subject_id: str) -> Optional[Dict]:
        from models import WAECSubject
        r = db.query(WAECSubject).filter(WAECSubject.id == subject_id).first()
        if not r:
            return None
        return {"id": r.id, "name": r.name, "code": r.code, "category": r.category, "description": r.description}

    def get_topics(self, db: Session, subject_id: str, ss_level: Optional[str] = None) -> List[Dict]:
        from models import WAECTopic
        q = db.query(WAECTopic).filter(WAECTopic.subject_id == subject_id)
        if ss_level:
            q = q.filter(WAECTopic.ss_level.in_([ss_level, "ALL"]))
        rows = q.order_by(WAECTopic.order).all()
        return [
            {
                "id": r.id,
                "subject_id": r.subject_id,
                "title": r.title,
                "ss_level": r.ss_level,
                "order": r.order,
                "exam_weight": r.exam_weight,
                "description": r.description,
                "subtopics": r.subtopics or [],
            }
            for r in rows
        ]

    def get_topic(self, db: Session, topic_id: str) -> Optional[Dict]:
        from models import WAECTopic
        r = db.query(WAECTopic).filter(WAECTopic.id == topic_id).first()
        if not r:
            return None
        return {
            "id": r.id, "subject_id": r.subject_id, "title": r.title,
            "ss_level": r.ss_level, "exam_weight": r.exam_weight,
            "description": r.description, "subtopics": r.subtopics or [],
        }

    def get_topics_dict(self, db: Session, subject_id: str) -> Dict[str, Dict]:
        """Return topics keyed by ID — used by diagnostic and readiness services."""
        return {t["id"]: t for t in self.get_topics(db, subject_id)}

    def subject_name(self, db: Session, subject_id: str) -> str:
        s = self.get_subject(db, subject_id)
        return s["name"] if s else subject_id

    def topics_as_prompt_list(self, db: Session, subject_id: str, ss_level: Optional[str] = None) -> str:
        """Return topics formatted for injection into an LLM prompt."""
        topics = self.get_topics(db, subject_id, ss_level)
        lines = []
        for t in topics:
            subs = ", ".join(t["subtopics"][:4]) if t["subtopics"] else ""
            lines.append(f"- {t['title']} [{t['id']}]: {subs}")
        return "\n".join(lines)


curriculum_service = CurriculumService()
