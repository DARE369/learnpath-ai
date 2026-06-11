"""School admin dashboard service — ADMIN-2.1."""

import csv
import io
import secrets
import uuid
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import (
    AssignmentSubmission,
    AtRiskStudentCache,
    Class,
    ClassMembership,
    ClassMetadata,
    EngagementSnapshot,
    LoginActivity,
    Organization,
    SchoolActivityLog,
    SchoolAlert,
    SchoolHealthMetric,
    SchoolOnboarding,
    SchoolProfile,
    SchoolRecommendation,
    SchoolUserRole,
    StudentBulkUpload,
    Teacher,
    TeacherAssignment,
    TeacherInvitation,
    User,
    WeeklyDigestSnapshot,
)

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


class SchoolAdminService:

    # ── Access control ──────────────────────────────────────────────────────

    def _verify_access(self, db: Session, user_id: str, school_id: str) -> None:
        uid = uuid.UUID(user_id)
        sid = uuid.UUID(school_id)

        role = (
            db.query(SchoolUserRole)
            .filter_by(user_id=uid, school_id=sid)
            .first()
        )
        if role:
            return

        # Fallback: teacher with principal role in the org
        teacher = (
            db.query(Teacher)
            .filter_by(user_id=uid, organization_id=sid)
            .first()
        )
        if teacher and teacher.role in ("principal", "department_head"):
            return

        # Fallback: user.role == school_admin and org exists
        user = db.query(User).filter_by(id=uid).first()
        if user and user.role == "school_admin":
            org = db.query(Organization).filter_by(id=sid).first()
            if org:
                return

        raise HTTPException(status_code=403, detail="Access denied")

    # ── Logging ────────────────────────────────────────────────────────────

    def _log(
        self,
        db: Session,
        school_id: str,
        user_id: str,
        action: str,
        resource_type: str = "",
        resource_id: str = "",
        changes: Optional[Dict] = None,
    ) -> None:
        entry = SchoolActivityLog(
            school_id=uuid.UUID(school_id),
            actor_user_id=uuid.UUID(user_id),
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            changes=changes or {},
        )
        db.add(entry)

    # ── Health metrics ─────────────────────────────────────────────────────

    def _compute_health(self, db: Session, school_id: str) -> SchoolHealthMetric:
        sid = uuid.UUID(school_id)
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = now - timedelta(days=7)

        teachers = db.query(Teacher).filter_by(organization_id=sid).all()
        teacher_user_ids = [t.user_id for t in teachers if t.user_id]

        classes = db.query(Class).filter_by(organization_id=sid).all()
        class_ids = [c.id for c in classes]

        # Enrolled students (distinct users in class memberships)
        memberships = (
            db.query(ClassMembership)
            .filter(ClassMembership.class_id.in_(class_ids))
            .all()
        ) if class_ids else []
        student_ids = list({m.student_id for m in memberships})

        # Active teachers (login today)
        active_teachers = 0
        if teacher_user_ids:
            active_teachers = (
                db.query(LoginActivity)
                .filter(
                    LoginActivity.user_id.in_(teacher_user_ids),
                    LoginActivity.status == "success",
                    LoginActivity.created_at >= today_start,
                )
                .distinct(LoginActivity.user_id)
                .count()
            )

        # Active classes (submission today)
        active_classes = 0
        if class_ids:
            assignment_ids = [
                a.id
                for a in db.query(TeacherAssignment)
                .filter(TeacherAssignment.class_id.in_(class_ids))
                .all()
            ]
            if assignment_ids:
                active_class_set = set()
                subs = (
                    db.query(AssignmentSubmission)
                    .filter(
                        AssignmentSubmission.assignment_id.in_(assignment_ids),
                        AssignmentSubmission.submitted_at >= today_start,
                    )
                    .all()
                )
                for sub in subs:
                    assign = next(
                        (a for a in db.query(TeacherAssignment).filter_by(id=sub.assignment_id).all()),
                        None,
                    )
                    if assign:
                        active_class_set.add(str(assign.class_id))
                active_classes = len(active_class_set)

        # Avg student score from class memberships
        scores = [m.average_score for m in memberships if m.average_score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0.0

        # At-risk count
        at_risk = (
            db.query(AtRiskStudentCache)
            .filter(
                AtRiskStudentCache.school_id == sid,
                AtRiskStudentCache.risk_level.in_(["high", "critical"]),
            )
            .count()
        )

        # Assignments today
        assignments_today = 0
        if class_ids:
            assignments_today = (
                db.query(TeacherAssignment)
                .filter(
                    TeacherAssignment.class_id.in_(class_ids),
                    TeacherAssignment.created_at >= today_start,
                )
                .count()
            )

        # Submissions today
        submissions_today = 0
        if class_ids:
            assignment_ids2 = [
                a.id
                for a in db.query(TeacherAssignment)
                .filter(TeacherAssignment.class_id.in_(class_ids))
                .all()
            ]
            if assignment_ids2:
                submissions_today = (
                    db.query(AssignmentSubmission)
                    .filter(
                        AssignmentSubmission.assignment_id.in_(assignment_ids2),
                        AssignmentSubmission.submitted_at >= today_start,
                    )
                    .count()
                )

        # Growth rates
        teachers_week_ago = (
            db.query(Teacher)
            .filter(
                Teacher.organization_id == sid,
                Teacher.created_at < week_ago,
            )
            .count()
        )
        teacher_growth = (
            ((len(teachers) - teachers_week_ago) / max(teachers_week_ago, 1)) * 100
            if teachers_week_ago
            else 0.0
        )

        students_week_ago = (
            db.query(User)
            .filter(
                User.role.in_(["student", "user"]),
                User.created_at < week_ago,
            )
            .count()
        )
        student_growth = (
            ((len(student_ids) - students_week_ago) / max(students_week_ago, 1)) * 100
            if students_week_ago
            else 0.0
        )

        n_teachers = len(teachers)
        n_students = len(student_ids)
        engagement_trend = (
            (active_teachers + len(student_ids)) / max(n_teachers + n_students, 1) * 100
        )

        m = SchoolHealthMetric(
            school_id=sid,
            snapshot_at=now,
            total_teachers=n_teachers,
            active_teachers=active_teachers,
            total_students=n_students,
            enrolled_students=len(student_ids),
            total_classes=len(classes),
            active_classes=active_classes,
            teachers_active_today=(active_teachers / max(n_teachers, 1)) * 100,
            students_active_today=0.0,
            assignments_created_today=assignments_today,
            assignments_submitted_today=submissions_today,
            avg_student_score=round(avg_score, 2),
            at_risk_student_count=at_risk,
            storage_used_gb=0.0,
            videos_created=0,
            teacher_growth_pct=round(teacher_growth, 2),
            student_growth_pct=round(student_growth, 2),
            engagement_trend=round(engagement_trend, 2),
        )
        db.add(m)

        # Upsert daily snapshot
        snap = (
            db.query(EngagementSnapshot)
            .filter_by(school_id=sid, snapshot_date=date.today())
            .first()
        )
        if snap:
            snap.active_teachers = active_teachers
            snap.active_students = len(student_ids)
            snap.assignments_created = assignments_today
            snap.assignments_submitted = submissions_today
            snap.avg_student_score = round(avg_score, 2)
            snap.at_risk_count = at_risk
        else:
            db.add(
                EngagementSnapshot(
                    school_id=sid,
                    snapshot_date=date.today(),
                    active_teachers=active_teachers,
                    active_students=len(student_ids),
                    assignments_created=assignments_today,
                    assignments_submitted=submissions_today,
                    avg_student_score=round(avg_score, 2),
                    at_risk_count=at_risk,
                )
            )

        db.commit()
        db.refresh(m)
        return m

    def _get_health(self, db: Session, school_id: str) -> SchoolHealthMetric:
        sid = uuid.UUID(school_id)
        # Use cached metric if < 15 minutes old
        cutoff = datetime.utcnow() - timedelta(minutes=15)
        m = (
            db.query(SchoolHealthMetric)
            .filter(
                SchoolHealthMetric.school_id == sid,
                SchoolHealthMetric.created_at >= cutoff,
            )
            .order_by(SchoolHealthMetric.created_at.desc())
            .first()
        )
        return m or self._compute_health(db, school_id)

    # ── Weekly trends ──────────────────────────────────────────────────────

    def _weekly_trends(self, db: Session, school_id: str) -> Dict:
        sid = uuid.UUID(school_id)
        today = date.today()
        last_week_date = today - timedelta(days=7)

        this = (
            db.query(EngagementSnapshot)
            .filter_by(school_id=sid, snapshot_date=today)
            .first()
        )
        last = (
            db.query(EngagementSnapshot)
            .filter_by(school_id=sid, snapshot_date=last_week_date)
            .first()
        )

        if not this:
            return {}

        def delta(a: int, b: int) -> Dict:
            diff = a - b
            pct = round((diff / max(b, 1)) * 100, 1) if b else 0.0
            return {"this_week": a, "last_week": b, "change": diff, "change_pct": pct}

        lw = last
        return {
            "active_teachers": delta(this.active_teachers, lw.active_teachers if lw else 0),
            "active_students": delta(this.active_students, lw.active_students if lw else 0),
            "assignments_created": delta(this.assignments_created, lw.assignments_created if lw else 0),
            "assignments_submitted": delta(this.assignments_submitted, lw.assignments_submitted if lw else 0),
            "avg_score": delta(
                int(this.avg_student_score or 0),
                int(lw.avg_student_score if lw else 0),
            ),
            "at_risk_count": delta(this.at_risk_count, lw.at_risk_count if lw else 0),
            "storage_gb": {"this_week": round(this.storage_gb, 2), "last_week": round(lw.storage_gb if lw else 0, 2)},
        }

    # ── Alerts ─────────────────────────────────────────────────────────────

    def _get_alerts(self, db: Session, school_id: str) -> List[Dict]:
        sid = uuid.UUID(school_id)
        alerts = (
            db.query(SchoolAlert)
            .filter_by(school_id=sid, status="active")
            .order_by(SchoolAlert.created_at.desc())
            .limit(20)
            .all()
        )
        alerts_sorted = sorted(alerts, key=lambda a: SEVERITY_ORDER.get(a.severity, 9))

        return [
            {
                "id": str(a.id),
                "type": a.alert_type,
                "severity": a.severity,
                "title": a.title,
                "description": a.description,
                "actions": a.suggested_actions or [],
                "context": a.context_data or {},
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts_sorted
        ]

    # ── Activity timeline ──────────────────────────────────────────────────

    def _activity_timeline(self, db: Session, school_id: str) -> List[Dict]:
        sid = uuid.UUID(school_id)
        cutoff = datetime.utcnow() - timedelta(hours=24)
        logs = (
            db.query(SchoolActivityLog)
            .filter(
                SchoolActivityLog.school_id == sid,
                SchoolActivityLog.created_at >= cutoff,
            )
            .order_by(SchoolActivityLog.created_at.desc())
            .limit(20)
            .all()
        )

        action_messages = {
            "bulk_upload_students": "students enrolled from CSV",
            "create_class": "New class created",
            "invite_teacher": "Teacher invited",
            "start_onboarding": "School onboarding started",
            "complete_onboarding": "School onboarding completed",
            "dismiss_alert": "Alert dismissed",
            "resolve_alert": "Alert resolved",
        }

        result = []
        for log in logs:
            changes = log.changes or {}
            label = action_messages.get(log.action, log.action.replace("_", " ").capitalize())
            if log.action == "bulk_upload_students":
                count = changes.get("created", 0)
                label = f"{count} {label}"
            result.append(
                {
                    "timestamp": log.created_at.isoformat(),
                    "message": label,
                    "action": log.action,
                    "resource_type": log.resource_type,
                }
            )
        return result

    # ── Onboarding checklist ───────────────────────────────────────────────

    def _checklist(self, ob: SchoolOnboarding) -> List[Dict]:
        invited = ob.teachers_invited_count or 0
        needed = ob.teachers_needed or 30
        return [
            {
                "key": "profile",
                "item": "Complete school profile",
                "completed": ob.profile_complete,
                "action_url": "/school/settings/profile",
            },
            {
                "key": "teachers",
                "item": f"Invite teachers ({invited}/{needed})",
                "completed": invited >= needed,
                "action_url": "/school/teachers/invite",
            },
            {
                "key": "students",
                "item": "Upload student roster",
                "completed": ob.students_uploaded,
                "action_url": "/school/students/upload",
            },
            {
                "key": "google",
                "item": "Connect Google Classroom",
                "completed": ob.google_classroom_connected,
                "action_url": "/school/integrations/google",
                "optional": True,
            },
            {
                "key": "roles",
                "item": "Configure admin roles",
                "completed": ob.roles_configured,
                "action_url": "/school/settings/roles",
            },
        ]

    def _onboarding_pct(self, ob: SchoolOnboarding) -> int:
        checklist = self._checklist(ob)
        required = [c for c in checklist if not c.get("optional")]
        done = sum(1 for c in required if c["completed"])
        return round((done / max(len(required), 1)) * 100)

    # ── Dashboard ──────────────────────────────────────────────────────────

    def get_dashboard(self, db: Session, user_id: str, school_id: str) -> Dict:
        self._verify_access(db, user_id, school_id)

        sid = uuid.UUID(school_id)
        org = db.query(Organization).filter_by(id=sid).first()
        if not org:
            raise HTTPException(status_code=404, detail="School not found")

        profile = db.query(SchoolProfile).filter_by(organization_id=sid).first()
        h = self._get_health(db, school_id)

        max_teachers = (profile.max_teachers if profile else 50) or 50
        max_students = (profile.max_students if profile else 2000) or 2000
        max_storage = (profile.max_storage_gb if profile else 100) or 100

        alerts = self._get_alerts(db, school_id)
        activity = self._activity_timeline(db, school_id)
        trends = self._weekly_trends(db, school_id)

        ob = db.query(SchoolOnboarding).filter_by(school_id=sid).first()
        onboarding_active = ob and not ob.completed_at

        recs = (
            db.query(SchoolRecommendation)
            .filter_by(school_id=sid, dismissed=False)
            .order_by(SchoolRecommendation.priority.desc())
            .limit(5)
            .all()
        )

        user = db.query(User).filter_by(id=uuid.UUID(user_id)).first()

        return {
            "school": {
                "id": school_id,
                "name": org.name,
                "logo_url": profile.logo_url if profile else None,
                "timezone": (profile.timezone if profile else None) or "UTC",
            },
            "principal": {
                "name": user.full_name if user else "",
                "last_login": user.last_login.isoformat() if user and user.last_login else None,
            },
            "health_metrics": {
                "teachers": {
                    "total": h.total_teachers,
                    "active": h.active_teachers,
                    "max": max_teachers,
                    "active_pct": round(
                        (h.active_teachers / max(h.total_teachers, 1)) * 100, 1
                    ),
                    "trend": h.teacher_growth_pct,
                },
                "students": {
                    "total": h.total_students,
                    "enrolled": h.enrolled_students,
                    "max": max_students,
                    "enrolled_pct": round(
                        (h.enrolled_students / max(h.total_students, 1)) * 100, 1
                    ),
                    "trend": h.student_growth_pct,
                },
                "classes": {
                    "total": h.total_classes,
                    "active": h.active_classes,
                    "active_pct": round(
                        (h.active_classes / max(h.total_classes, 1)) * 100, 1
                    ),
                },
                "engagement": {
                    "teachers_active_today_pct": round(h.teachers_active_today, 1),
                    "students_active_today_pct": round(h.students_active_today, 1),
                    "assignments_created_today": h.assignments_created_today,
                    "assignments_submitted_today": h.assignments_submitted_today,
                },
                "performance": {
                    "avg_student_score": round(h.avg_student_score, 1),
                    "at_risk_count": h.at_risk_student_count,
                },
                "storage": {
                    "used_gb": round(h.storage_used_gb, 2),
                    "max_gb": max_storage,
                    "pct_used": round((h.storage_used_gb / max_storage) * 100, 1),
                },
            },
            "alerts": alerts,
            "engagement_heatmap": {
                "teachers_active_pct": round(h.teachers_active_today, 1),
                "students_active_pct": round(h.students_active_today, 1),
                "classes_active_pct": round(
                    (h.active_classes / max(h.total_classes, 1)) * 100, 1
                ),
                "assignments_submission_pct": round(
                    (h.assignments_submitted_today / max(h.assignments_created_today, 1)) * 100, 1
                )
                if h.assignments_created_today
                else 0.0,
                "last_updated": h.created_at.isoformat(),
            },
            "activity_timeline": activity,
            "weekly_trends": trends,
            "onboarding": {
                "active": bool(onboarding_active),
                "progress_pct": self._onboarding_pct(ob) if ob else 0,
                "checklist": self._checklist(ob) if ob else [],
            },
            "recommendations": [
                {
                    "id": str(r.id),
                    "type": r.recommendation_type,
                    "title": r.title,
                    "description": r.description,
                    "priority": r.priority,
                    "action_url": r.action_url,
                }
                for r in recs
            ],
            "last_updated": h.created_at.isoformat(),
        }

    def refresh_metrics(self, db: Session, user_id: str, school_id: str) -> Dict:
        self._verify_access(db, user_id, school_id)
        m = self._compute_health(db, school_id)
        return {"status": "ok", "snapshot_at": m.created_at.isoformat()}

    # ── Onboarding wizard ──────────────────────────────────────────────────

    def start_onboarding(
        self, db: Session, user_id: str, school_id: str, data: Dict
    ) -> Dict:
        sid = uuid.UUID(school_id)
        uid = uuid.UUID(user_id)

        # Upsert SchoolUserRole (principal)
        existing_role = db.query(SchoolUserRole).filter_by(user_id=uid, school_id=sid).first()
        if not existing_role:
            db.add(
                SchoolUserRole(
                    user_id=uid,
                    school_id=sid,
                    role_type="principal",
                    permissions={
                        "can_invite_teachers": True,
                        "can_upload_students": True,
                        "can_access_billing": True,
                        "can_delete_data": True,
                        "can_manage_roles": True,
                    },
                    scope="all",
                )
            )

        # Upsert SchoolProfile
        profile = db.query(SchoolProfile).filter_by(organization_id=sid).first()
        if not profile:
            profile = SchoolProfile(organization_id=sid)
            db.add(profile)

        profile.district_name = data.get("district_name") or profile.district_name
        profile.timezone = data.get("timezone", "UTC")
        profile.logo_url = data.get("logo_url") or profile.logo_url
        if data.get("school_name"):
            org = db.query(Organization).filter_by(id=sid).first()
            if org:
                org.name = data["school_name"]

        # Upsert SchoolOnboarding
        ob = db.query(SchoolOnboarding).filter_by(school_id=sid).first()
        if not ob:
            ob = SchoolOnboarding(school_id=sid, principal_id=uid)
            db.add(ob)
        ob.profile_complete = True
        ob.profile_completed_at = datetime.utcnow()
        ob.teachers_needed = data.get("teachers_needed", 30)

        db.commit()
        db.refresh(ob)

        ob.completion_percentage = self._onboarding_pct(ob)
        db.commit()

        self._log(db, school_id, user_id, "start_onboarding", "organization", school_id)
        db.commit()

        return {"status": "ok", "next_step": "invite_teachers", "onboarding_id": str(ob.id)}

    def update_onboarding_step(
        self, db: Session, user_id: str, school_id: str, step: str, data: Dict
    ) -> Dict:
        self._verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)

        ob = db.query(SchoolOnboarding).filter_by(school_id=sid).first()
        if not ob:
            raise HTTPException(status_code=404, detail="Onboarding not started")

        if step == "profile":
            ob.profile_complete = True
            ob.profile_completed_at = datetime.utcnow()
            profile = db.query(SchoolProfile).filter_by(organization_id=sid).first()
            if not profile:
                profile = SchoolProfile(organization_id=sid)
                db.add(profile)
            for k in ("district_name", "timezone", "logo_url", "phone", "address", "city", "state"):
                if data.get(k) is not None:
                    setattr(profile, k, data[k])

        elif step == "roles":
            ob.roles_configured = True
            ob.roles_configured_at = datetime.utcnow()

        elif step == "google":
            ob.google_classroom_connected = data.get("connected", False)
            if ob.google_classroom_connected:
                ob.google_classroom_connected_at = datetime.utcnow()

        ob.completion_percentage = self._onboarding_pct(ob)
        db.commit()
        return {"status": "ok", "completion_pct": ob.completion_percentage}

    def complete_onboarding(self, db: Session, user_id: str, school_id: str) -> Dict:
        self._verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)

        ob = db.query(SchoolOnboarding).filter_by(school_id=sid).first()
        if ob:
            ob.completed_at = datetime.utcnow()
            ob.completion_percentage = 100
            db.commit()

        self._log(db, school_id, user_id, "complete_onboarding", "organization", school_id)
        db.commit()
        return {"status": "ok"}

    def get_onboarding(self, db: Session, user_id: str, school_id: str) -> Dict:
        self._verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        ob = db.query(SchoolOnboarding).filter_by(school_id=sid).first()
        if not ob:
            return {"active": False, "checklist": [], "progress_pct": 0}
        return {
            "active": not ob.completed_at,
            "progress_pct": self._onboarding_pct(ob),
            "checklist": self._checklist(ob),
            "teachers_needed": ob.teachers_needed,
            "teachers_invited_count": ob.teachers_invited_count,
        }

    # ── Teacher invitations ────────────────────────────────────────────────

    def invite_teachers_bulk(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        teacher_list: List[Dict],
    ) -> Dict:
        self._verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)

        sent = 0
        skipped = 0
        errors: List[str] = []

        for item in teacher_list:
            email = (item.get("email") or "").strip().lower()
            if not email or "@" not in email:
                errors.append(f"Invalid email: {email!r}")
                continue

            # Skip if already invited
            existing = (
                db.query(TeacherInvitation)
                .filter_by(school_id=sid, email=email)
                .filter(TeacherInvitation.status.in_(["sent", "clicked"]))
                .first()
            )
            if existing:
                skipped += 1
                continue

            token = secrets.token_urlsafe(32)
            invite = TeacherInvitation(
                school_id=sid,
                invited_by_id=uuid.UUID(user_id),
                email=email,
                first_name=item.get("first_name"),
                last_name=item.get("last_name"),
                invite_token=token,
                invite_url=f"/onboarding/teacher?token={token}",
                expires_at=datetime.utcnow() + timedelta(days=30),
                status="sent",
                sent_at=datetime.utcnow(),
            )
            db.add(invite)
            sent += 1

        # Update onboarding count
        ob = db.query(SchoolOnboarding).filter_by(school_id=sid).first()
        if ob:
            ob.teachers_invited_count = (ob.teachers_invited_count or 0) + sent
            ob.teachers_invitations_sent_at = datetime.utcnow()
            ob.completion_percentage = self._onboarding_pct(ob)

        self._log(
            db,
            school_id,
            user_id,
            "invite_teacher",
            "teacher",
            "",
            {"sent": sent, "skipped": skipped},
        )
        db.commit()

        return {
            "sent": sent,
            "skipped": skipped,
            "errors": errors,
            "total_invited": (ob.teachers_invited_count if ob else sent),
        }

    def get_invitations(self, db: Session, user_id: str, school_id: str) -> List[Dict]:
        self._verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        invites = (
            db.query(TeacherInvitation)
            .filter_by(school_id=sid)
            .order_by(TeacherInvitation.created_at.desc())
            .all()
        )
        return [
            {
                "id": str(i.id),
                "email": i.email,
                "first_name": i.first_name,
                "last_name": i.last_name,
                "status": i.status,
                "invite_url": i.invite_url,
                "sent_at": i.sent_at.isoformat() if i.sent_at else None,
                "expires_at": i.expires_at.isoformat() if i.expires_at else None,
                "accepted_at": i.accepted_at.isoformat() if i.accepted_at else None,
            }
            for i in invites
        ]

    # ── Student bulk upload ────────────────────────────────────────────────

    def upload_students_csv(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        csv_text: str,
        filename: str = "students.csv",
    ) -> Dict:
        self._verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)

        job = StudentBulkUpload(
            school_id=sid,
            uploaded_by_id=uuid.UUID(user_id),
            filename=filename,
            file_size_bytes=len(csv_text.encode()),
            status="processing",
            started_at=datetime.utcnow(),
        )
        db.add(job)
        db.flush()

        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
        job.total_rows = len(rows)

        created = 0
        existing_count = 0
        errors: List[Dict] = []

        for i, row in enumerate(rows, start=1):
            email = (row.get("email") or "").strip().lower()
            name = (row.get("name") or row.get("full_name") or "").strip()
            if not email or "@" not in email:
                errors.append({"row": i, "error": f"Invalid email: {email!r}"})
                job.failed_rows = (job.failed_rows or 0) + 1
                continue

            existing = db.query(User).filter_by(email=email).first()
            if existing:
                existing_count += 1
            else:
                new_user = User(
                    email=email,
                    full_name=name or email.split("@")[0],
                    role="student",
                    account_active=True,
                )
                db.add(new_user)
                created += 1

            job.processed_rows = (job.processed_rows or 0) + 1
            job.successful_rows = (job.successful_rows or 0) + 1

        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.error_log = errors
        job.created_student_count = created
        job.existing_student_count = existing_count
        job.enrollment_errors = len(errors)

        # Update onboarding
        ob = db.query(SchoolOnboarding).filter_by(school_id=sid).first()
        if ob:
            ob.students_uploaded = True
            ob.students_uploaded_count = (ob.students_uploaded_count or 0) + created
            ob.students_upload_completed_at = datetime.utcnow()
            ob.completion_percentage = self._onboarding_pct(ob)

        self._log(
            db,
            school_id,
            user_id,
            "bulk_upload_students",
            "student",
            str(job.id),
            {"created": created, "existing": existing_count, "errors": len(errors)},
        )
        db.commit()

        return {
            "job_id": str(job.id),
            "total_rows": job.total_rows,
            "created": created,
            "existing": existing_count,
            "errors": errors[:20],
            "status": "completed",
        }

    # ── Alerts ─────────────────────────────────────────────────────────────

    def dismiss_alert(self, db: Session, user_id: str, school_id: str, alert_id: str) -> Dict:
        self._verify_access(db, user_id, school_id)
        alert = db.query(SchoolAlert).filter_by(id=uuid.UUID(alert_id)).first()
        if not alert or str(alert.school_id) != school_id:
            raise HTTPException(status_code=404, detail="Alert not found")
        alert.status = "muted"
        alert.muted_at = datetime.utcnow()
        self._log(db, school_id, user_id, "dismiss_alert", "alert", alert_id)
        db.commit()
        return {"status": "muted"}

    def resolve_alert(self, db: Session, user_id: str, school_id: str, alert_id: str) -> Dict:
        self._verify_access(db, user_id, school_id)
        alert = db.query(SchoolAlert).filter_by(id=uuid.UUID(alert_id)).first()
        if not alert or str(alert.school_id) != school_id:
            raise HTTPException(status_code=404, detail="Alert not found")
        alert.status = "resolved"
        alert.resolved_at = datetime.utcnow()
        self._log(db, school_id, user_id, "resolve_alert", "alert", alert_id)
        db.commit()
        return {"status": "resolved"}

    # ── Recommendations ────────────────────────────────────────────────────

    def dismiss_recommendation(
        self, db: Session, user_id: str, school_id: str, rec_id: str
    ) -> Dict:
        self._verify_access(db, user_id, school_id)
        rec = db.query(SchoolRecommendation).filter_by(id=uuid.UUID(rec_id)).first()
        if not rec or str(rec.school_id) != school_id:
            raise HTTPException(status_code=404, detail="Recommendation not found")
        rec.dismissed = True
        rec.dismissed_at = datetime.utcnow()
        db.commit()
        return {"status": "dismissed"}

    # ── Class management (ADMIN-2.3) ─────────────────────────────────────────

    def _ensure_class_metadata(self, db: Session, class_obj) -> ClassMetadata:
        meta = db.query(ClassMetadata).filter_by(class_id=class_obj.id).first()
        if not meta:
            meta = ClassMetadata(class_id=class_obj.id, teacher_id=class_obj.teacher_id)
            db.add(meta)
            db.flush()
        return meta

    def _require_class(self, db: Session, school_id: str, class_id: str):
        c = db.query(Class).filter_by(id=uuid.UUID(class_id)).first()
        if not c or str(c.organization_id) != school_id:
            raise HTTPException(status_code=404, detail="Class not found")
        return c

    def _class_row(self, db: Session, c, meta_by_id, counts) -> Dict:
        from services.teacher_service import _status_for  # noqa
        meta = meta_by_id.get(c.id)
        teacher = db.query(Teacher).filter_by(id=c.teacher_id).first() if c.teacher_id else None
        n = counts.get(c.id, {}).get("n", 0)
        avg = counts.get(c.id, {}).get("avg", 0)
        return {
            "class_id": str(c.id),
            "name": c.name,
            "subject": c.subject,
            "teacher": teacher.name if teacher else "Unassigned",
            "teacher_id": str(c.teacher_id) if c.teacher_id else None,
            "grade_level": meta.grade_level if meta else None,
            "students": n,
            "max_students": c.max_students or 0,
            "capacity_pct": round(n / c.max_students * 100) if c.max_students else 0,
            "status": "archived" if (meta and meta.is_archived) else "active",
            "avg_score": avg,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }

    def list_classes(self, db: Session, user_id: str, school_id: str, *, search=None,
                     status="active", grade=None, teacher_id=None, sort_by="name",
                     page=1, page_size=50) -> Dict:
        self._verify_access(db, user_id, school_id)
        classes = db.query(Class).filter_by(organization_id=uuid.UUID(school_id)).all()
        class_ids = [c.id for c in classes]
        metas = {m.class_id: m for m in db.query(ClassMetadata).filter(ClassMetadata.class_id.in_(class_ids)).all()} if class_ids else {}

        # Roster counts + avg score per class.
        counts: Dict = {}
        if class_ids:
            for m in db.query(ClassMembership).filter(
                ClassMembership.class_id.in_(class_ids), ClassMembership.enrollment_status == "active"
            ).all():
                d = counts.setdefault(m.class_id, {"n": 0, "sum": 0})
                d["n"] += 1
                d["sum"] += (m.average_score or 0)
            for cid, d in counts.items():
                d["avg"] = round(d["sum"] / d["n"], 1) if d["n"] else 0

        rows = [self._class_row(db, c, metas, counts) for c in classes]
        if status == "active":
            rows = [r for r in rows if r["status"] == "active"]
        elif status == "archived":
            rows = [r for r in rows if r["status"] == "archived"]
        if search:
            q = search.strip().lower()
            rows = [r for r in rows if q in (r["name"] or "").lower() or q in (r["teacher"] or "").lower()]
        if grade is not None:
            rows = [r for r in rows if r["grade_level"] == grade]
        if teacher_id:
            rows = [r for r in rows if r["teacher_id"] == teacher_id]

        if sort_by == "students":
            rows.sort(key=lambda r: r["students"], reverse=True)
        elif sort_by == "avg_score":
            rows.sort(key=lambda r: r["avg_score"], reverse=True)
        elif sort_by == "teacher":
            rows.sort(key=lambda r: (r["teacher"] or "").lower())
        elif sort_by == "created":
            rows.sort(key=lambda r: r["created_at"] or "", reverse=True)
        else:
            rows.sort(key=lambda r: (r["name"] or "").lower())

        total = len(rows)
        start = (max(1, page) - 1) * page_size
        return {"classes": rows[start:start + page_size],
                "pagination": {"page": page, "page_size": page_size, "total": total,
                               "pages": max(1, (total + page_size - 1) // page_size)}}

    def get_class_detail(self, db: Session, user_id: str, school_id: str, class_id: str) -> Dict:
        from services.teacher_service import _status_for, _alert_for
        self._verify_access(db, user_id, school_id)
        c = self._require_class(db, school_id, class_id)
        meta = db.query(ClassMetadata).filter_by(class_id=c.id).first()
        teacher = db.query(Teacher).filter_by(id=c.teacher_id).first() if c.teacher_id else None

        members = db.query(ClassMembership).filter_by(class_id=c.id, enrollment_status="active").all()
        sids = [m.student_id for m in members]
        users = {u.id: u for u in db.query(User).filter(User.id.in_(sids)).all()} if sids else {}
        roster = []
        for m in members:
            u = users.get(m.student_id)
            roster.append({
                "student_id": str(m.student_id),
                "name": (u.full_name if u and u.full_name else (u.email.split("@")[0] if u and u.email else "Student")),
                "email": u.email if u else None,
                "score": m.average_score or 0,
                "status": _status_for(m),
            })
        roster.sort(key=lambda r: r["name"].lower())

        # Submission rate across the class's assignments.
        a_ids = [a.id for a in db.query(TeacherAssignment).filter_by(class_id=c.id).all()]
        sub_rate = None
        if a_ids:
            subs = db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id.in_(a_ids)).all()
            if subs:
                done = sum(1 for s in subs if s.status in ("submitted", "pending_manual", "graded"))
                sub_rate = round(done / len(subs) * 100)

        activity = (
            db.query(SchoolActivityLog)
            .filter(SchoolActivityLog.school_id == uuid.UUID(school_id),
                    SchoolActivityLog.resource_id == str(c.id))
            .order_by(SchoolActivityLog.created_at.desc())
            .limit(20)
            .all()
        )
        n = len(roster)
        return {
            "class_id": str(c.id),
            "name": c.name,
            "subject": c.subject,
            "description": c.description,
            "teacher": teacher.name if teacher else "Unassigned",
            "teacher_id": str(c.teacher_id) if c.teacher_id else None,
            "grade_level": meta.grade_level if meta else None,
            "status": "archived" if (meta and meta.is_archived) else "active",
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "capacity": {"current": n, "max": c.max_students or 0,
                         "pct_full": round(n / c.max_students * 100) if c.max_students else 0},
            "stats": {
                "students": n,
                "avg_score": round(sum(r["score"] for r in roster) / n, 1) if n else 0,
                "submission_rate": sub_rate,
                "at_risk_count": sum(1 for m in members if _alert_for(m)),
            },
            "roster": roster,
            "activity": [{"action": a.action, "resource_type": a.resource_type,
                          "changes": a.changes, "at": a.created_at.isoformat()} for a in activity],
        }

    def create_class(self, db: Session, user_id: str, school_id: str, data: Dict) -> Dict:
        self._verify_access(db, user_id, school_id)
        name = (data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Class name is required")
        teacher_id = data.get("teacher_id")
        c = Class(
            organization_id=uuid.UUID(school_id),
            teacher_id=uuid.UUID(teacher_id) if teacher_id else None,
            name=name,
            subject=data.get("subject"),
            description=data.get("description"),
            max_students=int(data.get("max_students") or 30),
        )
        db.add(c)
        db.flush()
        meta = ClassMetadata(class_id=c.id, teacher_id=c.teacher_id, grade_level=data.get("grade_level"))
        db.add(meta)
        added = 0
        for sid in (data.get("student_ids") or []):
            try:
                db.add(ClassMembership(class_id=c.id, student_id=uuid.UUID(str(sid)), enrollment_status="active"))
                added += 1
            except (ValueError, TypeError):
                continue
        c.enrolled_students = added
        self._log(db, school_id, user_id, "create_class", "class", str(c.id), {"name": name, "students": added})
        db.commit()
        return {"status": "created", "class_id": str(c.id), "students_added": added}

    def update_class(self, db: Session, user_id: str, school_id: str, class_id: str, data: Dict) -> Dict:
        self._verify_access(db, user_id, school_id)
        c = self._require_class(db, school_id, class_id)
        meta = self._ensure_class_metadata(db, c)
        changes: Dict = {}
        for field in ("name", "subject", "description"):
            if field in data and data[field] != getattr(c, field):
                changes[field] = {"old": getattr(c, field), "new": data[field]}
                setattr(c, field, data[field])
        if "max_students" in data and data["max_students"] is not None:
            changes["max_students"] = {"old": c.max_students, "new": data["max_students"]}
            c.max_students = int(data["max_students"])
        if "teacher_id" in data:
            tid = uuid.UUID(data["teacher_id"]) if data["teacher_id"] else None
            if tid != c.teacher_id:
                changes["teacher_id"] = {"old": str(c.teacher_id), "new": str(tid)}
                c.teacher_id = tid
                meta.teacher_id = tid or meta.teacher_id
        if "grade_level" in data and data["grade_level"] != meta.grade_level:
            changes["grade_level"] = {"old": meta.grade_level, "new": data["grade_level"]}
            meta.grade_level = data["grade_level"]
        if changes:
            self._log(db, school_id, user_id, "update_class", "class", str(c.id), changes)
        db.commit()
        return {"status": "updated", "changes": len(changes)}

    def duplicate_class(self, db: Session, user_id: str, school_id: str, class_id: str, data: Dict) -> Dict:
        self._verify_access(db, user_id, school_id)
        src = self._require_class(db, school_id, class_id)
        src_meta = db.query(ClassMetadata).filter_by(class_id=src.id).first()
        new_teacher = data.get("teacher_id")
        new = Class(
            organization_id=src.organization_id,
            teacher_id=uuid.UUID(new_teacher) if new_teacher else src.teacher_id,
            name=(data.get("new_name") or f"{src.name} (copy)").strip(),
            subject=src.subject,
            description=src.description,
            max_students=src.max_students,
        )
        db.add(new)
        db.flush()
        db.add(ClassMetadata(class_id=new.id, teacher_id=new.teacher_id,
                             grade_level=src_meta.grade_level if src_meta else None))
        students = assignments = 0
        if data.get("copy_roster"):
            for m in db.query(ClassMembership).filter_by(class_id=src.id, enrollment_status="active").all():
                db.add(ClassMembership(class_id=new.id, student_id=m.student_id, enrollment_status="active"))
                students += 1
            new.enrolled_students = students
        if data.get("copy_assignments"):
            for a in db.query(TeacherAssignment).filter_by(class_id=src.id).all():
                db.add(TeacherAssignment(
                    teacher_id=a.teacher_id, class_id=new.id, name=a.name, description=a.description,
                    assignment_type=a.assignment_type, content_data=a.content_data,
                    deadline_type=a.deadline_type, assigned_to_type=a.assigned_to_type,
                ))
                assignments += 1
        self._log(db, school_id, user_id, "duplicate_class", "class", str(src.id),
                  {"new_class_id": str(new.id), "students": students, "assignments": assignments})
        db.commit()
        return {"status": "duplicated", "new_class_id": str(new.id),
                "students_copied": students, "assignments_copied": assignments}

    def merge_classes(self, db: Session, user_id: str, school_id: str, source_id: str, data: Dict) -> Dict:
        self._verify_access(db, user_id, school_id)
        src = self._require_class(db, school_id, source_id)
        target_id = data.get("target_class_id")
        if not target_id:
            raise HTTPException(status_code=400, detail="target_class_id required")
        tgt = self._require_class(db, school_id, target_id)
        resolution = data.get("conflict_resolution", "skip")  # skip | add_anyway

        existing = {m.student_id for m in db.query(ClassMembership).filter_by(class_id=tgt.id).all()}
        moved = skipped = 0
        for m in db.query(ClassMembership).filter_by(class_id=src.id).all():
            if m.student_id in existing:
                if resolution == "skip":
                    skipped += 1
                    continue
            else:
                db.add(ClassMembership(class_id=tgt.id, student_id=m.student_id,
                                       enrollment_status=m.enrollment_status,
                                       progress_percent=m.progress_percent, average_score=m.average_score,
                                       last_active=m.last_active))
                existing.add(m.student_id)
                moved += 1
            db.delete(m)
        a_count = 0
        for a in db.query(TeacherAssignment).filter_by(class_id=src.id).all():
            a.class_id = tgt.id
            a_count += 1
        tgt.enrolled_students = db.query(ClassMembership).filter_by(class_id=tgt.id, enrollment_status="active").count()
        if data.get("archive_source", True):
            meta = self._ensure_class_metadata(db, src)
            meta.is_archived = True
            meta.archived_at = datetime.utcnow()
        self._log(db, school_id, user_id, "merge_class", "class", str(src.id),
                  {"target": str(tgt.id), "moved": moved, "skipped": skipped, "assignments": a_count})
        db.commit()
        return {"status": "merged", "students_moved": moved, "students_skipped": skipped,
                "assignments_transferred": a_count, "source_archived": bool(data.get("archive_source", True))}

    def set_archived(self, db: Session, user_id: str, school_id: str, class_id: str, archived: bool) -> Dict:
        self._verify_access(db, user_id, school_id)
        c = self._require_class(db, school_id, class_id)
        meta = self._ensure_class_metadata(db, c)
        meta.is_archived = archived
        meta.archived_at = datetime.utcnow() if archived else None
        self._log(db, school_id, user_id, "archive_class" if archived else "restore_class", "class", str(c.id))
        db.commit()
        return {"status": "archived" if archived else "active"}

    def delete_class(self, db: Session, user_id: str, school_id: str, class_id: str) -> Dict:
        self._verify_access(db, user_id, school_id)
        c = self._require_class(db, school_id, class_id)
        db.query(ClassMembership).filter_by(class_id=c.id).delete()
        db.query(ClassMetadata).filter_by(class_id=c.id).delete()
        self._log(db, school_id, user_id, "delete_class", "class", str(c.id), {"name": c.name})
        db.delete(c)
        db.commit()
        return {"status": "deleted"}

    def add_to_roster(self, db: Session, user_id: str, school_id: str, class_id: str,
                      student_ids: List[str]) -> Dict:
        self._verify_access(db, user_id, school_id)
        c = self._require_class(db, school_id, class_id)
        added = skipped = 0
        for raw_id in student_ids:
            try:
                sid = uuid.UUID(str(raw_id))
            except (ValueError, AttributeError):
                continue
            exists = db.query(ClassMembership).filter_by(class_id=c.id, student_id=sid).first()
            if exists:
                if exists.enrollment_status != "active":
                    exists.enrollment_status = "active"
                    added += 1
                else:
                    skipped += 1
                continue
            db.add(ClassMembership(class_id=c.id, student_id=sid, enrollment_status="active"))
            added += 1
        c.enrolled_students = db.query(ClassMembership).filter_by(
            class_id=c.id, enrollment_status="active"
        ).count()
        self._log(db, school_id, user_id, "roster_add", "class", str(c.id),
                  {"added": added, "skipped": skipped})
        db.commit()
        return {"status": "ok", "added": added, "skipped": skipped}

    def remove_from_roster(self, db: Session, user_id: str, school_id: str, class_id: str,
                           student_ids: List[str]) -> Dict:
        self._verify_access(db, user_id, school_id)
        c = self._require_class(db, school_id, class_id)
        removed = 0
        for raw_id in student_ids:
            try:
                sid = uuid.UUID(str(raw_id))
            except (ValueError, AttributeError):
                continue
            rows = db.query(ClassMembership).filter_by(class_id=c.id, student_id=sid).delete()
            removed += rows
        c.enrolled_students = db.query(ClassMembership).filter_by(
            class_id=c.id, enrollment_status="active"
        ).count()
        self._log(db, school_id, user_id, "roster_remove", "class", str(c.id),
                  {"removed": removed})
        db.commit()
        return {"status": "ok", "removed": removed}


school_admin_service = SchoolAdminService()
