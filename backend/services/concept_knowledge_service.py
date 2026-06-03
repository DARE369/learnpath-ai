"""
Concept knowledge graph (NEW-PACKET-G).

Persistent graph of concepts + relationships. Concepts are seeded from the
data the platform already produces (quiz question concept_ids, ConceptMastery,
ConceptProgress); relationships are inferred from name-token similarity +
difficulty. User mastery is read from the existing ConceptMastery table, joined
by concept_name == ConceptMastery.concept_id. Graph traversal is done with
plain queries (no NetworkX dependency).

Note: relationship inference is heuristic (name similarity). It bootstraps a
usable graph; high-precision edges would come from Claude/content analysis.
"""

import logging
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from models import (
    Concept, ConceptRelationship, ConceptMastery, ConceptProgress, QuizQuestion,
)

logger = logging.getLogger(__name__)

REQUIRED_MASTERY = 80


def _prettify(name: str) -> str:
    return (name or "").replace("_", " ").replace("-", " ").strip().title() or "Concept"


def _tokens(name: str) -> set:
    return {t for t in (name or "").lower().replace("-", "_").split("_") if len(t) > 2}


class ConceptKnowledgeService:

    # ── seeding ────────────────────────────────────────────────────────────--

    def seed_from_existing(self, db: Session) -> int:
        """Create Concept rows from concept identifiers already in the platform."""
        names = set()
        for (cid,) in db.query(QuizQuestion.concept_id).distinct().all():
            if cid:
                names.add(str(cid).strip().lower())
        for (cid,) in db.query(ConceptMastery.concept_id).distinct().all():
            if cid:
                names.add(str(cid).strip().lower())
        for (cname,) in db.query(ConceptProgress.concept_name).distinct().all():
            if cname:
                names.add(str(cname).strip().lower().replace(" ", "_"))

        existing = {c.concept_name for c in db.query(Concept.concept_name).all()}
        added = 0
        for name in names:
            if not name or name in existing:
                continue
            db.add(Concept(
                concept_name=name,
                display_name=_prettify(name),
                difficulty_level=5,
                created_by="system",
            ))
            added += 1
        if added:
            db.commit()
        return added

    def infer_relationships(self, db: Session, threshold: float = 0.34) -> int:
        """Create edges between token-similar concepts (idempotent-ish)."""
        concepts = db.query(Concept).all()
        existing_pairs = {
            (str(r.source_concept_id), str(r.target_concept_id))
            for r in db.query(
                ConceptRelationship.source_concept_id, ConceptRelationship.target_concept_id
            ).all()
        }
        added = 0
        for i, a in enumerate(concepts):
            ta = _tokens(a.concept_name)
            if not ta:
                continue
            for b in concepts[i + 1:]:
                tb = _tokens(b.concept_name)
                if not tb:
                    continue
                jac = len(ta & tb) / len(ta | tb)
                if jac < threshold:
                    continue
                # Lower difficulty is the prerequisite of the higher one.
                if (a.difficulty_level or 5) < (b.difficulty_level or 5):
                    src, tgt, rtype = b.id, a.id, "prerequisite"
                elif (a.difficulty_level or 5) > (b.difficulty_level or 5):
                    src, tgt, rtype = a.id, b.id, "prerequisite"
                else:
                    src, tgt, rtype = a.id, b.id, "related"
                if (str(src), str(tgt)) in existing_pairs:
                    continue
                db.add(ConceptRelationship(
                    source_concept_id=src, target_concept_id=tgt,
                    relationship_type=rtype, strength=round(min(1.0, jac + 0.3), 2),
                ))
                existing_pairs.add((str(src), str(tgt)))
                added += 1
        if added:
            db.commit()
        return added

    # ── queries ──────────────────────────────────────────────────────────────

    def list_concepts(self, db: Session, q: str = "", limit: int = 200) -> List[dict]:
        query = db.query(Concept)
        if q:
            query = query.filter(Concept.concept_name.ilike(f"%{q.lower()}%"))
        rows = query.order_by(Concept.display_name).limit(limit).all()
        return [self._node(c) for c in rows]

    def _node(self, c: Concept) -> dict:
        return {
            "id": str(c.id),
            "concept_name": c.concept_name,
            "display_name": c.display_name or _prettify(c.concept_name),
            "subject": c.subject,
            "topic": c.topic,
            "difficulty": c.difficulty_level,
        }

    def _get(self, db: Session, concept_id: str) -> Optional[Concept]:
        return db.query(Concept).filter(Concept.id == concept_id).first()

    def _user_mastery(self, db: Session, user_id, concept_name: str) -> Optional[int]:
        if not user_id:
            return None
        m = (
            db.query(ConceptMastery)
            .filter(ConceptMastery.user_id == user_id, ConceptMastery.concept_id == concept_name)
            .first()
        )
        return int(m.accuracy_percent) if m else None

    def prerequisites(self, db: Session, concept: Concept, user_id=None) -> Dict:
        """Prerequisites of a concept (edges where this concept is the source)."""
        rels = (
            db.query(ConceptRelationship)
            .filter(
                ConceptRelationship.source_concept_id == concept.id,
                ConceptRelationship.relationship_type == "prerequisite",
            )
            .all()
        )
        items = []
        for r in rels:
            pre = self._get(db, str(r.target_concept_id))
            if not pre:
                continue
            mastery = self._user_mastery(db, user_id, pre.concept_name)
            items.append({
                **self._node(pre),
                "required_mastery": REQUIRED_MASTERY,
                "user_mastery": mastery,
                "is_met": mastery is not None and mastery >= REQUIRED_MASTERY,
            })
        met = [p for p in items if p["user_mastery"] is not None]
        return {
            "concept_id": str(concept.id),
            "concept_name": concept.display_name,
            "prerequisites": items,
            "all_prerequisites_met": bool(items) and all(p["is_met"] for p in met) if met else not items,
        }

    def gaps(self, db: Session, concept: Concept, user_id) -> Dict:
        pre = self.prerequisites(db, concept, user_id)
        unmet = [p for p in pre["prerequisites"] if not p["is_met"]]
        gaps = []
        for g in unmet:
            est = round((g["difficulty"] or 5) / 3 * 2, 1)
            gaps.append({
                **g,
                "gap_size": REQUIRED_MASTERY - (g["user_mastery"] or 0),
                "estimated_learning_hours": est,
            })
        gaps.sort(key=lambda x: x["gap_size"], reverse=True)
        return {
            "target_concept": concept.display_name,
            "gaps": gaps,
            "total_learning_hours": round(sum(g["estimated_learning_hours"] for g in gaps), 1),
            "ready_to_learn": len(gaps) == 0,
        }

    def related(self, db: Session, concept: Concept) -> List[dict]:
        rels = (
            db.query(ConceptRelationship)
            .filter(
                ConceptRelationship.source_concept_id == concept.id,
                ConceptRelationship.relationship_type != "prerequisite",
            )
            .all()
        )
        out = []
        for r in rels:
            t = self._get(db, str(r.target_concept_id))
            if t:
                out.append({**self._node(t), "relationship": r.relationship_type})
        return out

    def resources(self, db: Session, concept: Concept) -> Dict:
        quiz_count = (
            db.query(QuizQuestion).filter(QuizQuestion.concept_id == concept.concept_name).count()
        )
        return {"quiz_questions": quiz_count}

    def graph(self, db: Session, center_id: str = None, depth: int = 2) -> Dict:
        """Nodes + edges for visualization. Centered BFS when center_id given."""
        all_rels = db.query(ConceptRelationship).all()
        adj: Dict[str, List[str]] = {}
        for r in all_rels:
            adj.setdefault(str(r.source_concept_id), []).append(str(r.target_concept_id))
            adj.setdefault(str(r.target_concept_id), []).append(str(r.source_concept_id))

        if center_id:
            seen = {center_id}
            frontier = [center_id]
            for _ in range(max(1, depth)):
                nxt = []
                for n in frontier:
                    for m in adj.get(n, []):
                        if m not in seen:
                            seen.add(m)
                            nxt.append(m)
                frontier = nxt
            node_ids = seen
        else:
            node_ids = {str(c.id) for c in db.query(Concept.id).limit(200).all()}

        nodes = []
        for cid in node_ids:
            c = self._get(db, cid)
            if c:
                nodes.append({**self._node(c), "size": 20 + (c.difficulty_level or 5) * 4})
        edges = [
            {
                "source": str(r.source_concept_id),
                "target": str(r.target_concept_id),
                "type": r.relationship_type,
                "strength": r.strength,
            }
            for r in all_rels
            if str(r.source_concept_id) in node_ids and str(r.target_concept_id) in node_ids
        ]
        return {"nodes": nodes, "edges": edges}


concept_knowledge_service = ConceptKnowledgeService()
