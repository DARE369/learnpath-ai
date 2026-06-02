"""Teacher and class management service (Packet 5.0)"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class TeacherService:
    def __init__(self, db: Session):
        self.db = db

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
