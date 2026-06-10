"""Settings service for ADMIN-1.6: profile, security, classes, integrations, billing, privacy."""

import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from models import (
    AccountDeletionRequest,
    BillingHistory,
    Class,
    ClassMembership,
    ClassMetadata,
    DataExportRequest,
    Integration,
    LoginActivity,
    Subscription,
    Teacher,
    TeacherPreference,
    TeacherProfile,
    TwoFactorAuth,
    User,
    UserSession,
)
from services.auth_service import hash_password, verify_password

logger = logging.getLogger(__name__)

PLAN_LIMITS = {
    "free":    {"classes": 1,  "students": 30,  "storage_gb": 1,   "videos": 5},
    "pro":     {"classes": 5,  "students": 200, "storage_gb": 10,  "videos": 50},
    "premium": {"classes": 20, "students": 1000,"storage_gb": 50,  "videos": 200},
}


class SettingsService:

    # ── Profile ────────────────────────────────────────────────────────────────

    def get_profile(self, db: Session, user_id: str) -> Dict:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404)

        prof = db.query(TeacherProfile).filter(TeacherProfile.user_id == user_id).first()

        return {
            "user_id": str(user_id),
            "full_name": user.full_name,
            "email": user.email,
            "email_verified": user.email_verified,
            "bio": prof.bio if prof else None,
            "phone": prof.phone if prof else None,
            "school_name": prof.school_name if prof else None,
            "grade_levels": (prof.grade_levels or []) if prof else [],
            "social_links": (prof.social_links or {}) if prof else {},
            "avatar_url": prof.avatar_url if prof else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }

    def update_profile(self, db: Session, user_id: str, data: Dict) -> Dict:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404)

        if "full_name" in data:
            user.full_name = data["full_name"]

        prof = db.query(TeacherProfile).filter(TeacherProfile.user_id == user_id).first()
        if not prof:
            prof = TeacherProfile(id=uuid.uuid4(), user_id=user_id)
            db.add(prof)

        for field in ("bio", "phone", "school_name", "grade_levels", "social_links", "avatar_url"):
            if field in data:
                setattr(prof, field, data[field])

        prof.updated_at = datetime.utcnow()
        db.commit()
        return {"status": "updated"}

    # ── Account & Security ─────────────────────────────────────────────────────

    def change_password(self, db: Session, user_id: str, current_pw: str, new_pw: str) -> Dict:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.password_hash:
            raise HTTPException(status_code=400, detail="Password change not available for OAuth accounts")
        if not verify_password(current_pw, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.password_hash = hash_password(new_pw)
        user.updated_at = datetime.utcnow()
        db.commit()
        return {"status": "changed"}

    def init_2fa(self, db: Session, user_id: str) -> Dict:
        """Generate a TOTP secret and QR code URL (not yet enabled until confirmed)."""
        try:
            import pyotp
            import qrcode
            import io
            import base64
        except ImportError:
            raise HTTPException(status_code=503, detail="2FA dependencies not installed")

        user = db.query(User).filter(User.id == user_id).first()
        secret = pyotp.random_base32()

        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(name=user.email or str(user_id), issuer_name="LearnPath AI")

        img = qrcode.make(uri)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        qr_b64 = base64.b64encode(buf.getvalue()).decode()

        recovery_codes = [{"code": secrets.token_hex(4).upper(), "used": False} for _ in range(8)]

        row = db.query(TwoFactorAuth).filter(TwoFactorAuth.user_id == user_id).first()
        if not row:
            row = TwoFactorAuth(id=uuid.uuid4(), user_id=user_id)
            db.add(row)
        row.secret = secret
        row.recovery_codes = recovery_codes
        row.is_enabled = False
        db.commit()

        return {
            "secret": secret,
            "qr_code": f"data:image/png;base64,{qr_b64}",
            "recovery_codes": [c["code"] for c in recovery_codes],
        }

    def confirm_2fa(self, db: Session, user_id: str, totp_code: str) -> Dict:
        try:
            import pyotp
        except ImportError:
            raise HTTPException(status_code=503, detail="2FA dependencies not installed")

        row = db.query(TwoFactorAuth).filter(TwoFactorAuth.user_id == user_id).first()
        if not row or not row.secret:
            raise HTTPException(status_code=400, detail="2FA not initialized")

        totp = pyotp.TOTP(row.secret)
        if not totp.verify(totp_code, valid_window=1):
            raise HTTPException(status_code=400, detail="Invalid TOTP code")

        row.is_enabled = True
        row.enabled_at = datetime.utcnow()
        db.commit()
        return {"status": "2fa_enabled", "recovery_codes": [c["code"] for c in (row.recovery_codes or [])]}

    def disable_2fa(self, db: Session, user_id: str, password: str) -> Dict:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.password_hash:
            raise HTTPException(status_code=400, detail="Cannot verify identity")
        if not verify_password(password, user.password_hash):
            raise HTTPException(status_code=400, detail="Password incorrect")
        row = db.query(TwoFactorAuth).filter(TwoFactorAuth.user_id == user_id).first()
        if row:
            row.is_enabled = False
            db.commit()
        return {"status": "2fa_disabled"}

    def get_2fa_status(self, db: Session, user_id: str) -> Dict:
        row = db.query(TwoFactorAuth).filter(TwoFactorAuth.user_id == user_id).first()
        return {"is_enabled": row.is_enabled if row else False}

    def get_sessions(self, db: Session, user_id: str) -> List[Dict]:
        now = datetime.utcnow()
        rows = (
            db.query(UserSession)
            .filter(UserSession.user_id == user_id, UserSession.expires_at > now)
            .order_by(UserSession.last_activity.desc())
            .all()
        )
        return [
            {
                "session_id": str(r.id),
                "device_name": r.device_name,
                "device_type": r.device_type,
                "os_name": r.os_name,
                "browser_name": r.browser_name,
                "ip_address": r.ip_address,
                "created_at": r.created_at.isoformat(),
                "last_activity": r.last_activity.isoformat(),
            }
            for r in rows
        ]

    def logout_other_sessions(self, db: Session, user_id: str, keep_session_id: Optional[str]) -> Dict:
        q = db.query(UserSession).filter(UserSession.user_id == user_id)
        if keep_session_id:
            q = q.filter(UserSession.id != keep_session_id)
        count = q.count()
        q.update({"expires_at": datetime.utcnow()}, synchronize_session=False)
        db.commit()
        return {"logged_out": count}

    def get_login_activity(self, db: Session, user_id: str, limit: int = 50) -> List[Dict]:
        rows = (
            db.query(LoginActivity)
            .filter(LoginActivity.user_id == user_id)
            .order_by(LoginActivity.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "timestamp": r.created_at.isoformat(),
                "ip_address": r.ip_address,
                "device": f"{r.browser_name or '?'} on {r.os_name or '?'}",
                "status": r.status,
                "failure_reason": r.failure_reason,
            }
            for r in rows
        ]

    # ── Classes ────────────────────────────────────────────────────────────────

    def get_classes(self, db: Session, teacher_user_id: str) -> List[Dict]:
        teacher = db.query(Teacher).filter(Teacher.user_id == teacher_user_id).first()
        if not teacher:
            return []

        classes = db.query(Class).filter(Class.teacher_id == teacher.id).all()
        result = []
        for cls in classes:
            meta = db.query(ClassMetadata).filter(ClassMetadata.class_id == cls.id).first()
            student_count = db.query(ClassMembership).filter(ClassMembership.class_id == cls.id).count()
            result.append({
                "class_id": str(cls.id),
                "name": cls.name,
                "subject": cls.subject,
                "description": cls.description,
                "max_students": cls.max_students,
                "student_count": student_count,
                "is_archived": meta.is_archived if meta else False,
                "created_at": cls.created_at.isoformat(),
            })
        return result

    def create_class(self, db: Session, teacher_user_id: str, data: Dict) -> Dict:
        teacher = db.query(Teacher).filter(Teacher.user_id == teacher_user_id).first()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher record not found")

        cls = Class(
            id=uuid.uuid4(),
            organization_id=teacher.organization_id,
            teacher_id=teacher.id,
            name=data["name"],
            subject=data.get("subject", ""),
            description=data.get("description", ""),
            max_students=data.get("max_students", 30),
        )
        db.add(cls)
        db.flush()

        db.add(ClassMetadata(
            id=uuid.uuid4(),
            class_id=cls.id,
            teacher_id=teacher_user_id,
            is_archived=False,
        ))
        db.commit()
        db.refresh(cls)
        return {"class_id": str(cls.id), "status": "created"}

    def update_class(self, db: Session, teacher_user_id: str, class_id: str, data: Dict) -> Dict:
        teacher = db.query(Teacher).filter(Teacher.user_id == teacher_user_id).first()
        cls = db.query(Class).filter(Class.id == class_id).first()
        if not cls or not teacher or cls.teacher_id != teacher.id:
            raise HTTPException(status_code=403)
        for field in ("name", "subject", "description", "max_students"):
            if field in data:
                setattr(cls, field, data[field])
        cls.updated_at = datetime.utcnow()
        db.commit()
        return {"status": "updated"}

    def archive_class(self, db: Session, teacher_user_id: str, class_id: str) -> Dict:
        teacher = db.query(Teacher).filter(Teacher.user_id == teacher_user_id).first()
        cls = db.query(Class).filter(Class.id == class_id).first()
        if not cls or not teacher or cls.teacher_id != teacher.id:
            raise HTTPException(status_code=403)
        meta = db.query(ClassMetadata).filter(ClassMetadata.class_id == class_id).first()
        if not meta:
            meta = ClassMetadata(id=uuid.uuid4(), class_id=class_id, teacher_id=teacher_user_id)
            db.add(meta)
        meta.is_archived = True
        meta.archived_at = datetime.utcnow()
        db.commit()
        return {"status": "archived"}

    def duplicate_class(
        self, db: Session, teacher_user_id: str, class_id: str, new_name: str, copy_roster: bool
    ) -> Dict:
        teacher = db.query(Teacher).filter(Teacher.user_id == teacher_user_id).first()
        src = db.query(Class).filter(Class.id == class_id).first()
        if not src or not teacher or src.teacher_id != teacher.id:
            raise HTTPException(status_code=403)

        new_cls = Class(
            id=uuid.uuid4(),
            organization_id=src.organization_id,
            teacher_id=teacher.id,
            name=new_name,
            subject=src.subject,
            description=src.description,
            max_students=src.max_students,
        )
        db.add(new_cls)
        db.flush()

        db.add(ClassMetadata(id=uuid.uuid4(), class_id=new_cls.id, teacher_id=teacher_user_id, is_archived=False))

        if copy_roster:
            members = db.query(ClassMembership).filter(ClassMembership.class_id == class_id).all()
            for m in members:
                db.add(ClassMembership(
                    id=uuid.uuid4(),
                    class_id=new_cls.id,
                    student_id=m.student_id,
                ))

        db.commit()
        db.refresh(new_cls)
        return {"new_class_id": str(new_cls.id), "status": "duplicated"}

    # ── Integrations ───────────────────────────────────────────────────────────

    def get_integrations(self, db: Session, user_id: str) -> List[Dict]:
        rows = db.query(Integration).filter(Integration.user_id == user_id).all()
        connected = {r.provider: r for r in rows}
        providers = ["google_classroom", "teams", "zoom"]
        return [
            {
                "provider": p,
                "connected": p in connected,
                "provider_email": connected[p].provider_email if p in connected else None,
                "provider_name": connected[p].provider_name if p in connected else None,
                "connected_at": connected[p].connected_at.isoformat() if p in connected else None,
            }
            for p in providers
        ]

    def connect_integration(self, db: Session, user_id: str, provider: str, data: Dict) -> Dict:
        """Store integration credentials (OAuth tokens provided by frontend callback)."""
        row = db.query(Integration).filter(
            Integration.user_id == user_id, Integration.provider == provider
        ).first()
        if not row:
            row = Integration(id=uuid.uuid4(), user_id=user_id, provider=provider)
            db.add(row)
        row.access_token = data.get("access_token")
        row.refresh_token = data.get("refresh_token")
        row.provider_email = data.get("provider_email")
        row.provider_name = data.get("provider_name")
        row.provider_user_id = data.get("provider_user_id")
        row.connected_at = datetime.utcnow()
        db.commit()
        return {"status": "connected", "provider": provider}

    def disconnect_integration(self, db: Session, user_id: str, provider: str) -> Dict:
        db.query(Integration).filter(
            Integration.user_id == user_id, Integration.provider == provider
        ).delete()
        db.commit()
        return {"status": "disconnected", "provider": provider}

    # ── Preferences ────────────────────────────────────────────────────────────

    def get_preferences(self, db: Session, user_id: str) -> Dict:
        row = db.query(TeacherPreference).filter(TeacherPreference.user_id == user_id).first()
        defaults = {
            "theme": "system", "language": "en", "timezone": "UTC",
            "default_class_view": "list", "auto_refresh_interval": 0,
            "remember_sidebar_state": True, "quiet_hours_enabled": False,
            "quiet_hours_start": "20:00", "quiet_hours_end": "08:00",
            "alert_at_risk": True, "alert_low_submission": True, "alert_system": True,
        }
        if not row:
            return defaults
        return {
            "theme": row.theme or "system",
            "language": row.language or "en",
            "timezone": row.timezone or "UTC",
            "default_class_view": row.default_class_view or "list",
            "auto_refresh_interval": row.auto_refresh_interval or 0,
            "remember_sidebar_state": row.remember_sidebar_state,
            "quiet_hours_enabled": row.quiet_hours_enabled,
            "quiet_hours_start": row.quiet_hours_start or "20:00",
            "quiet_hours_end": row.quiet_hours_end or "08:00",
            "alert_at_risk": row.alert_at_risk,
            "alert_low_submission": row.alert_low_submission,
            "alert_system": row.alert_system,
        }

    def update_preferences(self, db: Session, user_id: str, data: Dict) -> Dict:
        row = db.query(TeacherPreference).filter(TeacherPreference.user_id == user_id).first()
        if not row:
            row = TeacherPreference(id=uuid.uuid4(), user_id=user_id)
            db.add(row)
        allowed = {
            "theme", "language", "timezone", "default_class_view", "auto_refresh_interval",
            "remember_sidebar_state", "quiet_hours_enabled", "quiet_hours_start",
            "quiet_hours_end", "alert_at_risk", "alert_low_submission", "alert_system",
        }
        for k, v in data.items():
            if k in allowed:
                setattr(row, k, v)
        row.updated_at = datetime.utcnow()
        db.commit()
        return {"status": "saved"}

    # ── Billing ────────────────────────────────────────────────────────────────

    def get_billing(self, db: Session, user_id: str) -> Dict:
        sub = (
            db.query(Subscription)
            .filter(Subscription.user_id == user_id, Subscription.status == "active")
            .order_by(Subscription.created_at.desc())
            .first()
        )
        plan_type = sub.plan_type if sub else "free"
        limits = PLAN_LIMITS.get(plan_type, PLAN_LIMITS["free"])

        teacher = db.query(Teacher).filter(Teacher.user_id == user_id).first()
        num_classes = 0
        num_students = 0
        if teacher:
            classes = db.query(Class).filter(Class.teacher_id == teacher.id).all()
            num_classes = len(classes)
            for cls in classes:
                num_students += db.query(ClassMembership).filter(ClassMembership.class_id == cls.id).count()

        invoices = (
            db.query(BillingHistory)
            .filter(BillingHistory.user_id == user_id)
            .order_by(BillingHistory.billing_date.desc())
            .limit(12)
            .all()
        )

        return {
            "subscription": {
                "plan_type": plan_type,
                "plan_name": f"LearnPath {plan_type.title()}",
                "billing_cycle": sub.billing_cycle if sub else "monthly",
                "renewal_date": sub.renewal_date.isoformat() if sub and sub.renewal_date else None,
                "status": sub.status if sub else "free",
            },
            "usage": {
                "num_classes": num_classes,
                "max_classes": limits["classes"],
                "num_students": num_students,
                "max_students": limits["students"],
                "storage_gb": 0,
                "max_storage_gb": limits["storage_gb"],
                "num_videos": 0,
                "max_videos": limits["videos"],
            },
            "invoices": [
                {
                    "billing_date": inv.billing_date.isoformat(),
                    "amount": inv.amount,
                    "currency": inv.currency,
                    "description": inv.description,
                }
                for inv in invoices
            ],
        }

    # ── Privacy & Data ─────────────────────────────────────────────────────────

    def request_data_export(self, db: Session, user_id: str) -> Dict:
        req = DataExportRequest(
            id=uuid.uuid4(),
            user_id=user_id,
            status="pending",
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return {
            "export_id": str(req.id),
            "status": "pending",
            "message": "Your data export is being prepared. You'll be notified when it's ready.",
        }

    def get_export_status(self, db: Session, user_id: str) -> List[Dict]:
        rows = (
            db.query(DataExportRequest)
            .filter(DataExportRequest.user_id == user_id)
            .order_by(DataExportRequest.created_at.desc())
            .limit(5)
            .all()
        )
        return [
            {
                "export_id": str(r.id),
                "status": r.status,
                "requested_at": r.requested_at.isoformat(),
                "download_url": r.download_url,
                "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            }
            for r in rows
        ]

    def request_account_deletion(self, db: Session, user_id: str, confirmation: str) -> Dict:
        if confirmation.strip().upper() != "DELETE":
            raise HTTPException(status_code=400, detail="Type DELETE to confirm")

        existing = (
            db.query(AccountDeletionRequest)
            .filter(AccountDeletionRequest.user_id == user_id, AccountDeletionRequest.status == "pending")
            .first()
        )
        if existing:
            return {
                "status": "pending",
                "scheduled_for": existing.scheduled_deletion_date.isoformat(),
                "message": "Deletion already scheduled.",
            }

        req = AccountDeletionRequest(
            id=uuid.uuid4(),
            user_id=user_id,
            scheduled_deletion_date=datetime.utcnow() + timedelta(days=30),
            status="pending",
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return {
            "status": "scheduled",
            "scheduled_for": req.scheduled_deletion_date.isoformat(),
            "message": "Your account will be deleted in 30 days. You can cancel at any time.",
        }

    def cancel_account_deletion(self, db: Session, user_id: str) -> Dict:
        row = (
            db.query(AccountDeletionRequest)
            .filter(AccountDeletionRequest.user_id == user_id, AccountDeletionRequest.status == "pending")
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="No pending deletion request")
        row.status = "canceled"
        row.canceled_at = datetime.utcnow()
        db.commit()
        return {"status": "canceled"}


settings_service = SettingsService()
