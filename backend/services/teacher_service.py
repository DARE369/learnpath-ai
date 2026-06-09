"""Teacher and class management service (Packet 5.0)"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _alert_for(m) -> Optional[Dict]:
    """Return an at-risk descriptor for a membership, or None. Most-severe reason wins."""
    now = datetime.utcnow()
    score = m.average_score or 0
    progress = m.progress_percent or 0
    days_inactive = (now - m.last_active).days if m.last_active else None
    if progress == 0:
        return {"reason": "no_attempts", "current_score": score, "days_inactive": days_inactive}
    if score and score < 60:
        return {"reason": "low_score", "current_score": score, "days_inactive": days_inactive}
    if days_inactive is not None and days_inactive > 5:
        return {"reason": "inactive", "current_score": score, "days_inactive": days_inactive}
    return None


class TeacherService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_teacher(self, user):
        """Return the Teacher record for a platform user, provisioning a personal
        Organization + Teacher on first access (ADMIN-1.1). Lets an individual
        teacher use the dashboard with zero manual org setup."""
        from models import Teacher, Organization

        t = self.db.query(Teacher).filter(Teacher.user_id == user.id).first()
        if t:
            return t
        # Legacy rows may exist by email without user_id — adopt them.
        if user.email:
            t = self.db.query(Teacher).filter(Teacher.email == user.email).first()
            if t:
                if not t.user_id:
                    t.user_id = user.id
                    self.db.commit()
                return t

        name = user.full_name or (user.email.split("@")[0] if user.email else "Teacher")
        org = Organization(
            name=f"{name}'s Classes",
            type="individual",
            admin_email=user.email,
            admin_name=user.full_name,
        )
        self.db.add(org)
        self.db.flush()  # populate org.id
        t = Teacher(
            organization_id=org.id,
            user_id=user.id,
            email=user.email,
            name=name,
        )
        self.db.add(t)
        self.db.commit()
        self.db.refresh(t)
        return t

    def get_dashboard_overview(self, teacher_id: str) -> Dict:
        """Aggregated hub data (classes, alerts, metrics, recent activity), computed
        live from Class + ClassMembership (+ recent QuizSession). No cache tables."""
        from models import Teacher, Class, ClassMembership, User, QuizSession

        teacher = self.db.query(Teacher).filter(Teacher.id == teacher_id).first()
        if not teacher:
            raise ValueError(f"Teacher not found: {teacher_id}")

        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)

        classes = self.db.query(Class).filter(Class.teacher_id == teacher_id).all()
        class_ids = [c.id for c in classes]
        class_name = {c.id: c.name for c in classes}

        memberships = (
            self.db.query(ClassMembership)
            .filter(ClassMembership.class_id.in_(class_ids), ClassMembership.enrollment_status == "active")
            .all()
            if class_ids else []
        )

        # Resolve student names in one query.
        student_ids = list({m.student_id for m in memberships})
        names = {}
        if student_ids:
            for u in self.db.query(User).filter(User.id.in_(student_ids)).all():
                names[u.id] = u.full_name or (u.email.split("@")[0] if u.email else "Student")

        def _is_active(m):
            return bool(m.last_active and m.last_active >= week_ago)

        # Per-class rollups
        classes_out = []
        for c in classes:
            ms = [m for m in memberships if m.class_id == c.id]
            n = len(ms)
            avg_score = round(sum(m.average_score or 0 for m in ms) / n, 1) if n else 0
            completion = round(sum(m.progress_percent or 0 for m in ms) / n, 1) if n else 0
            classes_out.append({
                "class_id": str(c.id),
                "class_name": c.name,
                "subject": c.subject,
                "student_count": n,
                "avg_score": avg_score,
                "active_this_week": sum(1 for m in ms if _is_active(m)),
                "at_risk_count": sum(1 for m in ms if _alert_for(m)),
                "completion_rate": completion,
            })
        classes_out.sort(key=lambda x: x["class_name"] or "")

        # Alerts (top 5, most severe by lowest score then most days inactive)
        alerts = []
        for m in memberships:
            a = _alert_for(m)
            if not a:
                continue
            alerts.append({
                "alert_id": str(m.id),
                "student_id": str(m.student_id),
                "student_name": names.get(m.student_id, "Student"),
                "class_id": str(m.class_id),
                "class_name": class_name.get(m.class_id, ""),
                "reason": a["reason"],
                "current_score": a["current_score"],
                "days_inactive": a["days_inactive"],
            })
        alerts.sort(key=lambda x: (x["current_score"] or 0, -(x["days_inactive"] or 0)))
        alerts = alerts[:5]

        # Metrics across all classes
        total = len(memberships)
        metrics = {
            "total_students": total,
            "avg_score": round(sum(m.average_score or 0 for m in memberships) / total, 1) if total else 0,
            "active_this_week": sum(1 for m in memberships if _is_active(m)),
            "completion_rate": round(sum(m.progress_percent or 0 for m in memberships) / total, 1) if total else 0,
        }

        return {
            "teacher": {"id": str(teacher.id), "name": teacher.name, "email": teacher.email},
            "classes": classes_out,
            "alerts": alerts,
            "metrics": metrics,
            "recent_activity": self._recent_activity(student_ids, names, memberships, class_name, week_ago),
            "timestamp": now.isoformat(),
        }

    def _recent_activity(self, student_ids, names, memberships, class_name, week_ago) -> List[Dict]:
        """Derive recent activity from membership last_active + recent quiz sessions."""
        from models import QuizSession

        out: List[Dict] = []
        class_by_student = {m.student_id: m.class_id for m in memberships}

        # Quiz submissions (best-effort — schema varies)
        if student_ids:
            try:
                rows = (
                    self.db.query(QuizSession)
                    .filter(QuizSession.user_id.in_(student_ids))
                    .order_by(QuizSession.created_at.desc())
                    .limit(15)
                    .all()
                )
                for s in rows:
                    score = getattr(s, "score_percent", None)
                    when = getattr(s, "created_at", None) or getattr(s, "started_at", None)
                    out.append({
                        "type": "quiz_submitted",
                        "student_name": names.get(s.user_id, "Student"),
                        "class_name": class_name.get(class_by_student.get(s.user_id), ""),
                        "description": f"Completed a quiz" + (f" ({int(score)}%)" if score is not None else ""),
                        "occurred_at": when.isoformat() if when else None,
                    })
            except Exception as e:
                logger.warning(f"recent_activity quiz fetch failed: {e}")

        # Recent logins / activity
        for m in memberships:
            if m.last_active and m.last_active >= week_ago:
                out.append({
                    "type": "active",
                    "student_name": names.get(m.student_id, "Student"),
                    "class_name": class_name.get(m.class_id, ""),
                    "description": "Was active recently",
                    "occurred_at": m.last_active.isoformat(),
                })

        out = [a for a in out if a["occurred_at"]]
        out.sort(key=lambda x: x["occurred_at"], reverse=True)
        return out[:15]

    async def get_teacher_dashboard(self, teacher_id: str) -> Dict:
        """Get teacher's main dashboard"""
        from models import Teacher, Class, ClassMembership

        teacher = self.db.query(Teacher).filter(Teacher.id == teacher_id).first()
        if not teacher:
            raise ValueError(f"Teacher not found: {teacher_id}")

        # Get all classes for this teacher
        classes = self.db.query(Class).filter(Class.teacher_id == teacher_id).all()
        class_ids = [c.id for c in classes]

        # Get student data for all classes
        total_active = self.db.query(ClassMembership).filter(
            ClassMembership.class_id.in_(class_ids) if class_ids else False,
            ClassMembership.last_active >= datetime.utcnow() - timedelta(days=7)
        ).count() if class_ids else 0

        avg_scores = self.db.query(ClassMembership).filter(
            ClassMembership.class_id.in_(class_ids) if class_ids else False
        ).all() if class_ids else []

        avg_score = sum(m.average_score for m in avg_scores) / len(avg_scores) if avg_scores else 0

        return {
            "teacher": {
                "id": str(teacher.id),
                "name": teacher.name,
                "email": teacher.email,
                "classes_count": len(classes)
            },
            "this_week": {
                "active_students": total_active,
                "avg_score": int(avg_score),
                "total_study_time_hours": 0  # Would be calculated from analytics
            },
            "classes": [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "subject": c.subject,
                    "enrolled": c.enrolled_students,
                    "max": c.max_students
                }
                for c in classes
            ]
        }

    async def get_class_details(self, class_id: str, teacher_id: str) -> Dict:
        """Get detailed class information"""
        from models import Class, ClassMembership

        class_obj = self.db.query(Class).filter(Class.id == class_id).first()
        if not class_obj or class_obj.teacher_id != teacher_id:
            raise ValueError("Unauthorized or class not found")

        # Get all students in class
        memberships = self.db.query(ClassMembership).filter(
            ClassMembership.class_id == class_id
        ).all()

        students = [
            {
                "id": str(m.student_id),
                "progress": m.progress_percent,
                "avg_score": m.average_score,
                "last_active": m.last_active.isoformat() if m.last_active else None,
                "status": m.enrollment_status
            }
            for m in memberships
        ]

        avg_progress = sum(s["progress"] for s in students) / len(students) if students else 0
        avg_score = sum(s["avg_score"] for s in students) / len(students) if students else 0

        return {
            "class": {
                "id": str(class_obj.id),
                "name": class_obj.name,
                "subject": class_obj.subject,
                "description": class_obj.description
            },
            "students": students,
            "summary": {
                "total": len(students),
                "active": sum(1 for s in students if s["last_active"] and 
                            datetime.fromisoformat(s["last_active"]) > datetime.utcnow() - timedelta(days=7)),
                "avg_progress": int(avg_progress),
                "avg_score": int(avg_score)
            }
        }

    async def get_at_risk_students(self, teacher_id: str) -> Dict:
        """Get students who need intervention"""
        from models import Class, ClassMembership

        teacher_classes = self.db.query(Class).filter(Class.teacher_id == teacher_id).all()
        class_ids = [c.id for c in teacher_classes]

        at_risk = []
        memberships = self.db.query(ClassMembership).filter(
            ClassMembership.class_id.in_(class_ids) if class_ids else False
        ).all() if class_ids else []

        for m in memberships:
            reasons = []

            if m.average_score < 60:
                reasons.append(f"Low scores ({m.average_score}%)")

            if m.last_active and m.last_active < datetime.utcnow() - timedelta(days=7):
                days_since = (datetime.utcnow() - m.last_active).days
                reasons.append(f"Inactive {days_since} days")

            if m.progress_percent < 20:
                reasons.append(f"Low progress ({m.progress_percent}%)")

            if reasons:
                at_risk.append({
                    "student_id": str(m.student_id),
                    "reasons": reasons,
                    "recommended_action": "Assign focused review path"
                })

        return {
            "at_risk_count": len(at_risk),
            "at_risk_students": at_risk
        }

    async def assign_assignment(
        self,
        class_id: str,
        teacher_id: str,
        assignment_type: str,
        assignment_id: str
    ) -> Dict:
        """Assign quiz/path to entire class"""
        from models import Class, ClassMembership

        class_obj = self.db.query(Class).filter(Class.id == class_id).first()
        if not class_obj or class_obj.teacher_id != teacher_id:
            raise ValueError("Unauthorized or class not found")

        # Get all students in class
        memberships = self.db.query(ClassMembership).filter(
            ClassMembership.class_id == class_id
        ).all()

        # In a real implementation, we would create assignment records
        # For now, just return success
        logger.info(f"Assigned {assignment_type} to {len(memberships)} students in class {class_id}")

        return {
            "status": "success",
            "students_assigned": len(memberships),
            "assignment_type": assignment_type
        }
