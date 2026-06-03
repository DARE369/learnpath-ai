"""
Customer success / org-health admin endpoints (Packet 6.5, rebuilt).

All endpoints require an admin role (require_admin -> 403 for non-admins).
Notification endpoints take an org_id and derive the recipient
(org.admin_email) server-side, so the frontend never has to know the email.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from routers.auth import require_admin
from database import get_db
from models import User, Organization, OrganizationPayment
from services.customer_success_service import CustomerSuccessService
from services.notification_service import NotificationService

router = APIRouter(prefix="/api/admin/customer-success", tags=["customer-success"])


class OrgRef(BaseModel):
    org_id: str


class OutreachBody(BaseModel):
    reason: str = "low_engagement"


def _require_org(org_id: str, db: Session) -> Organization:
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.get("/orgs/health")
def get_all_orgs_health(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Health summary for all organizations, sorted by churn risk then score."""
    summaries = CustomerSuccessService.get_all_orgs_health(db)
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "total_organizations": len(summaries),
        "healthy": len([s for s in summaries if s["status"] == "healthy"]),
        "at_risk": len([s for s in summaries if s["status"] == "at_risk"]),
        "churning": len([s for s in summaries if s["status"] == "churning"]),
        "total_mrr": round(sum(s.get("mrr", 0) for s in summaries), 2),
        "organizations": summaries,
    }


@router.get("/orgs/{org_id}/health")
def get_org_health(
    org_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Health summary for a single organization."""
    _require_org(org_id, db)
    return CustomerSuccessService.get_org_health_summary(org_id, db)


@router.post("/orgs/{org_id}/send-outreach")
def send_cs_outreach(
    org_id: str,
    body: OutreachBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Email the org admin a health alert and flag for CS follow-up."""
    org = _require_org(org_id, db)
    sent = CustomerSuccessService.flag_for_outreach(org_id, body.reason, db)
    return {
        "status": "sent" if sent else "failed",
        "message": f"Outreach for {org.name}: {body.reason}",
    }


@router.post("/notify/trial-welcome")
def notify_trial_welcome(body: OrgRef, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    org = _require_org(body.org_id, db)
    ok = NotificationService.send_trial_welcome(org.admin_email, org.name)
    return {"status": "sent" if ok else "failed"}


@router.post("/notify/trial-7-days")
def notify_trial_7_days(body: OrgRef, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    org = _require_org(body.org_id, db)
    ok = NotificationService.send_trial_7_days_left(org.admin_email, org.name)
    return {"status": "sent" if ok else "failed"}


@router.post("/notify/invoice-overdue")
def notify_invoice_overdue(body: OrgRef, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    org = _require_org(body.org_id, db)
    # Derive amount / days-overdue from the latest overdue invoice when available.
    payment = (
        db.query(OrganizationPayment)
        .filter(OrganizationPayment.organization_id == body.org_id)
        .order_by(OrganizationPayment.created_at.desc())
        .first()
    )
    amount = float(payment.amount) if payment and payment.amount else 0.0
    days_overdue = 0
    if payment and payment.due_date:
        days_overdue = max(0, (datetime.utcnow().date() - payment.due_date).days)
    ok = NotificationService.send_invoice_overdue(org.admin_email, org.name, amount, days_overdue)
    return {"status": "sent" if ok else "failed"}


@router.get("/analytics/overview")
def get_analytics_overview(
    org_id: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Latest SchoolAnalytics snapshot for an org, or a platform-wide roll-up."""
    from models import SchoolAnalytics
    from sqlalchemy import func

    if org_id:
        org = _require_org(org_id, db)
        a = (
            db.query(SchoolAnalytics)
            .filter(SchoolAnalytics.organization_id == org_id)
            .order_by(SchoolAnalytics.date.desc())
            .first()
        )
        return {
            "organization_id": org_id,
            "organization_name": org.name,
            "analytics": {
                "active_students": a.total_active_students if a else 0,
                "active_teachers": a.total_active_teachers if a else 0,
                "avg_student_score": a.avg_student_score if a else 0,
                "paths_completed": a.paths_completed if a else 0,
                "time_spent_hours": a.time_spent_hours if a else 0,
                "last_updated": a.date.isoformat() if a and a.date else None,
            },
        }

    row = (
        db.query(
            func.count(func.distinct(SchoolAnalytics.organization_id)),
            func.avg(SchoolAnalytics.avg_student_score),
        ).first()
    )
    return {
        "platform_stats": {
            "organizations_reporting": row[0] or 0 if row else 0,
            "avg_score_platform": round(row[1], 1) if row and row[1] is not None else 0,
        },
    }
