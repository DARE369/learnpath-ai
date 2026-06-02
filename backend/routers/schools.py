"""School admin dashboard and reporting (Packet 5.0)."""

import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, Organization, Teacher, Class, ClassMembership, SchoolAnalytics
from routers.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{org_id}/dashboard", tags=["schools"])
async def get_school_dashboard(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get school admin dashboard with key metrics."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or org.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        teachers = db.query(Teacher).filter(Teacher.organization_id == org_id).count()
        classes = db.query(Class).filter(Class.organization_id == org_id).count()

        memberships = db.query(ClassMembership).join(
            Class, ClassMembership.class_id == Class.id
        ).filter(Class.organization_id == org_id).all()

        active_this_week = sum(
            1 for m in memberships
            if m.last_active and m.last_active > datetime.utcnow() - timedelta(days=7)
        )

        avg_progress = sum(m.progress_percent for m in memberships) / len(memberships) if memberships else 0
        avg_score = sum(m.average_score for m in memberships) / len(memberships) if memberships else 0

        return {
            "organization": {
                "id": str(org.id),
                "name": org.name,
                "school_type": org.school_type,
                "status": org.status,
            },
            "metrics": {
                "total_students": len(memberships),
                "active_this_week": active_this_week,
                "teachers": teachers,
                "classes": classes,
                "avg_student_progress": int(avg_progress),
                "avg_student_score": int(avg_score),
            },
            "subscription": {
                "tier": org.subscription_tier or "trial",
                "status": org.status,
            },
        }
    except Exception as e:
        logger.exception(f"get_school_dashboard failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard")


@router.get("/{org_id}/teachers", tags=["schools"])
async def list_school_teachers(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all teachers in organization."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or org.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Organization not found")

    teachers = db.query(Teacher).filter(Teacher.organization_id == org_id).all()

    return {
        "organization_id": str(org.id),
        "teachers": [
            {
                "id": str(t.id),
                "name": t.name,
                "email": t.email,
                "role": t.role,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in teachers
        ],
    }


@router.get("/{org_id}/classes", tags=["schools"])
async def list_school_classes(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all classes in organization."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or org.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Organization not found")

    classes = db.query(Class).filter(Class.organization_id == org_id).all()

    return {
        "organization_id": str(org.id),
        "classes": [
            {
                "id": str(c.id),
                "name": c.name,
                "subject": c.subject,
                "teacher_id": str(c.teacher_id) if c.teacher_id else None,
                "enrolled": c.enrolled_students or 0,
                "max": c.max_students,
            }
            for c in classes
        ],
    }


@router.get("/{org_id}/students", tags=["schools"])
async def list_school_students(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all students enrolled in organization classes."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or org.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Organization not found")

    memberships = db.query(ClassMembership).join(
        Class, ClassMembership.class_id == Class.id
    ).filter(Class.organization_id == org_id).all()

    return {
        "organization_id": str(org.id),
        "total_students": len(memberships),
        "students": [
            {
                "student_id": str(m.student_id),
                "class_id": str(m.class_id),
                "progress": m.progress_percent,
                "avg_score": m.average_score,
                "status": m.enrollment_status,
                "last_active": m.last_active.isoformat() if m.last_active else None,
            }
            for m in memberships
        ],
    }


@router.get("/{org_id}/analytics", tags=["schools"])
async def get_school_analytics(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get school-level daily analytics."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or org.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        analytics = db.query(SchoolAnalytics).filter(
            SchoolAnalytics.organization_id == org_id
        ).order_by(SchoolAnalytics.created_at.desc()).limit(30).all()

        return {
            "organization_id": str(org.id),
            "analytics": [
                {
                    "date": a.created_at.isoformat() if a.created_at else None,
                    "active_students": a.active_students,
                    "total_study_minutes": a.total_study_minutes,
                    "avg_score": a.avg_score,
                    "classes_active": a.classes_active,
                    "teachers_active": a.teachers_active,
                }
                for a in analytics
            ],
        }
    except Exception as e:
        logger.exception(f"get_school_analytics failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load analytics")


@router.get("/{org_id}/health", tags=["schools"])
async def get_school_health(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get school health score based on engagement metrics."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or org.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        memberships = db.query(ClassMembership).join(
            Class, ClassMembership.class_id == Class.id
        ).filter(Class.organization_id == org_id).all()

        # Calculate engagement: % active in last week
        active_last_week = sum(
            1 for m in memberships
            if m.last_active and m.last_active > datetime.utcnow() - timedelta(days=7)
        )
        engagement_rate = (active_last_week / len(memberships) * 100) if memberships else 0

        # Calculate retention: % with progress > 0
        progressed = sum(1 for m in memberships if m.progress_percent > 0)
        retention_rate = (progressed / len(memberships) * 100) if memberships else 0

        # Health score: average of both
        health_score = int((engagement_rate + retention_rate) / 2)

        return {
            "organization_id": str(org.id),
            "health_score": health_score,
            "engagement_rate": int(engagement_rate),
            "retention_rate": int(retention_rate),
            "status": "healthy" if health_score >= 70 else "at_risk" if health_score >= 50 else "critical",
            "recommendations": [
                "Increase teacher support" if engagement_rate < 50 else "Continue current engagement strategy",
                "Implement retention campaign" if retention_rate < 60 else "Maintain retention programs",
            ],
        }
    except Exception as e:
        logger.exception(f"get_school_health failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate health")
