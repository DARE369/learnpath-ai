"""Teacher assignments (ADMIN-1.3, teacher side).

Create/manage assignments, view submissions, and manually grade. Student
submission, auto-grading, video-watch tracking, and notifications/email are a
later packet — submissions are created at assignment time in status 'assigned'.
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_TYPES = {"quick_quiz", "custom_quiz", "video", "path", "document", "discussion", "external_link"}
_DEADLINES = {"allow_anytime", "hard_cutoff", "late_with_penalty"}


class AssignmentService:
    def __init__(self, db: Session):
        self.db = db

    def _require_owned_class(self, teacher, class_id):
        from models import Class
        c = self.db.query(Class).filter(Class.id == class_id).first()
        if not c or str(c.teacher_id) != str(teacher.id):
            raise PermissionError("Class not found or not yours")
        return c

    def _require_owned_assignment(self, teacher, assignment_id):
        from models import TeacherAssignment
        a = self.db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
        if not a or str(a.teacher_id) != str(teacher.id):
            raise PermissionError("Assignment not found or not yours")
        return a

    def create_assignment(self, teacher, class_id: str, data: Dict) -> Dict:
        from models import TeacherAssignment, AssignmentSubmission, ClassMembership

        self._require_owned_class(teacher, class_id)
        name = (data.get("name") or "").strip()
        if not name:
            raise ValueError("Assignment name is required")

        atype = data.get("assignment_type") if data.get("assignment_type") in _TYPES else "document"
        dtype = data.get("deadline_type") if data.get("deadline_type") in _DEADLINES else "allow_anytime"
        assigned_to = "individuals" if data.get("assigned_to_type") == "individuals" else "whole_class"

        due = None
        if data.get("due_date"):
            try:
                due = datetime.fromisoformat(str(data["due_date"]).replace("Z", "+00:00"))
                if due.tzinfo:
                    due = due.replace(tzinfo=None)
            except (ValueError, TypeError):
                due = None

        a = TeacherAssignment(
            teacher_id=teacher.id,
            class_id=class_id,
            name=name,
            description=(data.get("description") or None),
            assignment_type=atype,
            content_data=data.get("content_data") or {},
            due_date=due,
            deadline_type=dtype,
            late_penalty_percent=data.get("late_penalty_percent"),
            late_penalty_days=data.get("late_penalty_days"),
            assigned_to_type=assigned_to,
        )
        self.db.add(a)
        self.db.flush()

        # Resolve target students.
        members = (
            self.db.query(ClassMembership)
            .filter(ClassMembership.class_id == class_id, ClassMembership.enrollment_status == "active")
            .all()
        )
        member_ids = {str(m.student_id) for m in members}
        if assigned_to == "individuals":
            wanted = {str(s) for s in (data.get("assigned_student_ids") or [])}
            target_ids = member_ids & wanted
        else:
            target_ids = member_ids

        for sid in target_ids:
            self.db.add(AssignmentSubmission(assignment_id=a.id, student_id=sid, status="assigned"))

        self.db.commit()
        return {"assignment_id": str(a.id), "students_assigned": len(target_ids), "status": "created"}

    def list_assignments(self, teacher, class_id: Optional[str] = None) -> List[Dict]:
        from models import TeacherAssignment, AssignmentSubmission, Class
        from sqlalchemy import func

        q = self.db.query(TeacherAssignment).filter(TeacherAssignment.teacher_id == teacher.id)
        if class_id:
            q = q.filter(TeacherAssignment.class_id == class_id)
        assignments = q.order_by(TeacherAssignment.created_at.desc()).all()
        if not assignments:
            return []

        a_ids = [a.id for a in assignments]
        class_names = {c.id: c.name for c in self.db.query(Class).filter(
            Class.id.in_([a.class_id for a in assignments])).all()}

        # Counts per assignment.
        counts = {}
        rows = (
            self.db.query(AssignmentSubmission.assignment_id, AssignmentSubmission.status, func.count())
            .filter(AssignmentSubmission.assignment_id.in_(a_ids))
            .group_by(AssignmentSubmission.assignment_id, AssignmentSubmission.status)
            .all()
        )
        for aid, status, n in rows:
            d = counts.setdefault(aid, {"total": 0, "submitted": 0, "graded": 0})
            d["total"] += n
            if status in ("submitted", "pending_manual", "graded"):
                d["submitted"] += n
            if status == "graded":
                d["graded"] += n

        out = []
        for a in assignments:
            c = counts.get(a.id, {"total": 0, "submitted": 0, "graded": 0})
            out.append({
                "id": str(a.id),
                "name": a.name,
                "assignment_type": a.assignment_type,
                "class_id": str(a.class_id),
                "class_name": class_names.get(a.class_id, ""),
                "due_date": a.due_date.isoformat() if a.due_date else None,
                "total": c["total"],
                "submitted": c["submitted"],
                "graded": c["graded"],
                "created_at": a.created_at.isoformat(),
            })
        return out

    def get_responses(self, teacher, assignment_id: str, page: int = 1, page_size: int = 25) -> Dict:
        from models import AssignmentSubmission, User

        a = self._require_owned_assignment(teacher, assignment_id)
        subs = (
            self.db.query(AssignmentSubmission)
            .filter(AssignmentSubmission.assignment_id == assignment_id)
            .all()
        )
        student_ids = list({s.student_id for s in subs})
        users = {}
        if student_ids:
            for u in self.db.query(User).filter(User.id.in_(student_ids)).all():
                users[u.id] = u

        def name_of(uid):
            u = users.get(uid)
            return (u.full_name if u and u.full_name else (u.email.split("@")[0] if u and u.email else "Student"))

        rows = []
        stats = {"assigned": 0, "submitted": 0, "pending_manual": 0, "graded": 0}
        for s in subs:
            stats[s.status] = stats.get(s.status, 0) + 1
            score = s.manual_score if s.manual_score is not None else s.auto_score
            rows.append({
                "submission_id": str(s.id),
                "student_id": str(s.student_id),
                "student_name": name_of(s.student_id),
                "student_email": (users.get(s.student_id).email if users.get(s.student_id) else None),
                "status": s.status,
                "score": score,
                "teacher_notes": s.teacher_notes,
                "is_late": bool(s.is_late),
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            })
        rows.sort(key=lambda r: r["student_name"].lower())

        total = len(rows)
        start = (max(1, page) - 1) * page_size
        return {
            "assignment": {
                "id": str(a.id),
                "name": a.name,
                "assignment_type": a.assignment_type,
                "due_date": a.due_date.isoformat() if a.due_date else None,
                "description": a.description,
            },
            "stats": {**stats, "total": total},
            "responses": rows[start:start + page_size],
            "pagination": {
                "page": page, "page_size": page_size, "total": total,
                "pages": max(1, (total + page_size - 1) // page_size),
            },
        }

    def grade_submission(self, teacher, submission_id: str, score: int, notes: str = "") -> Dict:
        from models import AssignmentSubmission

        s = self.db.query(AssignmentSubmission).filter(AssignmentSubmission.id == submission_id).first()
        if not s:
            raise ValueError("Submission not found")
        self._require_owned_assignment(teacher, s.assignment_id)  # ownership via assignment

        s.manual_score = max(0, min(100, int(score)))
        s.teacher_notes = (notes or None)
        s.status = "graded"
        s.graded_at = datetime.utcnow()
        self.db.commit()
        return {"submission_id": str(s.id), "status": "graded", "score": s.manual_score}

    def delete_assignment(self, teacher, assignment_id: str) -> Dict:
        from models import AssignmentSubmission
        a = self._require_owned_assignment(teacher, assignment_id)
        self.db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id == a.id).delete()
        self.db.delete(a)
        self.db.commit()
        return {"deleted": True}
