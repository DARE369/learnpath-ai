"""
Subscription & payment endpoints (Packet 4.1).

Two routers live here:
  - `router`          → mounted at /api/subscriptions
  - `payments_router` → mounted at /api/payments

All routes require auth except GET /plans (public pricing) and the Flutterwave
webhook (verified by signature, not JWT).
"""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.subscription_service import (
    subscription_service,
    PlanNotFoundError,
    SubscriptionNotFoundError,
    InvalidPlanChangeError,
    SubscriptionError,
)
from services.payment_service import payment_service, PaymentError

logger = logging.getLogger(__name__)
router = APIRouter()
payments_router = APIRouter()


# ---------- Request models ----------

class CreateSubscriptionRequest(BaseModel):
    plan_type: str = Field(..., description="free | pro | premium")
    billing_cycle: str = Field("monthly", description="monthly | yearly")


class PlanChangeRequest(BaseModel):
    new_plan: str = Field(..., description="target plan_type")


class CancelRequest(BaseModel):
    reason: str = ""


class InitializePaymentRequest(BaseModel):
    plan_type: str
    billing_cycle: str = "monthly"


# ---------- Subscription endpoints ----------

@router.get("/plans")
async def list_plans():
    """Public plan catalogue for the pricing/comparison UI."""
    return {
        "plans": [
            {
                "plan_type": key,
                "name": plan["name"],
                "price": plan["price"],
                "currency": plan["currency"],
                "yearly_price": subscription_service.plan_price(key, "yearly"),
                "videos_per_month": plan["videos_per_month"],
                "hours_per_month": plan["hours_per_month"],
                "questions_per_day": plan["questions_per_day"],
                "concepts_per_topic": plan["concepts_per_topic"],
                "features": plan["features"],
            }
            for key, plan in subscription_service.PLANS.items()
        ]
    }


@router.get("/current")
async def get_current_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Current plan + live usage for the signed-in user."""
    return subscription_service.get_user_plan(db, current_user.id)


@router.post("/create")
async def create_subscription(
    payload: CreateSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a subscription directly. Only the Free plan can be created here —
    paid plans must go through /api/payments/initialize so money is collected
    before access is granted.
    """
    if payload.plan_type != "free":
        raise HTTPException(
            status_code=400,
            detail="Paid plans require payment — use /api/payments/initialize",
        )
    try:
        return subscription_service.create_subscription(
            db, current_user.id, payload.plan_type, payload.billing_cycle
        )
    except PlanNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SubscriptionError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/upgrade")
async def upgrade_subscription(
    payload: PlanChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upgrade to a higher tier. Returns a Flutterwave payment link for the
    pro-rated upgrade charge; the subscription switches once payment confirms.
    """
    try:
        subscription_service.get_plan(payload.new_plan)
    except PlanNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))

    current = subscription_service.get_active_subscription(db, current_user.id)
    current_plan = current.plan_type if current else "free"
    if not subscription_service.is_upgrade(current_plan, payload.new_plan):
        raise HTTPException(
            status_code=400,
            detail=f"'{payload.new_plan}' is not an upgrade from '{current_plan}'",
        )

    cycle = current.billing_cycle if current else "monthly"
    days_remaining = 0.0
    if current and current.renewal_date:
        days_remaining = max(0.0, (current.renewal_date - datetime.utcnow()).total_seconds() / 86400.0)
    charge = subscription_service.upgrade_charge(
        current_plan, payload.new_plan, cycle, days_remaining
    )

    try:
        return await subscription_service.process_payment(
            db,
            user_id=current_user.id,
            amount=charge,
            plan_type=payload.new_plan,
            email=current_user.email,
            billing_cycle=cycle,
        )
    except PaymentError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/downgrade")
async def downgrade_subscription(
    payload: PlanChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Queue a downgrade for the next renewal (no charge)."""
    try:
        return subscription_service.downgrade_plan(db, current_user.id, payload.new_plan)
    except PlanNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SubscriptionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InvalidPlanChangeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancel")
async def cancel_subscription(
    payload: CancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel auto-renew; access continues until the current period ends."""
    try:
        return subscription_service.cancel_subscription(db, current_user.id, payload.reason)
    except SubscriptionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/history")
async def billing_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All billing line items for the signed-in user."""
    return {"history": subscription_service.get_billing_history(db, current_user.id)}


# ---------- Payment endpoints ----------

@payments_router.post("/initialize")
async def initialize_payment(
    payload: InitializePaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Start a payment for a paid plan. Returns {payment_link, reference, ...};
    redirect the browser to payment_link to complete checkout.
    """
    try:
        plan = subscription_service.get_plan(payload.plan_type)
    except PlanNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if payload.plan_type == "free":
        raise HTTPException(status_code=400, detail="Free plan does not require payment")

    amount = subscription_service.plan_price(payload.plan_type, payload.billing_cycle)
    try:
        return await subscription_service.process_payment(
            db,
            user_id=current_user.id,
            amount=amount,
            plan_type=payload.plan_type,
            email=current_user.email,
            billing_cycle=payload.billing_cycle,
        )
    except PaymentError as e:
        raise HTTPException(status_code=502, detail=str(e))


@payments_router.get("/verify/{reference}")
async def verify_payment(
    reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verify a payment with Flutterwave and, on success, provision the plan.
    Safe to call repeatedly — provisioning is idempotent.
    """
    try:
        result = await payment_service.verify_payment(reference)
    except PaymentError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if result["status"] == "successful":
        try:
            confirmed = subscription_service.confirm_payment(
                db, reference, flutterwave_id=result.get("flutterwave_id")
            )
            return {"status": "successful", **confirmed}
        except SubscriptionError as e:
            raise HTTPException(status_code=400, detail=str(e))
    elif result["status"] == "failed":
        subscription_service.fail_payment(db, reference)

    return {"status": result["status"]}


@payments_router.post("/webhook")
async def flutterwave_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Flutterwave webhook. Verifies the `verif-hash` header, then reconciles the
    transaction. Always returns 200 once the signature is valid so Flutterwave
    stops retrying.
    """
    raw = await request.body()
    signature = request.headers.get("verif-hash")
    if not payment_service.verify_webhook_signature(signature, raw):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    try:
        parsed = payment_service.parse_webhook_event(event)
    except PaymentError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if parsed["status"] == "successful":
        try:
            subscription_service.confirm_payment(
                db, parsed["reference"], flutterwave_id=parsed.get("flutterwave_id")
            )
        except SubscriptionError as e:
            logger.warning(f"Webhook confirm skipped for {parsed['reference']}: {e}")
    elif parsed["status"] == "failed":
        subscription_service.fail_payment(db, parsed["reference"])

    return {"status": "ok"}
