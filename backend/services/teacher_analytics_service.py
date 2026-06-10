"""Class analytics for teachers (ADMIN-1.4, teacher side).

Computed live from existing tables — no snapshot/precompute tables. Forecasting
and at-risk trends use simple pure-Python least squares (no numpy/sklearn).
Engagement metrics that need event tracking we don't have (video completion,
logins/day-active) and school/all-teacher baselines are returned as N/A.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _linfit(xs: List[float], ys: List[float]) -> Optional[Tuple[float, float, float]]:
    """Ordinary least squares for y = slope*x + intercept. Returns (slope,
    intercept, r2) or None when there aren't enough/spread points."""
    n = len(xs)
    if n < 3:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        return None
    sxy = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    slope = sxy / sxx
    intercept = my - slope * mx
    ss_tot = sum((y - my) ** 2 for y in ys)
    ss_res = sum((ys[i] - (slope * xs[i] + intercept)) ** 2 for i in range(n))
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    return slope, intercept, max(0.0, min(1.0, r2))


class TeacherAnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def _require_owned_class(self, teacher, class_id):
        from models import Class
        c = self.db.query(Class).filter(Class.id == class_id).first()
        if not c or str(c.teacher_id) != str(teacher.id):
            raise PermissionError("Class not found or not yours")
        return c

    def get_class_analytics(self, teacher, class_id: str, date_from: datetime,
                            date_to: datetime, view: str = "absolute") -> Dict:
        from models import ClassMembership, QuizSession, ConceptMastery, User

        cls = self._require_owned_class(teacher, class_id)
        members = (
            self.db.query(ClassMembership)
            .filter(ClassMembership.class_id == class_id, ClassMembership.enrollment_status == "active")
            .all()
        )
        student_ids = [m.student_id for m in members]
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)

        # ── Score breakdown by concept (QuizSession in window, fallback ConceptMastery)
        breakdown = self._score_breakdown(student_ids, date_from, date_to)
        if not breakdown:
            breakdown = self._mastery_breakdown(student_ids)

        # ── Trends: window vs prior equal-length window
        span = max(timedelta(days=1), date_to - date_from)
        prev_from, prev_to = date_from - span, date_from
        prev = {b["topic"]: b["score"] for b in self._score_breakdown(student_ids, prev_from, prev_to)}
        trends = [
            {"topic": b["topic"], "current": b["score"], "previous": prev.get(b["topic"]),
             "trend": (b["score"] - prev[b["topic"]]) if b["topic"] in prev else None}
            for b in breakdown
        ]

        # ── Distribution from membership average_score
        scores = [m.average_score or 0 for m in members]
        distribution = {
            "at_risk": sum(1 for s in scores if s < 50),
            "developing": sum(1 for s in scores if 50 <= s < 70),
            "proficient": sum(1 for s in scores if 70 <= s < 85),
            "advanced": sum(1 for s in scores if s >= 85),
        }

        # ── Weekly trend (avg score_percent per ISO week)
        weekly_trend = self._weekly_trend(student_ids, date_from, date_to)

        # ── Engagement
        total = len(members)
        engagement = {
            "active_this_week": sum(1 for m in members if m.last_active and m.last_active >= week_ago),
            "total_students": total,
            "assignment_submission_percent": self._submission_percent(class_id, student_ids),
            "video_completion_percent": None,   # needs watch tracking (deferred)
            "avg_logins_per_week": None,        # needs login events (deferred)
        }

        # ── Forecast (avg progress + weekly pace from weekly_trend completion proxy)
        avg_progress = round(sum(m.progress_percent or 0 for m in members) / total, 1) if total else 0
        forecast = self._forecast(avg_progress, weekly_trend)

        # ── At-risk forecast (per-student linear trend over recent quiz scores)
        names = {}
        if student_ids:
            for u in self.db.query(User).filter(User.id.in_(student_ids)).all():
                names[u.id] = u.full_name or (u.email.split("@")[0] if u.email else "Student")
        at_risk = self._at_risk(student_ids, names)

        # ── Recommendations: lowest concepts < 75
        recommendations = [
            {"topic": b["topic"], "current_score": b["score"]}
            for b in sorted(breakdown, key=lambda x: x["score"])[:2] if b["score"] < 75
        ]

        # ── Comparison
        comparison = {}
        if view == "vs_my_classes":
            comparison = self._vs_my_classes(teacher, class_id)

        return {
            "class_id": str(cls.id),
            "class_name": cls.name,
            "date_range": {"from": date_from.date().isoformat(), "to": date_to.date().isoformat()},
            "view": view,
            "student_count": total,
            "score_breakdown": breakdown,
            "score_trends": trends,
            "distribution": distribution,
            "weekly_trend": weekly_trend,
            "engagement": engagement,
            "forecast": forecast,
            "at_risk": at_risk,
            "recommendations": recommendations,
            "comparison": comparison,
        }

    # ── helpers ──────────────────────────────────────────────────────────────

    def _score_breakdown(self, student_ids, date_from, date_to) -> List[Dict]:
        from models import QuizSession
        if not student_ids:
            return []
        rows = (
            self.db.query(QuizSession)
            .filter(
                QuizSession.user_id.in_(student_ids),
                QuizSession.concept.isnot(None),
                QuizSession.session_started_at >= date_from,
                QuizSession.session_started_at <= date_to,
            )
            .all()
        )
        agg: Dict[str, List[int]] = {}
        for s in rows:
            agg.setdefault(s.concept, []).append(s.score_percent or 0)
        return [{"topic": k, "score": round(sum(v) / len(v))} for k, v in agg.items() if v]

    def _mastery_breakdown(self, student_ids) -> List[Dict]:
        from models import ConceptMastery
        if not student_ids:
            return []
        rows = self.db.query(ConceptMastery).filter(ConceptMastery.user_id.in_(student_ids)).all()
        agg: Dict[str, List[int]] = {}
        for cm in rows:
            agg.setdefault(cm.concept_id, []).append(cm.accuracy_percent or 0)
        return [{"topic": k, "score": round(sum(v) / len(v))} for k, v in agg.items() if v]

    def _weekly_trend(self, student_ids, date_from, date_to) -> List[Dict]:
        from models import QuizSession
        if not student_ids:
            return []
        rows = (
            self.db.query(QuizSession)
            .filter(
                QuizSession.user_id.in_(student_ids),
                QuizSession.session_started_at >= date_from,
                QuizSession.session_started_at <= date_to,
            )
            .all()
        )
        by_week: Dict[str, List[int]] = {}
        for s in rows:
            wk = s.session_started_at.date()
            wk = wk - timedelta(days=wk.weekday())  # Monday of that week
            by_week.setdefault(wk.isoformat(), []).append(s.score_percent or 0)
        return [{"week": k, "avg_score": round(sum(v) / len(v))} for k, v in sorted(by_week.items())]

    def _submission_percent(self, class_id, student_ids) -> Optional[int]:
        from models import TeacherAssignment, AssignmentSubmission
        assignments = self.db.query(TeacherAssignment).filter(TeacherAssignment.class_id == class_id).all()
        if not assignments:
            return None
        a_ids = [a.id for a in assignments]
        subs = self.db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id.in_(a_ids)).all()
        if not subs:
            return 0
        submitted = sum(1 for s in subs if s.status in ("submitted", "pending_manual", "graded"))
        return round(submitted / len(subs) * 100)

    def _forecast(self, avg_progress, weekly_trend) -> Dict:
        # Use weekly avg_score as a completion proxy if progress history is absent.
        pts = [(i, w["avg_score"]) for i, w in enumerate(weekly_trend)]
        fit = _linfit([p[0] for p in pts], [p[1] for p in pts]) if len(pts) >= 3 else None
        if not fit or fit[0] <= 0:
            return {"current_completion": avg_progress, "estimated_date": None,
                    "confidence": 0, "note": "Insufficient data for a forecast"}
        slope, intercept, r2 = fit
        weeks_to_100 = (100 - (slope * (len(pts) - 1) + intercept)) / slope
        est = datetime.utcnow() + timedelta(weeks=max(0, weeks_to_100))
        return {"current_completion": avg_progress, "estimated_date": est.date().isoformat(),
                "confidence": round(r2 * 100), "note": None}

    def _at_risk(self, student_ids, names) -> List[Dict]:
        from models import QuizSession
        out = []
        for sid in student_ids:
            rows = (
                self.db.query(QuizSession)
                .filter(QuizSession.user_id == sid)
                .order_by(QuizSession.session_started_at.asc())
                .limit(20)
                .all()
            )
            scores = [s.score_percent or 0 for s in rows]
            if len(scores) < 3:
                continue
            fit = _linfit(list(range(len(scores))), scores)
            if not fit:
                continue
            slope, intercept, _ = fit
            current = scores[-1]
            predicted = round(slope * (len(scores) + 3) + intercept)  # ~3 sessions ahead
            if predicted < 60:
                risk = "high"
            elif current < 65 or slope < -2:
                risk = "medium"
            else:
                continue
            reason = ("Declining trend" if slope < -1 else "Low score" if current < 60 else "Watch closely")
            out.append({
                "student_id": str(sid), "student_name": names.get(sid, "Student"),
                "current_score": current, "predicted_score": max(0, min(100, predicted)),
                "trend_per_session": round(slope, 1), "risk_level": risk, "reason": reason,
            })
        out.sort(key=lambda x: x["predicted_score"])
        return out[:8]

    def _vs_my_classes(self, teacher, class_id) -> Dict:
        from models import Class, ClassMembership
        classes = self.db.query(Class).filter(Class.teacher_id == teacher.id).all()
        out = []
        for c in classes:
            ms = (
                self.db.query(ClassMembership)
                .filter(ClassMembership.class_id == c.id, ClassMembership.enrollment_status == "active")
                .all()
            )
            n = len(ms)
            out.append({
                "class_id": str(c.id), "class_name": c.name,
                "avg_score": round(sum(m.average_score or 0 for m in ms) / n, 1) if n else 0,
                "avg_progress": round(sum(m.progress_percent or 0 for m in ms) / n, 1) if n else 0,
                "is_current": str(c.id) == str(class_id),
            })
        return {"classes": out}
