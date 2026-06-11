"""School billing API router — ADMIN-2.4."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.billing_service import billing_service

router = APIRouter(prefix="/api/school-admin", tags=["billing"])


# ── Request models ─────────────────────────────────────────────────────────

class UpgradePlanRequest(BaseModel):
    plan_slug: str
    billing_cycle: str = "monthly"


class EmailInvoiceRequest(BaseModel):
    to_email: Optional[str] = None


class BillingSettingsRequest(BaseModel):
    billing_contact_name: Optional[str] = None
    billing_contact_email: Optional[str] = None
    billing_contact_phone: Optional[str] = None
    billing_address: Optional[str] = None
    send_invoice_emails: Optional[bool] = None
    alert_at_pct_usage: Optional[int] = None
    additional_invoice_emails: Optional[List[str]] = None


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/{school_id}/billing/plans")
def get_billing_plans(
    school_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return billing_service.get_plans(db)


@router.get("/{school_id}/billing/overview")
def get_billing_overview(
    school_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return billing_service.get_overview(db, str(current_user.id), school_id)


@router.get("/{school_id}/billing/plan-comparison")
def get_plan_comparison(
    school_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return billing_service.get_plan_comparison(db, str(current_user.id), school_id)


@router.post("/{school_id}/billing/upgrade")
def upgrade_plan(
    school_id: str,
    payload: UpgradePlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return billing_service.upgrade_plan(
        db, str(current_user.id), school_id,
        payload.plan_slug, payload.billing_cycle,
    )


@router.get("/{school_id}/billing/invoices")
def list_invoices(
    school_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return billing_service.list_invoices(db, str(current_user.id), school_id, page, page_size)


@router.get("/{school_id}/billing/invoices/{invoice_id}")
def get_invoice(
    school_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return billing_service.get_invoice_detail(db, str(current_user.id), school_id, invoice_id)


@router.post("/{school_id}/billing/invoices/{invoice_id}/email")
def email_invoice(
    school_id: str,
    invoice_id: str,
    payload: EmailInvoiceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return billing_service.email_invoice(
        db, str(current_user.id), school_id, invoice_id, payload.to_email
    )


@router.put("/{school_id}/billing/settings")
def update_billing_settings(
    school_id: str,
    payload: BillingSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return billing_service.update_billing_settings(
        db, str(current_user.id), school_id, payload.model_dump(exclude_unset=True)
    )
