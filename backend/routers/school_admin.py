"""School admin API router — ADMIN-2.1."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.school_admin_service import school_admin_service

router = APIRouter(prefix="/api/school-admin", tags=["school-admin"])


# ── Request models ─────────────────────────────────────────────────────────

class OnboardingStartRequest(BaseModel):
    school_name: Optional[str] = None
    district_name: Optional[str] = None
    timezone: str = "UTC"
    logo_url: Optional[str] = None
    teachers_needed: int = 30
    phone: Optional[str] = None
    address: Optional[str] = None


class OnboardingStepRequest(BaseModel):
    step: str  # profile | roles | google
    data: dict = {}


class TeacherInviteItem(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class BulkInviteRequest(BaseModel):
    teachers: List[TeacherInviteItem]


class StudentUploadRequest(BaseModel):
    csv_text: str
    filename: str = "students.csv"


# ── Dashboard ──────────────────────────────────────────────────────────────

@router.get("/{school_id}/dashboard")
def get_dashboard(
    school_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.get_dashboard(db, str(current_user.id), school_id)


@router.post("/{school_id}/refresh-metrics")
def refresh_metrics(
    school_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.refresh_metrics(db, str(current_user.id), school_id)


# ── Onboarding ─────────────────────────────────────────────────────────────

@router.get("/{school_id}/onboarding")
def get_onboarding(
    school_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.get_onboarding(db, str(current_user.id), school_id)


@router.post("/{school_id}/onboarding/start")
def start_onboarding(
    school_id: str,
    body: OnboardingStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.start_onboarding(
        db, str(current_user.id), school_id, body.dict()
    )


@router.put("/{school_id}/onboarding/step")
def update_onboarding_step(
    school_id: str,
    body: OnboardingStepRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.update_onboarding_step(
        db, str(current_user.id), school_id, body.step, body.data
    )


@router.post("/{school_id}/onboarding/complete")
def complete_onboarding(
    school_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.complete_onboarding(db, str(current_user.id), school_id)


# ── Invitations ────────────────────────────────────────────────────────────

@router.post("/{school_id}/invite-teachers")
def invite_teachers(
    school_id: str,
    body: BulkInviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher_list = [t.dict() for t in body.teachers]
    return school_admin_service.invite_teachers_bulk(
        db, str(current_user.id), school_id, teacher_list
    )


@router.get("/{school_id}/invitations")
def list_invitations(
    school_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.get_invitations(db, str(current_user.id), school_id)


# ── Student upload ─────────────────────────────────────────────────────────

@router.post("/{school_id}/upload-students")
def upload_students(
    school_id: str,
    body: StudentUploadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.upload_students_csv(
        db, str(current_user.id), school_id, body.csv_text, body.filename
    )


# ── Alerts ─────────────────────────────────────────────────────────────────

@router.post("/{school_id}/alerts/{alert_id}/dismiss")
def dismiss_alert(
    school_id: str,
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.dismiss_alert(db, str(current_user.id), school_id, alert_id)


@router.post("/{school_id}/alerts/{alert_id}/resolve")
def resolve_alert(
    school_id: str,
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.resolve_alert(db, str(current_user.id), school_id, alert_id)


# ── Recommendations ────────────────────────────────────────────────────────

@router.post("/{school_id}/recommendations/{rec_id}/dismiss")
def dismiss_recommendation(
    school_id: str,
    rec_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.dismiss_recommendation(
        db, str(current_user.id), school_id, rec_id
    )


# ── Class management (ADMIN-2.3) ─────────────────────────────────────────────

class CreateClassRequest(BaseModel):
    name: str
    subject: Optional[str] = None
    description: Optional[str] = None
    teacher_id: Optional[str] = None
    grade_level: Optional[int] = None
    max_students: int = 30
    student_ids: List[str] = []


class UpdateClassRequest(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    teacher_id: Optional[str] = None
    grade_level: Optional[int] = None
    max_students: Optional[int] = None


class DuplicateClassRequest(BaseModel):
    new_name: Optional[str] = None
    teacher_id: Optional[str] = None
    copy_roster: bool = False
    copy_assignments: bool = False


class MergeClassRequest(BaseModel):
    target_class_id: str
    conflict_resolution: str = "skip"  # skip | add_anyway
    archive_source: bool = True


class RosterUpdateRequest(BaseModel):
    student_ids: List[str]


@router.get("/{school_id}/classes")
def list_classes(
    school_id: str,
    search: Optional[str] = Query(None),
    status: str = Query("active"),
    grade: Optional[int] = Query(None),
    teacher_id: Optional[str] = Query(None),
    sort_by: str = Query("name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return school_admin_service.list_classes(
        db, str(current_user.id), school_id, search=search, status=status,
        grade=grade, teacher_id=teacher_id, sort_by=sort_by, page=page, page_size=page_size,
    )


@router.post("/{school_id}/classes")
def create_class(school_id: str, payload: CreateClassRequest,
                 current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return school_admin_service.create_class(db, str(current_user.id), school_id, payload.model_dump())


@router.get("/{school_id}/classes/{class_id}")
def get_class(school_id: str, class_id: str,
              current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return school_admin_service.get_class_detail(db, str(current_user.id), school_id, class_id)


@router.put("/{school_id}/classes/{class_id}")
def update_class(school_id: str, class_id: str, payload: UpdateClassRequest,
                 current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return school_admin_service.update_class(db, str(current_user.id), school_id, class_id,
                                             payload.model_dump(exclude_unset=True))


@router.post("/{school_id}/classes/{class_id}/duplicate")
def duplicate_class(school_id: str, class_id: str, payload: DuplicateClassRequest,
                    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return school_admin_service.duplicate_class(db, str(current_user.id), school_id, class_id, payload.model_dump())


@router.post("/{school_id}/classes/{class_id}/merge")
def merge_class(school_id: str, class_id: str, payload: MergeClassRequest,
                current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return school_admin_service.merge_classes(db, str(current_user.id), school_id, class_id, payload.model_dump())


@router.post("/{school_id}/classes/{class_id}/archive")
def archive_class(school_id: str, class_id: str,
                  current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return school_admin_service.set_archived(db, str(current_user.id), school_id, class_id, True)


@router.post("/{school_id}/classes/{class_id}/restore")
def restore_class(school_id: str, class_id: str,
                  current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return school_admin_service.set_archived(db, str(current_user.id), school_id, class_id, False)


@router.delete("/{school_id}/classes/{class_id}")
def delete_class(school_id: str, class_id: str,
                 current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return school_admin_service.delete_class(db, str(current_user.id), school_id, class_id)


@router.post("/{school_id}/classes/{class_id}/roster/add")
def add_to_roster(school_id: str, class_id: str, payload: RosterUpdateRequest,
                  current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return school_admin_service.add_to_roster(
        db, str(current_user.id), school_id, class_id, payload.student_ids
    )


@router.post("/{school_id}/classes/{class_id}/roster/remove")
def remove_from_roster(school_id: str, class_id: str, payload: RosterUpdateRequest,
                       current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return school_admin_service.remove_from_roster(
        db, str(current_user.id), school_id, class_id, payload.student_ids
    )
