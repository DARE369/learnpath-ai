"""
Concept knowledge graph endpoints (NEW-PACKET-G).

Mounted at /api/knowledge — the legacy stateless concept extractor already owns
/api/concepts, so the persistent graph lives under its own prefix.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, Concept
from routers.auth import get_current_user, require_admin
from services.concept_knowledge_service import concept_knowledge_service as svc

router = APIRouter(prefix="/api/knowledge", tags=["knowledge-graph"])


def _require_concept(concept_id: str, db: Session) -> Concept:
    c = db.query(Concept).filter(Concept.id == concept_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Concept not found")
    return c


@router.get("/concepts")
def list_concepts(
    q: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"concepts": svc.list_concepts(db, q)}


@router.get("/concepts/{concept_id}")
def get_concept(
    concept_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    concept = _require_concept(concept_id, db)
    return {
        "concept": svc._node(concept),
        "prerequisites": svc.prerequisites(db, concept, current_user.id),
        "gaps": svc.gaps(db, concept, current_user.id),
        "related": svc.related(db, concept),
        "resources": svc.resources(db, concept),
    }


@router.get("/concepts/{concept_id}/prerequisites")
def get_prerequisites(
    concept_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.prerequisites(db, _require_concept(concept_id, db), current_user.id)


@router.get("/concepts/{concept_id}/gaps")
def get_gaps(
    concept_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.gaps(db, _require_concept(concept_id, db), current_user.id)


@router.get("/graph")
def get_graph(
    center: str = None,
    depth: int = 2,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.graph(db, center, depth)


# ── admin: bootstrap the graph from existing data ──────────────────────────--

@router.post("/seed")
async def seed(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    added = svc.seed_from_existing(db)
    # Prefer Claude-inferred edges; fall back to name-similarity heuristic.
    rels = await svc.infer_relationships_claude(db)
    method = "claude"
    if rels == 0:
        rels = svc.infer_relationships(db)
        method = "heuristic"
    return {"concepts_added": added, "relationships_added": rels, "relationship_method": method}
