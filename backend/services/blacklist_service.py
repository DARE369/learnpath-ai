"""
Blacklist service (Packet 3.2).

Two flavours:
  - soft: hidden for 90 days, then re-evaluated against current EQS
  - hard: permanent, never re-evaluated, never shadow-tested

Auto-trigger: SearchService writes soft-blacklist rows after EQS scoring
when score < 65. Pre-filter step in SearchService skips already-blacklisted
youtube_ids so we don't waste Claude tokens re-scoring them.

Shadow testing: a deterministic 1-in-10 slice of logged-in users sees
soft-blacklisted videos and is asked for feedback. Hard blacklists are
never shadow-tested.
"""

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SOFT_BLACKLIST_THRESHOLD = 65
SOFT_RETRY_DAYS = 90
SHADOW_TEST_DENOMINATOR = 10
REEVAL_CHARGE_NGN = 0.10  # rough per-row EQS rescore cost


class BlacklistService:
    """All operations require an active SQLAlchemy session — keys on youtube_id."""

    # ------------------------------------------------------------------
    # Core ops
    # ------------------------------------------------------------------

    def blacklist_video(
        self,
        db: Session,
        youtube_id: str,
        reason: str,
        blacklist_type: str = "soft",
        last_score: Optional[int] = None,
    ) -> Dict:
        """
        Create or refresh a blacklist row for a youtube_id.
        Idempotent: an existing active row of the same type is reused
        (retry_date is bumped forward for soft).
        """
        from models import VideoBlacklist

        if blacklist_type not in ("soft", "hard"):
            raise ValueError(f"Invalid blacklist_type: {blacklist_type}")

        now = datetime.utcnow()
        retry_date = (
            now + timedelta(days=SOFT_RETRY_DAYS) if blacklist_type == "soft" else None
        )

        existing = (
            db.query(VideoBlacklist)
            .filter(
                VideoBlacklist.youtube_id == youtube_id,
                VideoBlacklist.is_active.is_(True),
            )
            .first()
        )

        if existing:
            existing.blacklist_type = blacklist_type
            existing.reason = reason
            existing.last_score = last_score if last_score is not None else existing.last_score
            existing.blacklist_date = now
            existing.retry_date = retry_date
            existing.updated_at = now
            row = existing
        else:
            row = VideoBlacklist(
                youtube_id=youtube_id,
                blacklist_type=blacklist_type,
                reason=reason,
                last_score=last_score,
                blacklist_date=now,
                retry_date=retry_date,
                is_active=True,
            )
            db.add(row)

        db.commit()
        logger.info(
            f"Blacklisted {youtube_id} ({blacklist_type}): {reason} "
            f"(retry_date={retry_date.isoformat() if retry_date else 'never'})"
        )
        return {
            "youtube_id": youtube_id,
            "blacklist_type": blacklist_type,
            "blacklist_date": row.blacklist_date.isoformat(),
            "retry_date": row.retry_date.isoformat() if row.retry_date else None,
        }

    def remove_blacklist(self, db: Session, youtube_id: str) -> bool:
        """Lift any active blacklist for this youtube_id. Returns True if a row was lifted."""
        from models import VideoBlacklist
        rows = (
            db.query(VideoBlacklist)
            .filter(
                VideoBlacklist.youtube_id == youtube_id,
                VideoBlacklist.is_active.is_(True),
            )
            .all()
        )
        if not rows:
            return False
        for r in rows:
            r.is_active = False
            r.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"Blacklist lifted: {youtube_id}")
        return True

    def convert_type(
        self,
        db: Session,
        youtube_id: str,
        new_type: str,
        reason: Optional[str] = None,
    ) -> Dict:
        """
        Convert soft↔hard for the active blacklist row. Soft→hard clears retry_date;
        hard→soft sets a fresh retry_date. Raises if no active row.
        """
        from models import VideoBlacklist
        if new_type not in ("soft", "hard"):
            raise ValueError(f"Invalid blacklist_type: {new_type}")

        row = (
            db.query(VideoBlacklist)
            .filter(
                VideoBlacklist.youtube_id == youtube_id,
                VideoBlacklist.is_active.is_(True),
            )
            .first()
        )
        if row is None:
            raise ValueError(f"No active blacklist for {youtube_id}")

        row.blacklist_type = new_type
        if reason:
            row.reason = reason
        if new_type == "hard":
            row.retry_date = None
        else:
            row.retry_date = datetime.utcnow() + timedelta(days=SOFT_RETRY_DAYS)
        row.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"Blacklist converted: {youtube_id} → {new_type}")
        return {
            "youtube_id": youtube_id,
            "blacklist_type": row.blacklist_type,
            "retry_date": row.retry_date.isoformat() if row.retry_date else None,
        }

    # ------------------------------------------------------------------
    # Status checks
    # ------------------------------------------------------------------

    def is_blacklisted(self, db: Session, youtube_id: str) -> bool:
        """
        True if the video is currently blacklisted. Soft blacklists past
        retry_date return False — caller should re-evaluate.
        """
        from models import VideoBlacklist
        row = (
            db.query(VideoBlacklist)
            .filter(
                VideoBlacklist.youtube_id == youtube_id,
                VideoBlacklist.is_active.is_(True),
            )
            .first()
        )
        if row is None:
            return False
        if row.blacklist_type == "hard":
            return True
        # soft
        if row.retry_date is None:
            return True
        return datetime.utcnow() < row.retry_date

    def get_status(self, db: Session, youtube_id: str) -> Dict:
        from models import VideoBlacklist
        row = (
            db.query(VideoBlacklist)
            .filter(
                VideoBlacklist.youtube_id == youtube_id,
                VideoBlacklist.is_active.is_(True),
            )
            .first()
        )
        if row is None:
            return {"is_blacklisted": False}
        active = self.is_blacklisted(db, youtube_id)
        return {
            "is_blacklisted": active,
            "blacklist_type": row.blacklist_type,
            "reason": row.reason,
            "last_score": row.last_score,
            "blacklist_date": row.blacklist_date.isoformat(),
            "retry_date": row.retry_date.isoformat() if row.retry_date else None,
            "expired": (
                row.blacklist_type == "soft"
                and row.retry_date is not None
                and datetime.utcnow() >= row.retry_date
            ),
        }

    def filter_blacklisted(self, db: Session, youtube_ids: List[str]) -> List[str]:
        """Return the subset that is NOT currently blacklisted."""
        if not youtube_ids:
            return []
        from models import VideoBlacklist
        rows = (
            db.query(VideoBlacklist)
            .filter(
                VideoBlacklist.youtube_id.in_(youtube_ids),
                VideoBlacklist.is_active.is_(True),
            )
            .all()
        )
        now = datetime.utcnow()
        blocked = {
            r.youtube_id for r in rows
            if r.blacklist_type == "hard"
            or r.retry_date is None
            or now < r.retry_date
        }
        return [yt for yt in youtube_ids if yt not in blocked]

    # ------------------------------------------------------------------
    # Shadow testing
    # ------------------------------------------------------------------

    def should_shadow_test(self, user_id: Optional[str]) -> bool:
        """Deterministic 1-in-10 slice keyed on user_id. Anonymous users always False."""
        if not user_id:
            return False
        digest = hashlib.sha256(str(user_id).encode()).hexdigest()
        bucket = int(digest[:8], 16) % SHADOW_TEST_DENOMINATOR
        return bucket == 0

    # ------------------------------------------------------------------
    # Auto / re-evaluation
    # ------------------------------------------------------------------

    def auto_blacklist_low_scores(
        self,
        db: Session,
        score_threshold: int = SOFT_BLACKLIST_THRESHOLD,
    ) -> Dict:
        """
        Batch backfill: scan video_scores for any youtube_id whose latest score
        falls below the threshold and is not already blacklisted; create a soft
        blacklist row for each. Returns counts.
        """
        from models import VideoBlacklist, VideoScore, Video

        # Pull (youtube_id, score) pairs by joining videos → video_scores. Skip
        # any youtube_id already on the active blacklist.
        active_ids = {
            r.youtube_id
            for r in db.query(VideoBlacklist.youtube_id)
            .filter(VideoBlacklist.is_active.is_(True))
            .all()
        }

        # Latest score per video (greatest-N-per-group surrogate: take min
        # score per video; if any score is below threshold we want to flag it).
        rows = (
            db.query(Video.youtube_id, func.min(VideoScore.score).label("min_score"))
            .join(VideoScore, VideoScore.video_id == Video.id)
            .filter(VideoScore.is_valid.is_(True))
            .group_by(Video.youtube_id)
            .all()
        )

        created = 0
        for youtube_id, min_score in rows:
            if youtube_id in active_ids:
                continue
            if min_score is None or min_score >= score_threshold:
                continue
            self.blacklist_video(
                db,
                youtube_id=youtube_id,
                reason=f"Auto-blacklist: EQS {min_score} < {score_threshold}",
                blacklist_type="soft",
                last_score=int(min_score),
            )
            created += 1
        logger.info(f"auto_blacklist_low_scores: created {created} rows")
        return {"created": created, "scanned": len(rows)}

    def expired_soft_blacklists(self, db: Session, limit: int = 100) -> List:
        """Return active soft-blacklist rows whose retry_date has passed."""
        from models import VideoBlacklist
        now = datetime.utcnow()
        return (
            db.query(VideoBlacklist)
            .filter(
                VideoBlacklist.is_active.is_(True),
                VideoBlacklist.blacklist_type == "soft",
                VideoBlacklist.retry_date.isnot(None),
                VideoBlacklist.retry_date <= now,
            )
            .limit(limit)
            .all()
        )

    async def re_evaluate_blacklist(
        self,
        db: Session,
        eqs_service,
        limit: int = 100,
    ) -> Dict:
        """
        Re-score every expired soft blacklist via EQS. Lift if score ≥ 65,
        extend retry_date by 90 days if still < 65. Budget-gated through
        cost_tracker — stops early when budget is exhausted.
        """
        from services.cost_tracker import cost_tracker, BudgetExceeded

        expired = self.expired_soft_blacklists(db, limit=limit)
        lifted = 0
        extended = 0
        skipped_budget = 0
        errors = 0

        for row in expired:
            try:
                cost_tracker.charge("blacklist_reeval", REEVAL_CHARGE_NGN)
            except BudgetExceeded:
                skipped_budget = len(expired) - (lifted + extended + errors)
                logger.warning("blacklist_reeval budget exhausted — stopping batch")
                break

            try:
                result = await eqs_service.score_video(
                    youtube_id=row.youtube_id,
                    title=f"[re-eval] {row.youtube_id}",
                    transcript=None,
                    description=None,
                )
                new_score = int(result.get("score") or 0)
            except Exception as e:
                logger.warning(f"Re-eval EQS failed for {row.youtube_id}: {e}")
                errors += 1
                continue

            now = datetime.utcnow()
            row.last_score = new_score
            row.updated_at = now
            if new_score >= SOFT_BLACKLIST_THRESHOLD:
                row.is_active = False
                lifted += 1
                logger.info(f"Re-eval LIFTED {row.youtube_id} (score {new_score})")
            else:
                row.retry_date = now + timedelta(days=SOFT_RETRY_DAYS)
                row.reason = f"Re-eval: still low (EQS {new_score})"
                extended += 1
                logger.info(f"Re-eval EXTENDED {row.youtube_id} (score {new_score})")

        db.commit()
        return {
            "evaluated": lifted + extended + errors,
            "lifted": lifted,
            "extended": extended,
            "errors": errors,
            "skipped_budget": skipped_budget,
            "total_expired": len(expired),
        }

    # ------------------------------------------------------------------
    # Feedback (shadow testing)
    # ------------------------------------------------------------------

    def submit_feedback(
        self,
        db: Session,
        youtube_id: str,
        rating: int,
        feedback: Optional[str] = None,
        helpful: Optional[bool] = None,
        user_id: Optional[str] = None,
    ) -> Dict:
        from models import BlacklistFeedback
        import uuid as _uuid

        if not (1 <= rating <= 5):
            raise ValueError("rating must be in [1, 5]")

        user_uuid = None
        if user_id:
            try:
                user_uuid = _uuid.UUID(str(user_id))
            except (ValueError, TypeError):
                user_uuid = None  # accept anonymous / non-UUID gracefully

        row = BlacklistFeedback(
            youtube_id=youtube_id,
            user_id=user_uuid,
            rating=rating,
            feedback=feedback,
            helpful=helpful,
        )
        db.add(row)
        db.commit()
        return {"id": str(row.id), "youtube_id": youtube_id, "rating": rating}

    def feedback_aggregates(self, db: Session, youtube_ids: List[str]) -> Dict[str, Dict]:
        """Return {youtube_id: {avg_rating, count}} for the given ids."""
        if not youtube_ids:
            return {}
        from models import BlacklistFeedback
        rows = (
            db.query(
                BlacklistFeedback.youtube_id,
                func.avg(BlacklistFeedback.rating).label("avg_rating"),
                func.count(BlacklistFeedback.id).label("count"),
            )
            .filter(BlacklistFeedback.youtube_id.in_(youtube_ids))
            .group_by(BlacklistFeedback.youtube_id)
            .all()
        )
        return {
            r.youtube_id: {
                "avg_rating": round(float(r.avg_rating), 2) if r.avg_rating else None,
                "count": int(r.count),
            }
            for r in rows
        }

    # ------------------------------------------------------------------
    # Listing / stats
    # ------------------------------------------------------------------

    def list_blacklist(
        self,
        db: Session,
        blacklist_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict]:
        from models import VideoBlacklist
        q = db.query(VideoBlacklist).filter(VideoBlacklist.is_active.is_(True))
        if blacklist_type in ("soft", "hard"):
            q = q.filter(VideoBlacklist.blacklist_type == blacklist_type)
        rows = (
            q.order_by(VideoBlacklist.blacklist_date.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )
        ids = [r.youtube_id for r in rows]
        aggregates = self.feedback_aggregates(db, ids)
        now = datetime.utcnow()
        return [
            {
                "id": str(r.id),
                "youtube_id": r.youtube_id,
                "blacklist_type": r.blacklist_type,
                "reason": r.reason,
                "last_score": r.last_score,
                "blacklist_date": r.blacklist_date.isoformat(),
                "retry_date": r.retry_date.isoformat() if r.retry_date else None,
                "expired": (
                    r.blacklist_type == "soft"
                    and r.retry_date is not None
                    and now >= r.retry_date
                ),
                "feedback_avg_rating": aggregates.get(r.youtube_id, {}).get("avg_rating"),
                "feedback_count": aggregates.get(r.youtube_id, {}).get("count", 0),
            }
            for r in rows
        ]

    def stats(self, db: Session) -> Dict:
        from models import VideoBlacklist, BlacklistFeedback
        now = datetime.utcnow()
        active = db.query(VideoBlacklist).filter(VideoBlacklist.is_active.is_(True))
        total = active.count()
        soft = active.filter(VideoBlacklist.blacklist_type == "soft").count()
        hard = active.filter(VideoBlacklist.blacklist_type == "hard").count()
        pending = (
            active.filter(
                VideoBlacklist.blacklist_type == "soft",
                VideoBlacklist.retry_date.isnot(None),
                VideoBlacklist.retry_date <= now,
            ).count()
        )
        avg_rating = (
            db.query(func.avg(BlacklistFeedback.rating)).scalar()
        )
        feedback_count = db.query(BlacklistFeedback).count()
        return {
            "total_active": total,
            "soft": soft,
            "hard": hard,
            "pending_re_evaluation": pending,
            "feedback_count": feedback_count,
            "feedback_avg_rating": round(float(avg_rating), 2) if avg_rating else None,
        }


blacklist_service = BlacklistService()
