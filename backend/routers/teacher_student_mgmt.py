"""Teacher & student management router — ADMIN-2.2."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.teacher_student_mgmt_service import teacher_student_mgmt_service as svc

router = APIRouter(prefix="/api/school-admin", tags=["teacher-student-mgmt"])


# ── Request models ─────────────────────────────────────────────────────────

class InviteTeacherRequest(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class DeactivateRequest(BaseModel):
    reason: str = ""
    handle_classes: str = "keep"  # keep | archive


class ReassignClassesRequest(BaseModel):
    to_teacher_id: str
    class_ids: Optional[List[str]] = None
    transfer_assignments: bool = False
    transfer_grades: bool = False


class EnrollRequest(BaseModel):
    class_id: str


class ParentContactRequest(BaseModel):
    parent_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    relationship: Optional[str] = None
    can_receive_alerts: bool = True
    preferred_contact_method: str = "email"


class BulkDeactivateRequest(BaseModel):
    ids: List[str]
    reason: str = ""


# ── Teachers ───────────────────────────────────────────────────────────────

@router.get("/{school_id}/teachers")
def list_teachers(
    school_id: str,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.get_teachers_list(
        db, str(current_user.id), school_id,
        search=search, filter_status=status,
        sort_by=sort_by, sort_order=sort_order,
        page=page, page_size=page_size,
    )


@router.get("/{school_id}/teachers/{teacher_id}")
def get_teacher(
    school_id: str,
    teacher_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.get_teacher_profile(db, str(current_user.id), school_id, teacher_id)


@router.post("/{school_id}/teachers/invite")
def invite_teacher(
    school_id: str,
    body: InviteTeacherRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.invite_teacher(
        db, str(current_user.id), school_id,
        body.email, body.first_name, body.last_name,
    )


@router.post("/{school_id}/teachers/{teacher_id}/deactivate")
def deactivate_teacher(
    school_id: str,
    teacher_id: str,
    body: DeactivateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.deactivate_teacher(
        db, str(current_user.id), school_id, teacher_id,
        reason=body.reason, handle_classes=body.handle_classes,
    )


@router.post("/{school_id}/teachers/{teacher_id}/reactivate")
def reactivate_teacher(
    school_id: str,
    teacher_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.reactivate_teacher(db, str(current_user.id), school_id, teacher_id)


@router.post("/{school_id}/teachers/{teacher_id}/reassign-classes")
def reassign_classes(
    school_id: str,
    teacher_id: str,
    body: ReassignClassesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.reassign_classes(
        db, str(current_user.id), school_id,
        from_teacher_id=teacher_id,
        to_teacher_id=body.to_teacher_id,
        class_ids=body.class_ids,
        transfer_assignments=body.transfer_assignments,
        transfer_grades=body.transfer_grades,
    )


@router.post("/{school_id}/teachers/bulk-deactivate")
def bulk_deactivate_teachers(
    school_id: str,
    body: BulkDeactivateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.bulk_deactivate_teachers(db, str(current_user.id), school_id, body.ids, body.reason)


# ── Students ───────────────────────────────────────────────────────────────

@router.get("/{school_id}/students")
def list_students(
    school_id: str,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    grade: Optional[int] = Query(None),
    class_id: Optional[str] = Query(None),
    risk: Optional[str] = Query(None),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.get_students_list(
        db, str(current_user.id), school_id,
        search=search, filter_status=status,
        filter_grade=grade, filter_class=class_id, filter_risk=risk,
        sort_by=sort_by, sort_order=sort_order,
        page=page, page_size=page_size,
    )


@router.get("/{school_id}/students/export")
def export_students(
    school_id: str,
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    csv_text = svc.export_students_csv(db, str(current_user.id), school_id, filter_status=status)
    return PlainTextResponse(csv_text, media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=students.csv"})


@router.get("/{school_id}/students/{student_id}")
def get_student(
    school_id: str,
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.get_student_profile(db, str(current_user.id), school_id, student_id)


@router.post("/{school_id}/students/{student_id}/deactivate")
def deactivate_student(
    school_id: str,
    student_id: str,
    body: DeactivateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.deactivate_student(db, str(current_user.id), school_id, student_id, reason=body.reason)


@router.post("/{school_id}/students/{student_id}/reactivate")
def reactivate_student(
    school_id: str,
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.reactivate_student(db, str(current_user.id), school_id, student_id)


@router.post("/{school_id}/students/{student_id}/enroll")
def enroll_student(
    school_id: str,
    student_id: str,
    body: EnrollRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.enroll_student(db, str(current_user.id), school_id, student_id, body.class_id)


@router.delete("/{school_id}/students/{student_id}/classes/{class_id}")
def remove_from_class(
    school_id: str,
    student_id: str,
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.remove_from_class(db, str(current_user.id), school_id, student_id, class_id)


@router.post("/{school_id}/students/{student_id}/parents")
def add_parent(
    school_id: str,
    student_id: str,
    body: ParentContactRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.upsert_parent(db, str(current_user.id), school_id, student_id, body.dict())


@router.put("/{school_id}/students/{student_id}/parents/{contact_id}")
def update_parent(
    school_id: str,
    student_id: str,
    contact_id: str,
    body: ParentContactRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.upsert_parent(
        db, str(current_user.id), school_id, student_id, body.dict(), contact_id=contact_id
    )


@router.delete("/{school_id}/students/{student_id}/parents/{contact_id}")
def delete_parent(
    school_id: str,
    student_id: str,
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.delete_parent(db, str(current_user.id), school_id, student_id, contact_id)


@router.post("/{school_id}/students/bulk-deactivate")
def bulk_deactivate_students(
    school_id: str,
    body: BulkDeactivateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.bulk_deactivate_students(db, str(current_user.id), school_id, body.ids, body.reason)
