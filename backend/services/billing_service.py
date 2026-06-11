"""School billing service — ADMIN-2.4 (mocked)."""

import uuid
from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models import (
    Class,
    ClassMembership,
    Organization,
    SchoolActivityLog,
    SchoolBillingInvoice,
    SchoolBillingPlan,
    SchoolBillingSettings,
    SchoolBillingSubscription,
    SchoolUserRole,
    Teacher,
    User,
)

# ── Plan catalogue (authoritative) ────────────────────────────────────────

PLAN_CATALOGUE = [
    {
        "plan_slug": "starter",
        "plan_name": "Starter",
        "description": "Perfect for small schools getting started",
        "monthly_price": Decimal("99.00"),
        "annual_price": Decimal("990.00"),
        "display_order": 1,
        "features": {
            "max_teachers": 10,
            "max_students": 500,
            "max_classes": 50,
            "storage_gb": 10,
            "max_api_calls": 100_000,
            "sso": False,
            "advanced_analytics": False,
            "support": "email",
        },
    },
    {
        "plan_slug": "pro",
        "plan_name": "Pro",
        "description": "For growing schools with up to 50 teachers",
        "monthly_price": Decimal("499.00"),
        "annual_price": Decimal("4990.00"),
        "display_order": 2,
        "features": {
            "max_teachers": 50,
            "max_students": 2_000,
            "max_classes": 100,
            "storage_gb": 100,
            "max_api_calls": 1_000_000,
            "sso": True,
            "advanced_analytics": True,
            "support": "email",
        },
    },
    {
        "plan_slug": "enterprise",
        "plan_name": "Enterprise",
        "description": "Unlimited everything with dedicated support",
        "monthly_price": Decimal("999.00"),
        "annual_price": Decimal("9990.00"),
        "display_order": 3,
        "features": {
            "max_teachers": 999_999,
            "max_students": 999_999,
            "max_classes": 999_999,
            "storage_gb": 500,
            "max_api_calls": 999_999_999,
            "sso": True,
            "advanced_analytics": True,
            "support": "dedicated",
        },
    },
]


class BillingService:

    # ── Access helpers ─────────────────────────────────────────────────────

    def _verify_access(self, db: Session, user_id: str, school_id: str) -> None:
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
            if db.query(Organization).filter_by(id=sid).first():
                return
        raise HTTPException(status_code=403, detail="Access denied")

    # ── Plan seeding ───────────────────────────────────────────────────────

    def seed_plans(self, db: Session) -> None:
        """Idempotent — create plans if they don't already exist."""
        for p in PLAN_CATALOGUE:
            exists = db.query(SchoolBillingPlan).filter_by(plan_slug=p["plan_slug"]).first()
            if not exists:
                db.add(SchoolBillingPlan(
                    plan_slug=p["plan_slug"],
                    plan_name=p["plan_name"],
                    description=p["description"],
                    monthly_price=p["monthly_price"],
                    annual_price=p["annual_price"],
                    features=p["features"],
                    is_active=True,
                    display_order=p["display_order"],
                ))
        db.commit()

    def get_plans(self, db: Session) -> List[Dict]:
        self.seed_plans(db)
        plans = db.query(SchoolBillingPlan).filter_by(is_active=True).order_by(
            SchoolBillingPlan.display_order
        ).all()
        return [self._format_plan(p) for p in plans]

    def _format_plan(self, p: SchoolBillingPlan) -> Dict:
        return {
            "plan_id": str(p.id),
            "plan_slug": p.plan_slug,
            "plan_name": p.plan_name,
            "description": p.description,
            "monthly_price": float(p.monthly_price),
            "annual_price": float(p.annual_price),
            "features": p.features or {},
        }

    # ── Subscription helpers ───────────────────────────────────────────────

    def _get_or_create_subscription(self, db: Session, school_id: str) -> SchoolBillingSubscription:
        """Return existing subscription; auto-create a Pro one for demo schools."""
        sid = uuid.UUID(school_id)
        sub = db.query(SchoolBillingSubscription).filter_by(school_id=sid).first()
        if sub:
            return sub

        self.seed_plans(db)
        pro = db.query(SchoolBillingPlan).filter_by(plan_slug="pro").first()
        if not pro:
            raise HTTPException(status_code=500, detail="Billing plans not seeded")

        now = datetime.utcnow()
        renews = date(now.year, now.month, 1)
        # Roll to next month
        if renews.month == 12:
            renews = date(renews.year + 1, 1, 1)
        else:
            renews = date(renews.year, renews.month + 1, 1)
        renews_at = datetime(renews.year, renews.month, renews.day)

        org = db.query(Organization).filter_by(id=sid).first()
        f = pro.features or {}
        sub = SchoolBillingSubscription(
            school_id=sid,
            plan_id=pro.id,
            plan_name=pro.plan_name,
            monthly_price=pro.monthly_price,
            billing_cycle="monthly",
            status="active",
            auto_renew=True,
            started_at=now - timedelta(days=90),
            renews_at=renews_at,
            max_teachers=f.get("max_teachers", 50),
            max_students=f.get("max_students", 2000),
            max_classes=f.get("max_classes", 100),
            max_storage_gb=Decimal(str(f.get("storage_gb", 100))),
            max_api_calls=f.get("max_api_calls", 1_000_000),
            billing_contact_email=getattr(org, "email", None) if org else None,
            billing_contact_name=getattr(org, "name", "School") if org else "School",
        )
        db.add(sub)
        db.flush()
        self._seed_mock_invoices(db, sub)
        db.commit()
        return sub

    def _seed_mock_invoices(self, db: Session, sub: SchoolBillingSubscription) -> None:
        """Generate 12 months of historical paid invoices for demo."""
        today = date.today()
        for i in range(1, 13):
            month = today.month - i
            year = today.year
            while month <= 0:
                month += 12
                year -= 1
            inv_date = date(year, month, 1)
            period_end = date(year, month, monthrange(year, month)[1])
            num = f"INV-{year}-{month:02d}-{str(sub.school_id)[:4].upper()}"
            exists = db.query(SchoolBillingInvoice).filter_by(invoice_number=num).first()
            if exists:
                continue
            db.add(SchoolBillingInvoice(
                school_id=sub.school_id,
                subscription_id=sub.id,
                invoice_number=num,
                invoice_date=inv_date,
                billing_period_start=inv_date,
                billing_period_end=period_end,
                subtotal=sub.monthly_price,
                tax=Decimal("0"),
                tax_rate=Decimal("0"),
                total=sub.monthly_price,
                status="paid",
                line_items=[{
                    "description": f"{sub.plan_name} plan (monthly)",
                    "quantity": 1,
                    "unit_price": float(sub.monthly_price),
                    "total": float(sub.monthly_price),
                }],
                paid_at=datetime(year, month, 2),
            ))

    # ── Usage computation ──────────────────────────────────────────────────

    def _compute_usage(self, db: Session, school_id: str, sub: SchoolBillingSubscription) -> Dict:
        """Derive usage live from existing tables."""
        sid = uuid.UUID(school_id)

        teachers = db.query(Teacher).filter_by(organization_id=sid).count()
        students = (
            db.query(func.count(func.distinct(ClassMembership.student_id)))
            .join(Class, ClassMembership.class_id == Class.id)
            .filter(Class.organization_id == sid, ClassMembership.enrollment_status == "active")
            .scalar() or 0
        )
        classes = db.query(Class).filter_by(organization_id=sid).count()

        # Mocked: storage grows with teachers (realistic proxy)
        storage_gb = round(1.0 + teachers * 0.3 + students * 0.01, 1)

        # API calls: SchoolActivityLog entries this month
        period_start = date.today().replace(day=1)
        api_calls = (
            db.query(SchoolActivityLog)
            .filter(
                SchoolActivityLog.school_id == sid,
                SchoolActivityLog.created_at >= datetime(period_start.year, period_start.month, 1),
            )
            .count()
        )

        max_t = sub.max_teachers or 50
        max_s = sub.max_students or 2000
        max_c = sub.max_classes or 100
        max_gb = float(sub.max_storage_gb or 100)
        max_api = sub.max_api_calls or 1_000_000

        def pct(used, limit):
            return round(min(used / max(limit, 1) * 100, 100), 1)

        return {
            "teachers":      {"used": teachers,   "limit": max_t,   "pct": pct(teachers, max_t)},
            "students":      {"used": students,    "limit": max_s,   "pct": pct(students, max_s)},
            "classes":       {"used": classes,     "limit": max_c,   "pct": pct(classes, max_c)},
            "storage_gb":    {"used": storage_gb,  "limit": max_gb,  "pct": pct(storage_gb, max_gb)},
            "api_calls":     {"used": api_calls,   "limit": max_api, "pct": pct(api_calls, max_api)},
        }

    def _compute_forecast(self, usage: Dict, sub: SchoolBillingSubscription) -> List[Dict]:
        """Simple linear 90-day forecast. Returns warning items only."""
        warnings = []
        growth = {"students": 0.05, "teachers": 0.02, "classes": 0.01}
        days = 90
        for key, rate in growth.items():
            info = usage.get(key, {})
            used = info.get("used", 0)
            limit = info.get("limit", 1)
            projected = used * (1 + rate) ** (days / 30)
            if projected > limit * 0.85:
                days_until = max(0, int((limit * 0.95 - used) / (used * rate / 30))) if used else 9999
                warnings.append({
                    "metric": key,
                    "current": used,
                    "projected_90d": round(projected),
                    "limit": limit,
                    "days_until_limit": days_until,
                    "severity": "critical" if projected > limit else "warning",
                })
        return warnings

    # ── Overview ───────────────────────────────────────────────────────────

    def get_overview(self, db: Session, user_id: str, school_id: str) -> Dict:
        self._verify_access(db, user_id, school_id)
        sub = self._get_or_create_subscription(db, school_id)
        plan = db.query(SchoolBillingPlan).filter_by(id=sub.plan_id).first()

        now = date.today()
        days_left = (sub.renews_at.date() - now).days if sub.renews_at else 0

        usage = self._compute_usage(db, school_id, sub)
        forecast = self._compute_forecast(usage, sub)

        # Recommend upgrade if any critical forecast warning
        recommended_slug = None
        if any(w["severity"] == "critical" for w in forecast):
            slugs = ["starter", "pro", "enterprise"]
            idx = slugs.index(plan.plan_slug) if plan else 1
            if idx < 2:
                recommended_slug = slugs[idx + 1]

        recommended_plan = None
        if recommended_slug:
            rp = db.query(SchoolBillingPlan).filter_by(plan_slug=recommended_slug).first()
            if rp:
                recommended_plan = {
                    **self._format_plan(rp),
                    "additional_monthly": float(rp.monthly_price - sub.monthly_price),
                }

        recent_invoices = (
            db.query(SchoolBillingInvoice)
            .filter_by(school_id=uuid.UUID(school_id))
            .order_by(SchoolBillingInvoice.invoice_date.desc())
            .limit(3)
            .all()
        )

        return {
            "subscription": {
                "subscription_id": str(sub.id),
                "plan_name": sub.plan_name,
                "plan_slug": plan.plan_slug if plan else "pro",
                "monthly_price": float(sub.monthly_price),
                "billing_cycle": sub.billing_cycle,
                "status": sub.status,
                "auto_renew": sub.auto_renew,
                "renews_at": sub.renews_at.date().isoformat() if sub.renews_at else None,
                "days_until_renewal": max(0, days_left),
                "billing_contact": sub.billing_contact_name,
            },
            "usage": usage,
            "forecast": forecast,
            "recommended_plan": recommended_plan,
            "recent_invoices": [self._format_invoice_row(inv) for inv in recent_invoices],
        }

    # ── Plan comparison ────────────────────────────────────────────────────

    def get_plan_comparison(self, db: Session, user_id: str, school_id: str) -> Dict:
        self._verify_access(db, user_id, school_id)
        sub = self._get_or_create_subscription(db, school_id)
        usage = self._compute_usage(db, school_id, sub)
        plans = self.get_plans(db)

        for p in plans:
            f = p["features"]
            p["is_current"] = (p["plan_slug"] == (
                db.query(SchoolBillingPlan).filter_by(id=sub.plan_id).first().plan_slug
                if sub.plan_id else "pro"
            ))
            p["additional_monthly"] = round(p["monthly_price"] - float(sub.monthly_price), 2)
            # Flag which limits are exceeded on each plan
            p["limit_warnings"] = {
                "teachers": usage["teachers"]["used"] > f.get("max_teachers", 999_999),
                "students": usage["students"]["used"] > f.get("max_students", 999_999),
                "classes":  usage["classes"]["used"]  > f.get("max_classes", 999_999),
                "storage":  usage["storage_gb"]["used"] > f.get("storage_gb", 999),
            }

        return {"plans": plans, "current_usage": usage}

    # ── Upgrade / downgrade ────────────────────────────────────────────────

    def upgrade_plan(
        self, db: Session, user_id: str, school_id: str,
        plan_slug: str, billing_cycle: str = "monthly"
    ) -> Dict:
        self._verify_access(db, user_id, school_id)
        sub = self._get_or_create_subscription(db, school_id)
        new_plan = db.query(SchoolBillingPlan).filter_by(plan_slug=plan_slug).first()
        if not new_plan:
            raise HTTPException(status_code=404, detail=f"Plan '{plan_slug}' not found")

        old_plan = db.query(SchoolBillingPlan).filter_by(id=sub.plan_id).first()
        old_name = old_plan.plan_name if old_plan else sub.plan_name

        # Proration: remaining days in billing cycle
        today = date.today()
        renews = sub.renews_at.date() if sub.renews_at else today
        days_remaining = max(1, (renews - today).days)
        daily_delta = (new_plan.monthly_price - sub.monthly_price) / Decimal("30")
        proration = round(daily_delta * Decimal(str(days_remaining)), 2)

        # Update subscription
        f = new_plan.features or {}
        sub.plan_id = new_plan.id
        sub.plan_name = new_plan.plan_name
        sub.monthly_price = new_plan.monthly_price
        sub.billing_cycle = billing_cycle
        sub.max_teachers = f.get("max_teachers", 50)
        sub.max_students = f.get("max_students", 2000)
        sub.max_classes = f.get("max_classes", 100)
        sub.max_storage_gb = Decimal(str(f.get("storage_gb", 100)))
        sub.max_api_calls = f.get("max_api_calls", 1_000_000)

        # Create proration invoice if amount is non-zero
        invoice_id = None
        if abs(proration) > Decimal("0.01"):
            inv_num = f"INV-{today.year}-{today.month:02d}-CHG-{str(sub.id)[:4].upper()}"
            desc = (
                f"Plan {'upgrade' if proration > 0 else 'downgrade'}: "
                f"{old_name} → {new_plan.plan_name} (prorated {days_remaining}d)"
            )
            inv = SchoolBillingInvoice(
                school_id=sub.school_id,
                subscription_id=sub.id,
                invoice_number=inv_num,
                invoice_date=today,
                billing_period_start=today,
                billing_period_end=renews,
                subtotal=proration,
                tax=Decimal("0"),
                tax_rate=Decimal("0"),
                total=proration,
                status="paid",
                line_items=[{"description": desc, "quantity": 1,
                             "unit_price": float(proration), "total": float(proration)}],
                paid_at=datetime.utcnow(),
            )
            db.add(inv)
            db.flush()
            invoice_id = str(inv.id)

        self._log(db, school_id, user_id, "upgrade_plan", "subscription", str(sub.id),
                  {"from_plan": old_name, "to_plan": new_plan.plan_name, "proration": str(proration)})
        db.commit()

        direction = "upgraded" if new_plan.monthly_price > (old_plan.monthly_price if old_plan else 0) else "downgraded"
        return {
            "status": direction,
            "plan_name": new_plan.plan_name,
            "monthly_price": float(new_plan.monthly_price),
            "proration_charge": float(proration),
            "proration_days": days_remaining,
            "effective_date": today.isoformat(),
            "invoice_id": invoice_id,
        }

    # ── Invoice management ─────────────────────────────────────────────────

    def list_invoices(
        self, db: Session, user_id: str, school_id: str,
        page: int = 1, page_size: int = 20
    ) -> Dict:
        self._verify_access(db, user_id, school_id)
        self._get_or_create_subscription(db, school_id)  # ensure seeded
        sid = uuid.UUID(school_id)
        q = db.query(SchoolBillingInvoice).filter_by(school_id=sid)
        total = q.count()
        invoices = (
            q.order_by(SchoolBillingInvoice.invoice_date.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return {
            "invoices": [self._format_invoice_row(inv) for inv in invoices],
            "pagination": {
                "page": page, "page_size": page_size, "total": total,
                "pages": max(1, (total + page_size - 1) // page_size),
            },
        }

    def get_invoice_detail(
        self, db: Session, user_id: str, school_id: str, invoice_id: str
    ) -> Dict:
        self._verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        inv = db.query(SchoolBillingInvoice).filter_by(
            id=uuid.UUID(invoice_id), school_id=sid
        ).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        sub = db.query(SchoolBillingSubscription).filter_by(school_id=sid).first()
        org = db.query(Organization).filter_by(id=sid).first()
        return {
            **self._format_invoice_row(inv),
            "billing_period_start": inv.billing_period_start.isoformat() if inv.billing_period_start else None,
            "billing_period_end": inv.billing_period_end.isoformat() if inv.billing_period_end else None,
            "line_items": inv.line_items or [],
            "subtotal": float(inv.subtotal),
            "tax": float(inv.tax or 0),
            "tax_rate": float(inv.tax_rate or 0),
            "total": float(inv.total),
            "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            "notes": inv.notes,
            "school_name": org.name if org else "School",
            "billing_contact": sub.billing_contact_name if sub else None,
            "billing_email": sub.billing_contact_email if sub else None,
        }

    def email_invoice(
        self, db: Session, user_id: str, school_id: str,
        invoice_id: str, to_email: Optional[str] = None
    ) -> Dict:
        self._verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        inv = db.query(SchoolBillingInvoice).filter_by(
            id=uuid.UUID(invoice_id), school_id=sid
        ).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")

        sub = db.query(SchoolBillingSubscription).filter_by(school_id=sid).first()
        recipient = to_email or (sub.billing_contact_email if sub else None)
        if not recipient:
            raise HTTPException(status_code=400, detail="No billing email configured")

        inv.email_sent_to = recipient
        inv.email_sent_at = datetime.utcnow()
        self._log(db, school_id, user_id, "email_invoice", "invoice", str(inv.id),
                  {"to": recipient})
        db.commit()
        return {"status": "sent", "to": recipient, "invoice_number": inv.invoice_number}

    def update_billing_settings(
        self, db: Session, user_id: str, school_id: str, data: Dict
    ) -> Dict:
        self._verify_access(db, user_id, school_id)
        sid = uuid.UUID(school_id)
        settings = db.query(SchoolBillingSettings).filter_by(school_id=sid).first()
        if not settings:
            settings = SchoolBillingSettings(school_id=sid)
            db.add(settings)
        for field in ("billing_contact_name", "billing_contact_email", "billing_contact_phone",
                      "billing_address", "send_invoice_emails", "alert_at_pct_usage"):
            if field in data:
                setattr(settings, field, data[field])
        if "additional_invoice_emails" in data:
            settings.additional_invoice_emails = data["additional_invoice_emails"]

        # Mirror contact into subscription
        sub = db.query(SchoolBillingSubscription).filter_by(school_id=sid).first()
        if sub:
            if "billing_contact_name" in data:
                sub.billing_contact_name = data["billing_contact_name"]
            if "billing_contact_email" in data:
                sub.billing_contact_email = data["billing_contact_email"]

        db.commit()
        return {"status": "updated"}

    # ── Formatters ─────────────────────────────────────────────────────────

    def _format_invoice_row(self, inv: SchoolBillingInvoice) -> Dict:
        return {
            "invoice_id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date.isoformat(),
            "total": float(inv.total),
            "status": inv.status,
            "email_sent_to": inv.email_sent_to,
        }

    # ── Logging ────────────────────────────────────────────────────────────

    def _log(
        self, db: Session, school_id: str, user_id: str,
        action: str, resource_type: str = "", resource_id: str = "",
        changes: Optional[Dict] = None,
    ) -> None:
        db.add(SchoolActivityLog(
            school_id=uuid.UUID(school_id),
            actor_user_id=uuid.UUID(user_id),
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            changes=changes or {},
        ))


billing_service = BillingService()
