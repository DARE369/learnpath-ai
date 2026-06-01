"""
Analytics computation service (Packet 4.5).

Derives all metrics from the existing event tables — no separate analytics
table is needed. Results are held in a process-level TTL cache (same in-memory
soft-fence pattern as cost_tracker / rate_limiting_service).

All public methods are synchronous and accept a SQLAlchemy Session; they can
safely be called from both sync and async FastAPI routes. Callers must wrap
them in try/except and return graceful zeros on DB errors so the admin dashboard
never 500s.

Cache TTLs:
  user analytics         60 s  (personal, changes often)
  platform/revenue/churn 300 s (admin, acceptable 5-min lag)
  cohorts / engagement   900 s (computed from big joins, expensive)
"""

import logging
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# In-memory TTL cache
# ──────────────────────────────────────────────────────────────────────────────

_cache: Dict[str, tuple] = {}  # key -> (expires_at_monotonic, value)
_cache_lock = threading.Lock()


def _cached_get(key: str) -> Optional[Any]:
    with _cache_lock:
        entry = _cache.get(key)
        if entry and entry[0] > time.monotonic():
            return entry[1]
    return None


def _cached_set(key: str, value: Any, ttl: int) -> None:
    with _cache_lock:
        _cache[key] = (time.monotonic() + ttl, value)


# ──────────────────────────────────────────────────────────────────────────────
# AnalyticsService
# ──────────────────────────────────────────────────────────────────────────────

class AnalyticsService:

    # ── User analytics ────────────────────────────────────────────────────────

    def get_user_analytics(self, db: Session, user_id) -> Dict:
        """Personal analytics for a single user."""
        key = f"user:{user_id}"
        cached = _cached_get(key)
        if cached:
            return cached
        result = self._compute_user_analytics(db, user_id)
        _cached_set(key, result, ttl=60)
        return result

    def _compute_user_analytics(self, db: Session, user_id) -> Dict:
        from sqlalchemy import func
        from models import PathSession, QuestionAnswer, ConceptProgress

        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        try:
            # Videos
            total_videos = db.query(func.count(PathSession.id)).filter(
                PathSession.user_id == user_id,
                PathSession.video_watched.is_(True),
            ).scalar() or 0

            videos_month = db.query(func.count(PathSession.id)).filter(
                PathSession.user_id == user_id,
                PathSession.video_watched.is_(True),
                PathSession.started_at >= month_start,
            ).scalar() or 0

            # Hours
            total_seconds = db.query(
                func.coalesce(func.sum(PathSession.total_watch_time_seconds), 0)
            ).filter(PathSession.user_id == user_id).scalar() or 0

            month_seconds = db.query(
                func.coalesce(func.sum(PathSession.total_watch_time_seconds), 0)
            ).filter(
                PathSession.user_id == user_id,
                PathSession.started_at >= month_start,
            ).scalar() or 0

            # Questions
            total_q = db.query(func.count(QuestionAnswer.id)).filter(
                QuestionAnswer.user_id == user_id
            ).scalar() or 0

            correct_q = db.query(func.count(QuestionAnswer.id)).filter(
                QuestionAnswer.user_id == user_id,
                QuestionAnswer.is_correct.is_(True),
            ).scalar() or 0

            accuracy = round((correct_q / total_q * 100) if total_q > 0 else 0.0, 1)

            # Concepts mastered
            concepts = db.query(func.count(ConceptProgress.id)).filter(
                ConceptProgress.user_id == user_id,
                ConceptProgress.status == "mastered",
            ).scalar() or 0

            # Days active (distinct days with any session in last 90 days)
            ninety_ago = now - timedelta(days=90)
            sessions = (
                db.query(PathSession.started_at)
                .filter(
                    PathSession.user_id == user_id,
                    PathSession.started_at >= ninety_ago,
                )
                .all()
            )
            active_days = len({s.started_at.date() for s in sessions if s.started_at})

            # Learning velocity (videos/day over last 30 days)
            thirty_ago = now - timedelta(days=30)
            videos_30d = db.query(func.count(PathSession.id)).filter(
                PathSession.user_id == user_id,
                PathSession.video_watched.is_(True),
                PathSession.started_at >= thirty_ago,
            ).scalar() or 0
            velocity = round(videos_30d / 30.0, 3)

            # Last active
            last_session = (
                db.query(func.max(PathSession.started_at))
                .filter(PathSession.user_id == user_id)
                .scalar()
            )

        except Exception as e:
            logger.warning(f"user analytics query error for {user_id}: {e}")
            return self._zero_user_analytics()

        return {
            "videos_watched_total": total_videos,
            "videos_watched_this_month": videos_month,
            "hours_learned_total": round(total_seconds / 3600.0, 1),
            "hours_learned_this_month": round(month_seconds / 3600.0, 1),
            "concepts_mastered": concepts,
            "questions_answered": total_q,
            "questions_correct": correct_q,
            "accuracy_percentage": accuracy,
            "learning_velocity": velocity,
            "days_active": active_days,
            "last_active": last_session.isoformat() if last_session else None,
        }

    @staticmethod
    def _zero_user_analytics() -> Dict:
        return {
            "videos_watched_total": 0, "videos_watched_this_month": 0,
            "hours_learned_total": 0.0, "hours_learned_this_month": 0.0,
            "concepts_mastered": 0, "questions_answered": 0,
            "questions_correct": 0, "accuracy_percentage": 0.0,
            "learning_velocity": 0.0, "days_active": 0, "last_active": None,
        }

    # ── Platform metrics ──────────────────────────────────────────────────────

    def get_platform_metrics(self, db: Session) -> Dict:
        key = "platform"
        cached = _cached_get(key)
        if cached:
            return cached
        result = self._compute_platform_metrics(db)
        _cached_set(key, result, ttl=300)
        return result

    def _compute_platform_metrics(self, db: Session) -> Dict:
        from sqlalchemy import func
        from models import User, PathSession

        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        try:
            total_users = db.query(func.count(User.id)).scalar() or 0

            new_month = db.query(func.count(User.id)).filter(
                User.created_at >= month_start
            ).scalar() or 0

            thirty_ago = now - timedelta(days=30)
            seven_ago = now - timedelta(days=7)

            active_30d = db.query(
                func.count(func.distinct(PathSession.user_id))
            ).filter(PathSession.started_at >= thirty_ago).scalar() or 0

            active_7d = db.query(
                func.count(func.distinct(PathSession.user_id))
            ).filter(PathSession.started_at >= seven_ago).scalar() or 0

            active_today = db.query(
                func.count(func.distinct(PathSession.user_id))
            ).filter(PathSession.started_at >= now.replace(hour=0, minute=0, second=0)).scalar() or 0

            total_videos = db.query(func.count(PathSession.id)).filter(
                PathSession.video_watched.is_(True)
            ).scalar() or 0

            total_seconds = db.query(
                func.coalesce(func.sum(PathSession.total_watch_time_seconds), 0)
            ).scalar() or 0

        except Exception as e:
            logger.warning(f"platform metrics error: {e}")
            return {
                "total_users": 0, "new_users_this_month": 0,
                "active_users_30d": 0, "active_users_7d": 0, "active_users_today": 0,
                "total_videos_watched": 0, "total_hours_learned": 0.0,
            }

        retention = round((active_30d / total_users * 100) if total_users > 0 else 0.0, 1)

        return {
            "total_users": total_users,
            "new_users_this_month": new_month,
            "active_users_30d": active_30d,
            "active_users_7d": active_7d,
            "active_users_today": active_today,
            "total_videos_watched": total_videos,
            "total_hours_learned": round(total_seconds / 3600.0, 1),
            "avg_user_retention_pct": retention,
        }

    # ── Revenue metrics ───────────────────────────────────────────────────────

    def get_revenue_metrics(self, db: Session) -> Dict:
        key = "revenue"
        cached = _cached_get(key)
        if cached:
            return cached
        result = self._compute_revenue_metrics(db)
        _cached_set(key, result, ttl=300)
        return result

    def _compute_revenue_metrics(self, db: Session) -> Dict:
        from sqlalchemy import func
        from models import User, Transaction

        MRR_PRO = 2999
        MRR_PREMIUM = 9999

        try:
            free_count = db.query(func.count(User.id)).filter(User.tier == "free").scalar() or 0
            pro_count = db.query(func.count(User.id)).filter(User.tier == "pro").scalar() or 0
            premium_count = db.query(func.count(User.id)).filter(User.tier == "premium").scalar() or 0
            total_users = free_count + pro_count + premium_count

            mrr = (pro_count * MRR_PRO) + (premium_count * MRR_PREMIUM)
            paid_users = pro_count + premium_count
            arpu = round(mrr / paid_users if paid_users > 0 else 0.0, 2)

            total_revenue = db.query(
                func.coalesce(func.sum(Transaction.amount), 0)
            ).filter(Transaction.status == "successful").scalar() or 0

            # Monthly revenue trend (last 6 calendar months)
            now = datetime.utcnow()
            trend = []
            for months_back in range(5, -1, -1):
                target = now - timedelta(days=30 * months_back)
                m_start = target.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                if months_back == 0:
                    m_end = now
                else:
                    next_m = (m_start.replace(day=28) + timedelta(days=4)).replace(day=1)
                    m_end = next_m - timedelta(seconds=1)
                rev = db.query(
                    func.coalesce(func.sum(Transaction.amount), 0)
                ).filter(
                    Transaction.status == "successful",
                    Transaction.created_at >= m_start,
                    Transaction.created_at <= m_end,
                ).scalar() or 0
                trend.append({
                    "month": m_start.strftime("%b %Y"),
                    "revenue": float(rev),
                })

        except Exception as e:
            logger.warning(f"revenue metrics error: {e}")
            free_count = pro_count = premium_count = 0
            mrr = arpu = total_revenue = 0
            trend = []

        return {
            "monthly_recurring_revenue": mrr,
            "total_revenue_all_time": float(total_revenue),
            "arpu": arpu,
            "free_users_count": free_count,
            "pro_users_count": pro_count,
            "premium_users_count": premium_count,
            "revenue_by_plan": {
                "free": 0,
                "pro": pro_count * MRR_PRO,
                "premium": premium_count * MRR_PREMIUM,
            },
            "revenue_trend_last_6_months": trend,
        }

    # ── Churn metrics ─────────────────────────────────────────────────────────

    def get_churn_metrics(self, db: Session) -> Dict:
        key = "churn"
        cached = _cached_get(key)
        if cached:
            return cached
        result = self._compute_churn_metrics(db)
        _cached_set(key, result, ttl=300)
        return result

    def _compute_churn_metrics(self, db: Session) -> Dict:
        from sqlalchemy import func
        from models import Subscription, User, PathSession

        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        seven_ago = now - timedelta(days=7)

        try:
            # Total subscriptions ever (paid)
            total_paid_subs = db.query(func.count(Subscription.id)).filter(
                Subscription.plan_type != "free"
            ).scalar() or 0

            # Cancelled this month
            churned_month = db.query(func.count(Subscription.id)).filter(
                Subscription.status == "cancelled",
                Subscription.cancelled_at >= month_start,
            ).scalar() or 0

            churn_rate = round(
                (churned_month / total_paid_subs * 100) if total_paid_subs > 0 else 0.0, 2
            )

            # At-risk: paid users who have not had any session in 7 days
            paid_user_ids = [
                r[0] for r in
                db.query(User.id).filter(User.tier != "free").all()
            ]
            at_risk_count = 0
            if paid_user_ids:
                active_recent = {
                    r[0] for r in
                    db.query(func.distinct(PathSession.user_id)).filter(
                        PathSession.user_id.in_(paid_user_ids),
                        PathSession.started_at >= seven_ago,
                    ).all()
                }
                at_risk_count = len(set(str(u) for u in paid_user_ids) - {str(u) for u in active_recent})

        except Exception as e:
            logger.warning(f"churn metrics error: {e}")
            return {
                "churn_rate_monthly": 0.0,
                "users_churned_this_month": 0,
                "at_risk_users_count": 0,
                "churn_reasons": {},
            }

        return {
            "churn_rate_monthly": churn_rate,
            "users_churned_this_month": churned_month,
            "at_risk_users_count": at_risk_count,
            "churn_reasons": {},  # Requires a survey UI — not yet collected
        }

    # ── Retention cohorts ─────────────────────────────────────────────────────

    def get_retention_cohorts(self, db: Session) -> Dict:
        key = "cohorts"
        cached = _cached_get(key)
        if cached:
            return cached
        result = self._compute_retention_cohorts(db)
        _cached_set(key, result, ttl=900)
        return result

    def _compute_retention_cohorts(self, db: Session) -> Dict:
        from models import User, PathSession

        now = datetime.utcnow()
        try:
            # Group users by signup month (last 6 months)
            users = db.query(User.id, User.created_at).all()
            sessions_raw = db.query(PathSession.user_id, PathSession.started_at).all()

            # Build user→active months map
            user_months: Dict[str, set] = {}
            for s in sessions_raw:
                if s.started_at:
                    uid = str(s.user_id)
                    user_months.setdefault(uid, set()).add(
                        s.started_at.strftime("%Y-%m")
                    )

            # Build cohorts from last 6 months
            cohorts = {}
            for u in users:
                if not u.created_at:
                    continue
                cohort_key = u.created_at.strftime("%Y-%m")
                cohorts.setdefault(cohort_key, []).append(str(u.id))

            result_cohorts = []
            for cohort_key in sorted(cohorts.keys())[-6:]:
                user_ids = cohorts[cohort_key]
                total = len(user_ids)
                still_active = sum(
                    1 for uid in user_ids
                    if uid in user_months and user_months[uid]
                )
                pct = round((still_active / total * 100) if total > 0 else 0.0, 1)
                result_cohorts.append({
                    "signup_month": cohort_key,
                    "total_users": total,
                    "still_active": still_active,
                    "retention_percentage": pct,
                })

        except Exception as e:
            logger.warning(f"cohort computation error: {e}")
            result_cohorts = []

        return {"cohorts": result_cohorts}

    # ── Engagement metrics ────────────────────────────────────────────────────

    def get_engagement_metrics(self, db: Session) -> Dict:
        key = "engagement"
        cached = _cached_get(key)
        if cached:
            return cached
        result = self._compute_engagement_metrics(db)
        _cached_set(key, result, ttl=300)
        return result

    def _compute_engagement_metrics(self, db: Session) -> Dict:
        from sqlalchemy import func
        from models import PathSession

        now = datetime.utcnow()
        thirty_ago = now - timedelta(days=30)

        try:
            avg_seconds = db.query(
                func.avg(PathSession.total_watch_time_seconds)
            ).filter(PathSession.total_watch_time_seconds > 0).scalar() or 0

            sessions_30d = db.query(func.count(PathSession.id)).filter(
                PathSession.started_at >= thirty_ago
            ).scalar() or 0

            active_users_30d = db.query(
                func.count(func.distinct(PathSession.user_id))
            ).filter(PathSession.started_at >= thirty_ago).scalar() or 1

            sessions_per_user = round(sessions_30d / active_users_30d, 1)

            # Video completion rate (sessions where video_watched=True / total sessions)
            completed = db.query(func.count(PathSession.id)).filter(
                PathSession.video_watched.is_(True)
            ).scalar() or 0
            total_sessions = db.query(func.count(PathSession.id)).scalar() or 1
            completion_rate = round(completed / total_sessions * 100, 1)

        except Exception as e:
            logger.warning(f"engagement metrics error: {e}")
            return {
                "avg_session_length_minutes": 0.0,
                "sessions_per_user_30d": 0.0,
                "video_completion_rate_pct": 0.0,
            }

        return {
            "avg_session_length_minutes": round(avg_seconds / 60.0, 1),
            "sessions_per_user_30d": sessions_per_user,
            "video_completion_rate_pct": completion_rate,
        }

    # ── Funnel metrics ────────────────────────────────────────────────────────

    def get_funnel_metrics(self, db: Session) -> Dict:
        key = "funnel"
        cached = _cached_get(key)
        if cached:
            return cached
        result = self._compute_funnel_metrics(db)
        _cached_set(key, result, ttl=900)
        return result

    def _compute_funnel_metrics(self, db: Session) -> Dict:
        """
        Approximates the signup→video→paid funnel from available data.
        Marketing funnel (home page, click-through) is not tracked yet.
        """
        from sqlalchemy import func
        from models import User, PathSession

        try:
            total_signups = db.query(func.count(User.id)).scalar() or 0
            users_with_video = db.query(
                func.count(func.distinct(PathSession.user_id))
            ).filter(PathSession.video_watched.is_(True)).scalar() or 0
            paid_users = db.query(func.count(User.id)).filter(
                User.tier.in_(["pro", "premium"])
            ).scalar() or 0

            signup_to_video = round(users_with_video / total_signups * 100 if total_signups else 0, 1)
            video_to_paid = round(paid_users / users_with_video * 100 if users_with_video else 0, 1)
            overall = round(paid_users / total_signups * 100 if total_signups else 0, 1)

        except Exception as e:
            logger.warning(f"funnel metrics error: {e}")
            total_signups = users_with_video = paid_users = 0
            signup_to_video = video_to_paid = overall = 0.0

        return {
            "funnel_steps": {
                "total_signups": total_signups,
                "watched_first_video": users_with_video,
                "upgraded_to_paid": paid_users,
            },
            "conversion_rates": {
                "signup_to_first_video_pct": signup_to_video,
                "first_video_to_paid_pct": video_to_paid,
                "overall_free_to_paid_pct": overall,
            },
            "note": "Marketing funnel (landing page clicks) not tracked yet.",
        }

    # ── Platform health ───────────────────────────────────────────────────────

    def get_platform_health(self, db: Session) -> Dict:
        key = "health"
        cached = _cached_get(key)
        if cached:
            return cached
        result = self._compute_platform_health(db)
        _cached_set(key, result, ttl=60)
        return result

    def _compute_platform_health(self, db: Session) -> Dict:
        db_ok = False
        try:
            from sqlalchemy import text
            db.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            pass

        health_score = 100 if db_ok else 50
        return {
            "health_score": health_score,
            "db_connected": db_ok,
            "cache_entries": len(_cache),
            "note": "API uptime and response-time metrics require external monitoring.",
        }

    # ── Cache management ──────────────────────────────────────────────────────

    def invalidate_cache(self, prefix: Optional[str] = None) -> int:
        """Clear all or prefix-matching cache entries. Returns count removed."""
        with _cache_lock:
            if prefix is None:
                n = len(_cache)
                _cache.clear()
                return n
            keys = [k for k in _cache if k.startswith(prefix)]
            for k in keys:
                del _cache[k]
            return len(keys)

    def cache_stats(self) -> Dict:
        now = time.monotonic()
        with _cache_lock:
            return {
                "total_entries": len(_cache),
                "valid_entries": sum(1 for exp, _ in _cache.values() if exp > now),
                "keys": list(_cache.keys()),
            }


analytics_service = AnalyticsService()
