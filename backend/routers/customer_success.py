"""Customer success and analytics endpoints (Packet 6.5)"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import verify_admin_token, get_current_user
from database import get_db
from services.customer_success_service import CustomerSuccessService
from services.notification_service import NotificationService
from models import User, Organization

router = APIRouter(prefix="/api/admin/customer-success", tags=["customer-success"])


@router.get("/orgs/health")
async def get_all_orgs_health(
    current_user: User = Depends(verify_admin_token),
    db: Session = Depends(get_db),
):
    """
    Get health summary for all organizations (admin only).

    Returns list sorted by churn risk, then health score.
    """
    summaries = CustomerSuccessService.get_all_orgs_health(db)

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "total_organizations": len(summaries),
        "healthy": len([s for s in summaries if s["status"] == "healthy"]),
        "at_risk": len([s for s in summaries if s["status"] == "at_risk"]),
        "churning": len([s for s in summaries if s["status"] == "churning"]),
        "total_mrr": sum(s.get("mrr", 0) for s in summaries),
        "organizations": summaries,
    }


@router.get("/orgs/{org_id}/health")
async def get_org_health(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get health summary for a specific organization.

    Available to org admins and LearnPath admins.
    """
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check authorization (org admin or platform admin)
    if current_user.id != org.admin_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    return CustomerSuccessService.get_org_health_summary(org_id, db)


@router.post("/orgs/{org_id}/send-outreach")
async def send_cs_outreach(
    org_id: str,
    reason: str,
    current_user: User = Depends(verify_admin_token),
    db: Session = Depends(get_db),
):
    """
    Flag organization for customer success outreach.

    Sends alert to CS team and org admin.
    """
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    CustomerSuccessService.flag_for_outreach(org_id, reason, db)

    return {
        "status": "success",
        "message": f"Organization {org.name} flagged for outreach: {reason}",
    }


@router.post("/notify/trial-welcome")
async def send_trial_welcome(
    email: str,
    org_name: str,
    current_user: User = Depends(verify_admin_token),
):
    """Send trial welcome email."""
    success = NotificationService.send_trial_welcome(email, org_name)
    return {"status": "sent" if success else "failed"}


@router.post("/notify/trial-7-days")
async def send_trial_7_days(
    email: str,
    org_name: str,
    current_user: User = Depends(verify_admin_token),
):
    """Send trial 7-days-left reminder."""
    success = NotificationService.send_trial_7_days_left(email, org_name)
    return {"status": "sent" if success else "failed"}


@router.post("/notify/trial-upgrade")
async def send_trial_upgrade(
    email: str,
    org_name: str,
    current_user: User = Depends(verify_admin_token),
):
    """Send trial upgrade prompt (last day)."""
    success = NotificationService.send_trial_upgrade_now(email, org_name)
    return {"status": "sent" if success else "failed"}


@router.post("/notify/invoice-overdue")
async def send_invoice_overdue(
    email: str,
    org_name: str,
    amount: float,
    days_overdue: int,
    current_user: User = Depends(verify_admin_token),
):
    """Send invoice overdue notification."""
    success = NotificationService.send_invoice_overdue(email, org_name, amount, days_overdue)
    return {"status": "sent" if success else "failed"}


@router.post("/notify/invoice-reminder")
async def send_invoice_reminder(
    email: str,
    org_name: str,
    amount: float,
    due_date: str,
    current_user: User = Depends(verify_admin_token),
):
    """Send invoice payment reminder."""
    success = NotificationService.send_invoice_reminder(email, org_name, amount, due_date)
    return {"status": "sent" if success else "failed"}


@router.post("/notify/at-risk-students")
async def send_at_risk_alert(
    teacher_email: str,
    teacher_name: str,
    student_names: list,
    reason: str,
    current_user: User = Depends(verify_admin_token),
):
    """Send at-risk student alert to teacher."""
    success = NotificationService.send_at_risk_student_alert(
        teacher_email, teacher_name, student_names, reason
    )
    return {"status": "sent" if success else "failed"}


@router.get("/analytics/overview")
async def get_analytics_overview(
    org_id: str = None,
    current_user: User = Depends(verify_admin_token),
    db: Session = Depends(get_db),
):
    """
    Get platform-wide analytics overview.

    If org_id provided, get analytics for that org (with auth check).
    """
    from models import SchoolAnalytics, Organization
    from sqlalchemy import func

    if org_id:
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

        analytics = (
            db.query(SchoolAnalytics)
            .filter(SchoolAnalytics.organization_id == org_id)
            .order_by(SchoolAnalytics.date.desc())
            .first()
        )

        return {
            "organization_id": org_id,
            "organization_name": org.name,
            "analytics": {
                "active_students": analytics.active_students if analytics else 0,
                "avg_score": analytics.avg_score if analytics else 0,
                "completion_rate": analytics.completion_rate if analytics else 0,
                "quiz_completion_rate": analytics.quiz_completion_rate
                if analytics
                else 0,
                "last_updated": analytics.date if analytics else None,
            },
        }

    # Platform-wide overview
    latest_analytics = (
        db.query(
            func.count(SchoolAnalytics.organization_id),
            func.avg(SchoolAnalytics.avg_score),
            func.avg(SchoolAnalytics.completion_rate),
        )
        .group_by(
            func.date(SchoolAnalytics.date)
        )  # Latest day
        .order_by(func.date(SchoolAnalytics.date).desc())
        .first()
    )

    return {
        "platform_stats": {
            "organizations_reporting": latest_analytics[0] if latest_analytics else 0,
            "avg_score_platform": round(latest_analytics[1], 1) if latest_analytics else 0,
            "avg_completion_rate": round(latest_analytics[2], 1) if latest_analytics else 0,
        },
    }
