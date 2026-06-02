"""Organizations and schools management (Packet 5.0)."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db
from models import User, Organization
from routers.auth import get_current_user
from services.organization_service import OrganizationService

router = APIRouter()
logger = logging.getLogger(__name__)


class CreateOrganizationRequest(BaseModel):
    name: str
    school_type: str  # primary, secondary, tertiary
    country: str
    state: str
    admin_name: str
    admin_email: EmailStr


class UpgradeOrganizationRequest(BaseModel):
    new_tier: str  # starter, pro, enterprise


@router.post("/create", tags=["organizations"])
async def create_organization(
    payload: CreateOrganizationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create new school/organization with 30-day free trial."""
    try:
        service = OrganizationService(db)
        result = await service.create_organization(
            admin_id=current_user.id,
            name=payload.name,
            school_type=payload.school_type,
            country=payload.country,
            state=payload.state,
            admin_name=payload.admin_name,
            admin_email=payload.admin_email,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"create_organization failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create organization")


@router.get("/{org_id}", tags=["organizations"])
async def get_organization(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get organization details."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or org.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {
        "id": str(org.id),
        "name": org.name,
        "school_type": org.school_type,
        "country": org.country,
        "state": org.state,
        "status": org.status,
        "students_count": org.students_count or 0,
        "teachers_count": org.teachers_count or 0,
        "classes_count": org.classes_count or 0,
        "created_at": org.created_at.isoformat() if org.created_at else None,
    }


@router.get("/{org_id}/usage", tags=["organizations"])
async def get_organization_usage(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check organization usage against subscription limits."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or org.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        service = OrganizationService(db)
        usage = await service.get_organization_usage(org_id)
        return usage
    except Exception as e:
        logger.exception(f"get_organization_usage failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get usage info")


@router.post("/{org_id}/upgrade", tags=["organizations"])
async def upgrade_organization(
    org_id: str,
    payload: UpgradeOrganizationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upgrade organization to higher subscription tier."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or org.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        service = OrganizationService(db)
        result = await service.upgrade_organization(org_id, payload.new_tier)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"upgrade_organization failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upgrade organization")
