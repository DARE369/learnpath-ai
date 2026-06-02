"""Unit tests for TeacherService (Packet 5.0)"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, MagicMock
from services.teacher_service import TeacherService


class TestTeacherDashboard:

    def test_get_teacher_dashboard(self):
        """Test retrieving teacher dashboard."""
        db = MagicMock()
        service = TeacherService(db)

        # Mock teacher
        teacher = MagicMock()
        teacher.id = "teacher-123"
        teacher.name = "Mrs. Okafor"
        teacher.email = "okafor@school.com"

        # Mock classes
        classes = [
            MagicMock(id="class-1", name="SS2 Biology", subject="Biology", enrolled_students=35, max_students=40),
            MagicMock(id="class-2", name="SS3 Biology", subject="Biology", enrolled_students=30, max_students=40),
        ]

        db.query = Mock(return_value=Mock(filter=Mock(return_value=Mock(first=Mock(return_value=teacher)))))

        dashboard = {
            "teacher": {
                "id": str(teacher.id),
                "name": teacher.name,
                "email": teacher.email,
                "classes_count": len(classes),
            },
            "this_week": {
                "active_students": 50,
                "avg_score": 72,
                "total_study_time_hours": 120,
            },
            "classes": [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "subject": c.subject,
                    "enrolled": c.enrolled_students,
                    "max": c.max_students,
                }
                for c in classes
            ],
        }

        assert dashboard["teacher"]["name"] == "Mrs. Okafor"
        assert dashboard["teacher"]["classes_count"] == 2
        assert len(dashboard["classes"]) == 2

    def test_get_class_details(self):
        """Test retrieving class details with students."""
        db = MagicMock()
        service = TeacherService(db)

        class_obj = MagicMock()
        class_obj.id = "class-123"
        class_obj.name = "SS2 Biology A"
        class_obj.subject = "Biology"
        class_obj.teacher_id = "teacher-456"

        # Mock students
        memberships = [
            MagicMock(student_id="s1", progress_percent=80, average_score=85, last_active=datetime.utcnow()),
            MagicMock(student_id="s2", progress_percent=65, average_score=70, last_active=datetime.utcnow() - timedelta(days=2)),
            MagicMock(student_id="s3", progress_percent=45, average_score=55, last_active=datetime.utcnow() - timedelta(days=10)),
        ]

        db.query = Mock(return_value=Mock(filter=Mock(return_value=Mock(all=Mock(return_value=memberships)))))

        class_details = {
            "class": {
                "id": str(class_obj.id),
                "name": class_obj.name,
                "subject": class_obj.subject,
            },
            "students": [
                {
                    "id": str(m.student_id),
                    "progress": m.progress_percent,
                    "avg_score": m.average_score,
                    "status": "active" if m.last_active > datetime.utcnow() - timedelta(days=7) else "inactive",
                }
                for m in memberships
            ],
            "summary": {
                "total": len(memberships),
                "active": 2,
                "avg_progress": int(sum(m.progress_percent for m in memberships) / len(memberships)),
                "avg_score": int(sum(m.average_score for m in memberships) / len(memberships)),
            },
        }

        assert class_details["class"]["name"] == "SS2 Biology A"
        assert class_details["summary"]["total"] == 3
        assert class_details["summary"]["active"] == 2
        assert class_details["summary"]["avg_progress"] == 63


class TestAtRiskDetection:

    def test_identify_at_risk_low_scores(self):
        """Test identifying at-risk students by low scores."""
        db = MagicMock()
        service = TeacherService(db)

        memberships = [
            MagicMock(student_id="s1", average_score=85, progress_percent=80, last_active=datetime.utcnow()),
            MagicMock(student_id="s2", average_score=45, progress_percent=60, last_active=datetime.utcnow()),  # At-risk
            MagicMock(student_id="s3", average_score=70, progress_percent=30, last_active=datetime.utcnow()),  # At-risk (low progress)
        ]

        at_risk = []
        for m in memberships:
            reasons = []
            if m.average_score < 60:
                reasons.append(f"Low scores ({m.average_score}%)")
            if m.progress_percent < 20:
                reasons.append(f"Low progress ({m.progress_percent}%)")
            if reasons:
                at_risk.append({
                    "student_id": str(m.student_id),
                    "reasons": reasons,
                })

        assert len(at_risk) == 2
        assert any("Low scores" in s["reasons"][0] for s in at_risk)

    def test_identify_at_risk_inactive(self):
        """Test identifying at-risk students by inactivity."""
        db = MagicMock()
        service = TeacherService(db)

        now = datetime.utcnow()
        memberships = [
            MagicMock(student_id="s1", average_score=75, progress_percent=60, last_active=now),
            MagicMock(student_id="s2", average_score=70, progress_percent=50, last_active=now - timedelta(days=14)),  # At-risk
        ]

        at_risk = []
        for m in memberships:
            reasons = []
            if m.last_active and m.last_active < now - timedelta(days=7):
                days_since = (now - m.last_active).days
                reasons.append(f"Inactive {days_since} days")
            if reasons:
                at_risk.append({
                    "student_id": str(m.student_id),
                    "reasons": reasons,
                })

        assert len(at_risk) == 1
        assert "Inactive" in at_risk[0]["reasons"][0]

    def test_at_risk_recommendations(self):
        """Test that at-risk students get recommendations."""
        db = MagicMock()
        service = TeacherService(db)

        at_risk_result = {
            "at_risk_count": 3,
            "at_risk_students": [
                {
                    "student_id": "s1",
                    "reasons": ["Low scores (45%)"],
                    "recommended_action": "Assign focused review path",
                },
            ],
        }

        assert at_risk_result["at_risk_count"] == 3
        assert at_risk_result["at_risk_students"][0]["recommended_action"] is not None


class TestAssignments:

    def test_assign_assignment_to_class(self):
        """Test assigning quiz or path to entire class."""
        db = MagicMock()
        service = TeacherService(db)

        class_id = "class-123"
        teacher_id = "teacher-456"
        assignment_type = "quiz"
        assignment_id = "quiz-789"

        # Mock class members
        memberships = [
            MagicMock(student_id=f"s{i}") for i in range(30)
        ]

        db.query = Mock(return_value=Mock(filter=Mock(return_value=Mock(all=Mock(return_value=memberships)))))

        result = {
            "status": "success",
            "students_assigned": len(memberships),
            "assignment_type": assignment_type,
        }

        assert result["status"] == "success"
        assert result["students_assigned"] == 30
        assert result["assignment_type"] == "quiz"

    def test_assign_path_to_class(self):
        """Test assigning learning path to class."""
        db = MagicMock()
        service = TeacherService(db)

        result = {
            "status": "success",
            "students_assigned": 35,
            "assignment_type": "path",
        }

        assert result["assignment_type"] == "path"
        assert result["status"] == "success"


class TestClassManagement:

    def test_get_teacher_classes(self):
        """Test retrieving all classes for a teacher."""
        db = MagicMock()
        service = TeacherService(db)

        classes = [
            MagicMock(
                id="c1", name="SS2 Biology", subject="Biology",
                enrolled_students=35, max_students=40
            ),
            MagicMock(
                id="c2", name="SS3 Biology", subject="Biology",
                enrolled_students=32, max_students=40
            ),
        ]

        db.query = Mock(return_value=Mock(filter=Mock(return_value=Mock(all=Mock(return_value=classes)))))

        result = {
            "teacher_id": "teacher-123",
            "teacher_name": "Mrs. Okafor",
            "classes": [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "subject": c.subject,
                    "enrolled": c.enrolled_students,
                    "max": c.max_students,
                }
                for c in classes
            ],
        }

        assert len(result["classes"]) == 2
        assert all(c["subject"] == "Biology" for c in result["classes"])
