"""Teacher & student management service — ADMIN-2.2."""

import secrets
import uuid
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import (
    AssignmentSubmission,
    BulkManagementOperation,
    Class,
    ClassEnrollmentAudit,
    ClassMembership,
    ClassReassignmentHistory,
    LoginActivity,
    Organization,
    ParentContact,
    ParentCommunicationLog,
    SchoolActivityLog,
    SchoolUserRole,
    StudentDeactivationRecord,
    StudentSchoolProfile,
    Teacher,
    TeacherActivityLog,
    TeacherAssignment,
    TeacherDeactivationRecord,
    TeacherInvitation,
    TeacherSchoolProfile,
    User,
)


def _verify_access(db: Session, user_id: str, school_id: str) -> None:
    uid = uuid.UUID(user_id)
    sid = uuid.UUID(school_id)
    role = db.query(SchoolUserRole).filter_by(user_id=uid, school_id=sid).first()
    if role:
        return
    teacher = db.query(Teacher).filter_by(user_id=uid, organization_id=sid).first()
    if teacher and teacher.role in ("principal", "department_head"):
        return
    user = db.query(User).filter_by(id=uid).first()
    if user and user.role == "school_admin":
        org = db.query(Organization).filter_by(id=sid).first()
        if org:
            return
    raise HTTPException(status_code=403, detail="Access denied")


def _rel_time(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    diff = datetime.utcnow() - dt
    if diff.days == 0:
        mins = diff.seconds // 60
        if mins < 2:
            return "just now"
        if mins < 60:
            return f"{mins} minutes ago"
        return f"{diff.seconds // 3600} hours ago"
    if diff.days == 1:
        return "yesterday"
    if diff.days < 7:
        return f"{diff.days} days ago"
    return dt.strftime("%b %d, %Y")


class TeacherStudentMgmtService:

    # ── Teachers list ──────────────────────────────────────────────────────

    def get_teachers_list(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        search: Optional[str] = None,
        filter_status: Optional[str] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
        page: int = 1,
        page_size: int = 50,
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)

        # All teachers in school
        teacher_q = db.query(Teacher).filter_by(organization_id=sid)
        if search:
            search_lower = f"%{search.lower()}%"
            teacher_q = teacher_q.filter(
                or_(
                    Teacher.name.ilike(search_lower),
                    Teacher.email.ilike(search_lower),
                )
            )
        teachers = teacher_q.all()

        # Collect user IDs for joining with User model
        teacher_user_map: Dict[str, Teacher] = {str(t.user_id): t for t in teachers if t.user_id}

        # Filter by status using SchoolProfile
        results = []
        for t in teachers:
            prof = (
                db.query(TeacherSchoolProfile)
                .filter_by(teacher_id=t.user_id, school_id=sid)
                .first()
            ) if t.user_id else None

            user = db.query(User).filter_by(id=t.user_id).first() if t.user_id else None

            status = self._teacher_status(t, prof)
            if filter_status and filter_status != status:
                continue

            # Class count
            class_count = db.query(Class).filter_by(teacher_id=t.id, organization_id=sid).count()

            # Student count via memberships
            classes = db.query(Class).filter_by(teacher_id=t.id, organization_id=sid).all()
            class_ids = [c.id for c in classes]
            student_count = 0
            if class_ids:
                student_count = (
                    db.query(ClassMembership)
                    .filter(ClassMembership.class_id.in_(class_ids))
                    .distinct(ClassMembership.student_id)
                    .count()
                )

            # Last login
            last_login = None
            if t.user_id:
                ll = (
                    db.query(LoginActivity)
                    .filter_by(user_id=t.user_id, status="success")
                    .order_by(LoginActivity.created_at.desc())
                    .first()
                )
                last_login = ll.created_at if ll else None

            results.append(
                {
                    "teacher_id": str(t.user_id) if t.user_id else str(t.id),
                    "teacher_record_id": str(t.id),
                    "name": t.name,
                    "email": t.email,
                    "classes": class_count,
                    "students": student_count,
                    "status": status,
                    "last_active": _rel_time(last_login),
                    "last_active_raw": last_login.isoformat() if last_login else None,
                    "avatar_url": user.profile_image_url if user else None,
                    "department": prof.department if prof else None,
                }
            )

        # Sort
        sort_key = {
            "name": lambda r: (r["name"] or "").lower(),
            "students": lambda r: r["students"],
            "classes": lambda r: r["classes"],
            "activity": lambda r: r["last_active_raw"] or "",
        }.get(sort_by, lambda r: (r["name"] or "").lower())

        results.sort(key=sort_key, reverse=(sort_order == "desc"))

        total = len(results)
        start = (page - 1) * page_size
        return {
            "teachers": results[start : start + page_size],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": max(1, (total + page_size - 1) // page_size),
            },
        }

    def _teacher_status(self, teacher: Teacher, prof: Optional[TeacherSchoolProfile]) -> str:
        if prof and not prof.is_active:
            return "inactive"
        if prof and prof.is_invited and not prof.accepted_invitation_at:
            return "invited"
        return "active"

    # ── Teacher profile ────────────────────────────────────────────────────

    def get_teacher_profile(
        self, db: Session, user_id: str, school_id: str, teacher_id: str
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        tid = uuid.UUID(teacher_id)

        user = db.query(User).filter_by(id=tid).first()
        teacher = db.query(Teacher).filter_by(user_id=tid, organization_id=sid).first()
        if not teacher and not user:
            raise HTTPException(status_code=404, detail="Teacher not found")

        prof = db.query(TeacherSchoolProfile).filter_by(teacher_id=tid, school_id=sid).first()

        # Classes
        classes_data = []
        if teacher:
            classes = db.query(Class).filter_by(teacher_id=teacher.id, organization_id=sid).all()
            for cls in classes:
                student_count = (
                    db.query(ClassMembership).filter_by(class_id=cls.id).count()
                )
                classes_data.append(
                    {
                        "class_id": str(cls.id),
                        "name": cls.name,
                        "subject": cls.subject,
                        "students": student_count,
                    }
                )

        # Activity summary (last 30 days)
        cutoff = datetime.utcnow() - timedelta(days=30)
        logs = (
            db.query(TeacherActivityLog)
            .filter(
                TeacherActivityLog.teacher_id == tid,
                TeacherActivityLog.school_id == sid,
                TeacherActivityLog.created_at >= cutoff,
            )
            .all()
        )
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = now - timedelta(days=7)

        activity_summary = {
            "logins_today": 0,
            "logins_week": 0,
            "assignments_created": 0,
            "messages_sent": 0,
        }
        for log in logs:
            if log.created_at >= today_start and log.activity_type == "login":
                activity_summary["logins_today"] += 1
            if log.created_at >= week_ago:
                if log.activity_type == "login":
                    activity_summary["logins_week"] += 1
                elif log.activity_type == "create_assignment":
                    activity_summary["assignments_created"] += 1
                elif log.activity_type == "message_student":
                    activity_summary["messages_sent"] += 1

        ll = (
            db.query(LoginActivity)
            .filter_by(user_id=tid, status="success")
            .order_by(LoginActivity.created_at.desc())
            .first()
        )

        # Reassignment history
        reassignments = (
            db.query(ClassReassignmentHistory)
            .filter(
                ClassReassignmentHistory.school_id == sid,
                ClassReassignmentHistory.from_teacher_id == tid,
            )
            .order_by(ClassReassignmentHistory.reassigned_at.desc())
            .limit(5)
            .all()
        )

        return {
            "teacher_id": teacher_id,
            "teacher_record_id": str(teacher.id) if teacher else None,
            "name": user.full_name if user else (teacher.name if teacher else ""),
            "email": user.email if user else (teacher.email if teacher else ""),
            "avatar_url": user.profile_image_url if user else None,
            "status": self._teacher_status(teacher, prof) if teacher else "unknown",
            "department": prof.department if prof else None,
            "hire_date": prof.hire_date.isoformat() if prof and prof.hire_date else None,
            "classes": classes_data,
            "activity": {
                "last_login": ll.created_at.isoformat() if ll else None,
                "last_login_relative": _rel_time(ll.created_at if ll else None),
                **activity_summary,
            },
            "reassignment_history": [
                {
                    "class_id": str(r.class_id),
                    "to_teacher_id": str(r.to_teacher_id) if r.to_teacher_id else None,
                    "reassigned_at": r.reassigned_at.isoformat(),
                }
                for r in reassignments
            ],
        }

    # ── Invite single teacher ──────────────────────────────────────────────

    def invite_teacher(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        email: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        uid = uuid.UUID(user_id)

        email = email.strip().lower()
        if not email or "@" not in email:
            raise HTTPException(status_code=422, detail="Invalid email")

        existing = (
            db.query(TeacherInvitation)
            .filter_by(school_id=sid, email=email)
            .filter(TeacherInvitation.status.in_(["sent", "clicked"]))
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Invitation already sent")

        token = secrets.token_urlsafe(32)
        inv = TeacherInvitation(
            school_id=sid,
            invited_by_id=uid,
            email=email,
            first_name=first_name,
            last_name=last_name,
            invite_token=token,
            invite_url=f"/onboarding/teacher?token={token}",
            expires_at=datetime.utcnow() + timedelta(days=30),
            status="sent",
            sent_at=datetime.utcnow(),
        )
        db.add(inv)
        db.commit()
        return {"status": "sent", "invite_url": inv.invite_url, "email": email}

    # ── Deactivate teacher ─────────────────────────────────────────────────

    def deactivate_teacher(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        teacher_id: str,
        reason: str = "",
        handle_classes: str = "keep",
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        tid = uuid.UUID(teacher_id)
        uid = uuid.UUID(user_id)

        teacher = db.query(Teacher).filter_by(user_id=tid, organization_id=sid).first()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")

        classes = db.query(Class).filter_by(teacher_id=teacher.id, organization_id=sid).all()
        archived: List[Dict] = []

        if handle_classes == "archive":
            for cls in classes:
                cls.is_active = False  # type: ignore[assignment]
                archived.append({"class_id": str(cls.id), "archived_at": datetime.utcnow().isoformat()})

        # Deactivate user
        user = db.query(User).filter_by(id=tid).first()
        if user:
            user.account_active = False

        # Update profile
        prof = db.query(TeacherSchoolProfile).filter_by(teacher_id=tid, school_id=sid).first()
        if prof:
            prof.is_active = False
            prof.deactivated_at = datetime.utcnow()
            prof.deactivation_reason = reason
        else:
            db.add(
                TeacherSchoolProfile(
                    teacher_id=tid,
                    school_id=sid,
                    is_active=False,
                    deactivated_at=datetime.utcnow(),
                    deactivation_reason=reason,
                )
            )

        db.add(
            TeacherDeactivationRecord(
                teacher_id=tid,
                school_id=sid,
                deactivated_by_user_id=uid,
                reason=reason,
                classes_archived=archived,
            )
        )

        log = SchoolActivityLog(
            school_id=sid,
            actor_user_id=uid,
            action="deactivate_teacher",
            resource_type="teacher",
            resource_id=teacher_id,
            changes={"reason": reason, "handle_classes": handle_classes},
        )
        db.add(log)
        db.commit()

        return {"status": "deactivated", "teacher_id": teacher_id, "classes_handled": len(archived)}

    def reactivate_teacher(
        self, db: Session, user_id: str, school_id: str, teacher_id: str
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        tid = uuid.UUID(teacher_id)
        uid = uuid.UUID(user_id)

        user = db.query(User).filter_by(id=tid).first()
        if user:
            user.account_active = True

        prof = db.query(TeacherSchoolProfile).filter_by(teacher_id=tid, school_id=sid).first()
        if prof:
            prof.is_active = True
            prof.deactivated_at = None

        rec = (
            db.query(TeacherDeactivationRecord)
            .filter_by(teacher_id=tid, school_id=sid)
            .order_by(TeacherDeactivationRecord.created_at.desc())
            .first()
        )
        if rec:
            rec.reactivated_at = datetime.utcnow()
            rec.reactivated_by_user_id = uid

        log = SchoolActivityLog(
            school_id=sid, actor_user_id=uid,
            action="reactivate_teacher", resource_type="teacher", resource_id=teacher_id,
        )
        db.add(log)
        db.commit()
        return {"status": "reactivated", "teacher_id": teacher_id}

    # ── Reassign classes ───────────────────────────────────────────────────

    def reassign_classes(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        from_teacher_id: str,
        to_teacher_id: str,
        class_ids: Optional[List[str]] = None,
        transfer_assignments: bool = False,
        transfer_grades: bool = False,
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        from_tid = uuid.UUID(from_teacher_id)
        to_tid = uuid.UUID(to_teacher_id)
        uid = uuid.UUID(user_id)

        from_teacher = db.query(Teacher).filter_by(user_id=from_tid, organization_id=sid).first()
        to_teacher = db.query(Teacher).filter_by(user_id=to_tid, organization_id=sid).first()
        if not from_teacher or not to_teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")

        classes_q = db.query(Class).filter_by(teacher_id=from_teacher.id, organization_id=sid)
        if class_ids:
            cids = [uuid.UUID(c) for c in class_ids]
            classes_q = classes_q.filter(Class.id.in_(cids))
        classes = classes_q.all()

        if not classes:
            raise HTTPException(status_code=404, detail="No classes to reassign")

        reassigned = 0
        affected_students: set = set()
        transferred_asgn = 0

        for cls in classes:
            # Student count
            members = db.query(ClassMembership).filter_by(class_id=cls.id).all()
            for m in members:
                affected_students.add(str(m.student_id))

            # Transfer assignments teacher reference
            if transfer_assignments:
                assigns = (
                    db.query(TeacherAssignment).filter_by(class_id=cls.id).all()
                )
                for a in assigns:
                    a.teacher_id = to_teacher.id
                    transferred_asgn += 1

            # Reassign class
            cls.teacher_id = to_teacher.id

            db.add(
                ClassReassignmentHistory(
                    class_id=cls.id,
                    school_id=sid,
                    from_teacher_id=from_tid,
                    to_teacher_id=to_tid,
                    reassigned_by_user_id=uid,
                    transferred_assignments=transfer_assignments,
                    transferred_grades=transfer_grades,
                    affected_students_count=len(members),
                    affected_assignments_count=transferred_asgn,
                )
            )
            reassigned += 1

        log = SchoolActivityLog(
            school_id=sid, actor_user_id=uid,
            action="reassign_teacher_classes", resource_type="teacher",
            resource_id=from_teacher_id,
            changes={
                "to_teacher_id": to_teacher_id,
                "classes_count": reassigned,
                "transfer_assignments": transfer_assignments,
            },
        )
        db.add(log)
        db.commit()

        return {
            "status": "reassigned",
            "classes_reassigned": reassigned,
            "affected_students": len(affected_students),
            "transferred_assignments": transferred_asgn,
        }

    # ── Students list ──────────────────────────────────────────────────────

    def get_students_list(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        search: Optional[str] = None,
        filter_status: Optional[str] = None,
        filter_grade: Optional[int] = None,
        filter_class: Optional[str] = None,
        filter_risk: Optional[str] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
        page: int = 1,
        page_size: int = 50,
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)

        q = db.query(StudentSchoolProfile).filter_by(school_id=sid)
        if filter_status == "active":
            q = q.filter_by(is_active=True, is_enrolled=True)
        elif filter_status == "inactive":
            q = q.filter_by(is_active=False)
        elif filter_status == "pending":
            q = q.filter_by(is_enrolled=False, is_active=True)
        if filter_grade:
            q = q.filter_by(grade_level=filter_grade)
        if filter_risk:
            q = q.filter_by(at_risk_status=filter_risk)

        profiles = q.all()

        results = []
        for prof in profiles:
            user = db.query(User).filter_by(id=prof.student_id).first()
            if not user:
                continue

            # Search filter
            if search:
                s = search.lower()
                if s not in (user.full_name or "").lower() and s not in (user.email or "").lower():
                    continue

            # Classes
            memberships = (
                db.query(ClassMembership)
                .filter_by(student_id=prof.student_id)
                .all()
            )
            class_ids = [m.class_id for m in memberships]

            # Filter by class
            if filter_class:
                fc = uuid.UUID(filter_class)
                if fc not in class_ids:
                    continue

            class_names = []
            for cid in class_ids:
                cls = db.query(Class).filter_by(id=cid, organization_id=sid).first()
                if cls:
                    class_names.append(cls.name)

            ll = (
                db.query(LoginActivity)
                .filter_by(user_id=prof.student_id, status="success")
                .order_by(LoginActivity.created_at.desc())
                .first()
            )

            results.append(
                {
                    "student_id": str(prof.student_id),
                    "name": user.full_name or user.email,
                    "email": user.email,
                    "grade": prof.grade_level,
                    "classes": class_names,
                    "classes_display": ", ".join(class_names) if class_names else "None",
                    "status": "active" if prof.is_active else "inactive",
                    "enrollment_status": "enrolled" if prof.is_enrolled else "pending",
                    "score": round(prof.avg_score or 0.0, 1),
                    "risk_level": prof.at_risk_status or "none",
                    "last_active": _rel_time(ll.created_at if ll else None),
                    "last_active_raw": ll.created_at.isoformat() if ll else None,
                    "avatar_url": user.profile_image_url,
                    "student_id_number": prof.student_id_number,
                }
            )

        sort_key = {
            "name": lambda r: (r["name"] or "").lower(),
            "score": lambda r: r["score"],
            "grade": lambda r: r["grade"] or 0,
            "activity": lambda r: r["last_active_raw"] or "",
        }.get(sort_by, lambda r: (r["name"] or "").lower())

        results.sort(key=sort_key, reverse=(sort_order == "desc"))

        total = len(results)
        start = (page - 1) * page_size
        return {
            "students": results[start : start + page_size],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": max(1, (total + page_size - 1) // page_size),
            },
        }

    # ── Student profile ────────────────────────────────────────────────────

    def get_student_profile(
        self, db: Session, user_id: str, school_id: str, student_id: str
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        stid = uuid.UUID(student_id)

        user = db.query(User).filter_by(id=stid).first()
        if not user:
            raise HTTPException(status_code=404, detail="Student not found")

        prof = db.query(StudentSchoolProfile).filter_by(student_id=stid, school_id=sid).first()

        # Enrollments
        memberships = db.query(ClassMembership).filter_by(student_id=stid).all()
        classes_data = []
        total_score = 0.0
        scored = 0

        for m in memberships:
            cls = db.query(Class).filter_by(id=m.class_id, organization_id=sid).first()
            if not cls:
                continue

            teacher_rec = db.query(Teacher).filter_by(id=cls.teacher_id).first()
            teacher_user = db.query(User).filter_by(id=teacher_rec.user_id).first() if teacher_rec and teacher_rec.user_id else None

            # Score from submissions
            assigns = db.query(TeacherAssignment).filter_by(class_id=cls.id).all()
            assign_ids = [a.id for a in assigns]
            subs = []
            if assign_ids:
                subs = (
                    db.query(AssignmentSubmission)
                    .filter(
                        AssignmentSubmission.assignment_id.in_(assign_ids),
                        AssignmentSubmission.student_id == stid,
                        AssignmentSubmission.status == "graded",
                    )
                    .all()
                )
            scores = [s.auto_score or s.manual_score or 0 for s in subs]
            class_score = round(sum(scores) / len(scores), 1) if scores else 0.0
            if scores:
                total_score += class_score
                scored += 1

            classes_data.append(
                {
                    "class_id": str(cls.id),
                    "name": cls.name,
                    "subject": cls.subject,
                    "teacher_name": (teacher_user.full_name if teacher_user else (teacher_rec.name if teacher_rec else None)),
                    "score": class_score,
                    "progress": m.progress_percent,
                    "enrollment_status": m.enrollment_status,
                    "submitted": len(subs),
                    "total_assignments": len(assigns),
                }
            )

        overall_score = round(total_score / scored, 1) if scored else 0.0

        # Parents
        parents = db.query(ParentContact).filter_by(student_id=stid, school_id=sid).all()

        # Activity summary
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        logins_week = (
            db.query(LoginActivity)
            .filter(
                LoginActivity.user_id == stid,
                LoginActivity.status == "success",
                LoginActivity.created_at >= week_ago,
            )
            .count()
        )
        logins_month = (
            db.query(LoginActivity)
            .filter(
                LoginActivity.user_id == stid,
                LoginActivity.status == "success",
                LoginActivity.created_at >= month_ago,
            )
            .count()
        )
        ll = (
            db.query(LoginActivity)
            .filter_by(user_id=stid, status="success")
            .order_by(LoginActivity.created_at.desc())
            .first()
        )

        all_assign_ids = []
        for cls_d in classes_data:
            assigns = db.query(TeacherAssignment).filter_by(class_id=uuid.UUID(cls_d["class_id"])).all()
            all_assign_ids.extend([a.id for a in assigns])

        submitted_count = 0
        on_time_count = 0
        if all_assign_ids:
            subs_all = (
                db.query(AssignmentSubmission)
                .filter(
                    AssignmentSubmission.assignment_id.in_(all_assign_ids),
                    AssignmentSubmission.student_id == stid,
                    AssignmentSubmission.status.in_(["submitted", "graded"]),
                )
                .all()
            )
            submitted_count = len(subs_all)
            on_time_count = sum(1 for s in subs_all if not s.is_late)

        return {
            "student_id": student_id,
            "name": user.full_name or user.email,
            "email": user.email,
            "avatar_url": user.profile_image_url,
            "student_id_number": prof.student_id_number if prof else None,
            "grade": prof.grade_level if prof else None,
            "status": "active" if (prof and prof.is_active) else "inactive",
            "enrollment_status": "enrolled" if (prof and prof.is_enrolled) else "pending",
            "avg_score": overall_score,
            "at_risk": (prof.at_risk_status if prof else None) or "none",
            "classes": classes_data,
            "progress": {
                "total_assignments": len(all_assign_ids),
                "submitted": submitted_count,
                "on_time": on_time_count,
                "score_avg": overall_score,
            },
            "parents": [
                {
                    "id": str(p.id),
                    "parent_name": p.parent_name,
                    "email": p.email,
                    "phone": p.phone,
                    "relationship": p.relationship,
                    "is_primary": p.is_primary,
                    "can_receive_alerts": p.can_receive_alerts,
                    "preferred_contact_method": p.preferred_contact_method,
                }
                for p in parents
            ],
            "activity": {
                "last_login": ll.created_at.isoformat() if ll else None,
                "last_login_relative": _rel_time(ll.created_at if ll else None),
                "logins_week": logins_week,
                "logins_month": logins_month,
            },
        }

    # ── Student deactivate / reactivate ───────────────────────────────────

    def deactivate_student(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        student_id: str,
        reason: str = "",
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        stid = uuid.UUID(student_id)
        uid = uuid.UUID(user_id)

        user = db.query(User).filter_by(id=stid).first()
        if user:
            user.account_active = False

        prof = db.query(StudentSchoolProfile).filter_by(student_id=stid, school_id=sid).first()
        removed_from = []
        if prof:
            prof.is_active = False
            prof.deactivated_at = datetime.utcnow()
            prof.deactivation_reason = reason
        else:
            db.add(StudentSchoolProfile(student_id=stid, school_id=sid, is_active=False,
                                        deactivated_at=datetime.utcnow(), deactivation_reason=reason))

        # Drop from class memberships
        memberships = db.query(ClassMembership).filter_by(student_id=stid).all()
        for m in memberships:
            cls = db.query(Class).filter_by(id=m.class_id, organization_id=sid).first()
            if cls:
                removed_from.append({"class_id": str(m.class_id), "removed_at": datetime.utcnow().isoformat()})
                m.enrollment_status = "dropped"
                db.add(ClassEnrollmentAudit(
                    class_id=m.class_id, student_id=stid, school_id=sid,
                    action="deactivated", enrolled_by_user_id=uid,
                ))

        db.add(StudentDeactivationRecord(
            student_id=stid, school_id=sid,
            deactivated_by_user_id=uid, reason=reason,
            classes_removed_from=removed_from,
        ))
        db.add(SchoolActivityLog(school_id=sid, actor_user_id=uid,
                                  action="deactivate_student", resource_type="student",
                                  resource_id=student_id, changes={"reason": reason}))
        db.commit()
        return {"status": "deactivated", "student_id": student_id}

    def reactivate_student(
        self, db: Session, user_id: str, school_id: str, student_id: str
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        stid = uuid.UUID(student_id)
        uid = uuid.UUID(user_id)

        user = db.query(User).filter_by(id=stid).first()
        if user:
            user.account_active = True

        prof = db.query(StudentSchoolProfile).filter_by(student_id=stid, school_id=sid).first()
        if prof:
            prof.is_active = True
            prof.deactivated_at = None

        rec = (db.query(StudentDeactivationRecord).filter_by(student_id=stid, school_id=sid)
               .order_by(StudentDeactivationRecord.created_at.desc()).first())
        if rec:
            rec.reactivated_at = datetime.utcnow()

        db.add(SchoolActivityLog(school_id=sid, actor_user_id=uid,
                                  action="reactivate_student", resource_type="student",
                                  resource_id=student_id))
        db.commit()
        return {"status": "reactivated", "student_id": student_id}

    # ── Enroll / remove from class ─────────────────────────────────────────

    def enroll_student(
        self, db: Session, user_id: str, school_id: str, student_id: str, class_id: str
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        stid = uuid.UUID(student_id)
        cid = uuid.UUID(class_id)
        uid = uuid.UUID(user_id)

        cls = db.query(Class).filter_by(id=cid, organization_id=sid).first()
        if not cls:
            raise HTTPException(status_code=404, detail="Class not found")

        existing = db.query(ClassMembership).filter_by(class_id=cid, student_id=stid).first()
        if existing:
            existing.enrollment_status = "active"
        else:
            db.add(ClassMembership(class_id=cid, student_id=stid, enrollment_status="active"))

        db.add(ClassEnrollmentAudit(
            class_id=cid, student_id=stid, school_id=sid,
            action="enrolled", enrolled_by_user_id=uid,
        ))

        prof = db.query(StudentSchoolProfile).filter_by(student_id=stid, school_id=sid).first()
        if prof:
            prof.is_enrolled = True
            prof.total_classes = (prof.total_classes or 0) + 1
        db.commit()
        return {"status": "enrolled", "class_id": class_id}

    def remove_from_class(
        self, db: Session, user_id: str, school_id: str, student_id: str, class_id: str
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        stid = uuid.UUID(student_id)
        cid = uuid.UUID(class_id)
        uid = uuid.UUID(user_id)

        m = db.query(ClassMembership).filter_by(class_id=cid, student_id=stid).first()
        if not m:
            raise HTTPException(status_code=404, detail="Enrollment not found")
        m.enrollment_status = "dropped"

        db.add(ClassEnrollmentAudit(
            class_id=cid, student_id=stid, school_id=sid,
            action="dropped", enrolled_by_user_id=uid,
        ))
        db.commit()
        return {"status": "removed"}

    # ── Parent contacts ────────────────────────────────────────────────────

    def upsert_parent(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        student_id: str,
        data: Dict,
        contact_id: Optional[str] = None,
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        stid = uuid.UUID(student_id)

        if contact_id:
            contact = db.query(ParentContact).filter_by(id=uuid.UUID(contact_id), student_id=stid).first()
            if not contact:
                raise HTTPException(status_code=404, detail="Contact not found")
            for k, v in data.items():
                if hasattr(contact, k):
                    setattr(contact, k, v)
        else:
            # If first parent, make primary
            existing = db.query(ParentContact).filter_by(student_id=stid, school_id=sid).count()
            contact = ParentContact(
                student_id=stid,
                school_id=sid,
                parent_name=data.get("parent_name", ""),
                email=data.get("email"),
                phone=data.get("phone"),
                relationship=data.get("relationship"),
                can_receive_alerts=data.get("can_receive_alerts", True),
                preferred_contact_method=data.get("preferred_contact_method", "email"),
                is_primary=(existing == 0),
            )
            db.add(contact)

        db.commit()
        db.refresh(contact)
        return {"id": str(contact.id), "parent_name": contact.parent_name, "email": contact.email}

    def delete_parent(
        self, db: Session, user_id: str, school_id: str, student_id: str, contact_id: str
    ) -> Dict:
        _verify_access(db, user_id, school_id)
        stid = uuid.UUID(student_id)
        contact = db.query(ParentContact).filter_by(id=uuid.UUID(contact_id), student_id=stid).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        db.delete(contact)
        db.commit()
        return {"status": "deleted"}

    # ── Bulk operations ────────────────────────────────────────────────────

    def bulk_deactivate_teachers(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        teacher_ids: List[str],
        reason: str = "",
    ) -> Dict:
        sid = uuid.UUID(school_id)
        uid = uuid.UUID(user_id)
        ok = 0
        errors: List[Dict] = []

        op = BulkManagementOperation(
            school_id=sid, performed_by_user_id=uid,
            operation_type="bulk_deactivate_teachers", entity_type="teacher",
            total_count=len(teacher_ids), started_at=datetime.utcnow(),
        )
        db.add(op)
        db.flush()

        for tid_str in teacher_ids:
            try:
                self.deactivate_teacher(db, user_id, school_id, tid_str, reason)
                ok += 1
            except Exception as e:
                errors.append({"id": tid_str, "error": str(e)})

        op.successful_count = ok
        op.failed_count = len(errors)
        op.error_log = errors
        op.completed_at = datetime.utcnow()
        db.commit()

        return {"successful": ok, "failed": len(errors), "errors": errors}

    def bulk_deactivate_students(
        self,
        db: Session,
        user_id: str,
        school_id: str,
        student_ids: List[str],
        reason: str = "",
    ) -> Dict:
        sid = uuid.UUID(school_id)
        uid = uuid.UUID(user_id)
        ok = 0
        errors: List[Dict] = []

        op = BulkManagementOperation(
            school_id=sid, performed_by_user_id=uid,
            operation_type="bulk_deactivate_students", entity_type="student",
            total_count=len(student_ids), started_at=datetime.utcnow(),
        )
        db.add(op)
        db.flush()

        for sid_str in student_ids:
            try:
                self.deactivate_student(db, user_id, school_id, sid_str, reason)
                ok += 1
            except Exception as e:
                errors.append({"id": sid_str, "error": str(e)})

        op.successful_count = ok
        op.failed_count = len(errors)
        op.error_log = errors
        op.completed_at = datetime.utcnow()
        db.commit()

        return {"successful": ok, "failed": len(errors), "errors": errors}

    # ── Export ─────────────────────────────────────────────────────────────

    def export_students_csv(
        self, db: Session, user_id: str, school_id: str, filter_status: Optional[str] = None
    ) -> str:
        result = self.get_students_list(
            db, user_id, school_id,
            filter_status=filter_status,
            page=1, page_size=10000,
        )
        students = result["students"]

        import csv, io
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["name", "email", "grade", "classes", "status", "score", "risk_level", "last_active"])
        for s in students:
            writer.writerow([
                s["name"], s["email"], s["grade"],
                s["classes_display"], s["status"], s["score"],
                s["risk_level"], s["last_active"],
            ])
        return buf.getvalue()


teacher_student_mgmt_service = TeacherStudentMgmtService()
