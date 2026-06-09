"""Teachers and classroom management (Packet 5.0)."""

import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Teacher, Class, ClassMembership, Organization
from routers.auth import get_current_user
from services.teacher_service import TeacherService

router = APIRouter()
logger = logging.getLogger(__name__)


class CreateTeacherRequest(BaseModel):
    name: str
    email: str
    role: str = "teacher"


class CreateClassRequest(BaseModel):
    name: str
    subject: str
    description: str = ""
    max_students: int = 40


class AssignAssignmentRequest(BaseModel):
    assignment_type: str
    assignment_id: str


@router.post("/{org_id}/teachers", tags=["teachers"])
async def create_teacher(
    org_id: str,
    payload: CreateTeacherRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create new teacher in organization."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or org.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Organization not found")

    if org.teachers_count and org.teachers_count >= 100:
        raise HTTPException(status_code=400, detail="Teacher limit reached for your tier")

    try:
        teacher = Teacher(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            name=payload.name,
            email=payload.email,
            role=payload.role,
        )
        db.add(teacher)
        org.teachers_count = (org.teachers_count or 0) + 1
        db.commit()

        return {
            "id": str(teacher.id),
            "name": teacher.name,
            "email": teacher.email,
            "role": teacher.role,
            "organization_id": str(teacher.organization_id),
        }
    except Exception as e:
        logger.exception(f"create_teacher failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create teacher")


@router.get("/dashboard", tags=["teachers"])
async def get_teacher_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get teacher's aggregated dashboard hub (auto-provisions a teacher record on
    first access so individual teachers work with no manual org setup)."""
    if getattr(current_user, "role", "user") not in ("teacher", "school_admin", "admin"):
        raise HTTPException(status_code=403, detail="Not a teacher")
    try:
        service = TeacherService(db)
        teacher = service.ensure_teacher(current_user)
        return service.get_dashboard_overview(str(teacher.id))
    except Exception as e:
        logger.exception(f"get_teacher_dashboard failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard")


@router.get("/{teacher_id}/classes", tags=["teachers"])
async def get_teacher_classes(
    teacher_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all classes for a teacher."""
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    classes = db.query(Class).filter(Class.teacher_id == teacher_id).all()
    return {
        "teacher_id": str(teacher.id),
        "teacher_name": teacher.name,
        "classes": [
            {
                "id": str(c.id),
                "name": c.name,
                "subject": c.subject,
                "enrolled": c.enrolled_students or 0,
                "max": c.max_students,
            }
            for c in classes
        ],
    }


@router.post("/{teacher_id}/classes", tags=["teachers"])
async def create_class(
    teacher_id: str,
    payload: CreateClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create new class."""
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    try:
        class_obj = Class(
            id=str(uuid.uuid4()),
            organization_id=teacher.organization_id,
            teacher_id=teacher_id,
            name=payload.name,
            subject=payload.subject,
            description=payload.description,
            max_students=payload.max_students,
            enrolled_students=0,
        )
        db.add(class_obj)

        org = db.query(Organization).filter(Organization.id == teacher.organization_id).first()
        if org:
            org.classes_count = (org.classes_count or 0) + 1

        db.commit()

        return {
            "id": str(class_obj.id),
            "name": class_obj.name,
            "subject": class_obj.subject,
            "max_students": class_obj.max_students,
            "enrolled": 0,
        }
    except Exception as e:
        logger.exception(f"create_class failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create class")


@router.get("/classes/{class_id}", tags=["teachers"])
async def get_class_details(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get detailed class information."""
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    teacher = db.query(Teacher).filter(Teacher.id == class_obj.teacher_id).first()
    if not teacher or str(teacher.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        service = TeacherService(db)
        details = await service.get_class_details(class_id, class_obj.teacher_id)
        return details
    except Exception as e:
        logger.exception(f"get_class_details failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load class details")


@router.get("/{teacher_id}/at-risk", tags=["teachers"])
async def get_at_risk_students(
    teacher_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get students who need intervention."""
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher or str(teacher.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        service = TeacherService(db)
        result = await service.get_at_risk_students(teacher_id)
        return result
    except Exception as e:
        logger.exception(f"get_at_risk_students failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load at-risk students")


@router.post("/classes/{class_id}/assign", tags=["teachers"])
async def assign_assignment(
    class_id: str,
    payload: AssignAssignmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign quiz or learning path to entire class."""
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    teacher = db.query(Teacher).filter(Teacher.id == class_obj.teacher_id).first()
    if not teacher or str(teacher.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        service = TeacherService(db)
        result = await service.assign_assignment(
            class_id, class_obj.teacher_id, payload.assignment_type, payload.assignment_id
        )
        return result
    except Exception as e:
        logger.exception(f"assign_assignment failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to assign")
