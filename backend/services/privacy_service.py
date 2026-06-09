"""
Data-subject rights (Stage 8 / NDPR-GDPR): export and erasure.

export_user_data walks every mapped table that has a `user_id` column and dumps
that user's rows (plus their User row), so the export stays complete as the
schema grows. delete_user_account performs erasure by ANONYMISING the User row
(the PII anchor) and deactivating the account — the rest of the data is keyed by
an opaque, now-unlinkable user_id. A full hard cascade delete is a follow-up
(needs FK-aware ordering across child tables like path_modules).
"""

import datetime
import decimal
import logging
import uuid
from typing import Dict

from database import Base
from models import User

logger = logging.getLogger(__name__)


def _jsonable(v):
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return float(v)
    return v


def export_user_data(db, user_id) -> Dict:
    """Return {table_name: [rows...]} for every user-scoped table, plus the user."""
    out: Dict[str, list] = {}

    # The User row itself (keyed by id, not user_id).
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        cols = [c.key for c in user.__table__.columns]
        # Never export the password hash.
        out["users"] = [{c: _jsonable(getattr(user, c)) for c in cols if c != "password_hash"}]

    for mapper in Base.registry.mappers:
        cls = mapper.class_
        col_keys = [c.key for c in mapper.columns]
        if "user_id" not in col_keys:
            continue
        try:
            rows = db.query(cls).filter(getattr(cls, "user_id") == user_id).all()
        except Exception as e:
            logger.warning(f"export skipped {cls.__tablename__}: {e}")
            continue
        if rows:
            out[cls.__tablename__] = [
                {c: _jsonable(getattr(r, c)) for c in col_keys} for r in rows
            ]
    return out


def delete_user_account(db, user: User) -> None:
    """Erasure by anonymisation: scrub PII from the User row and deactivate it so
    the account can no longer be used or identified."""
    anon = f"deleted+{uuid.uuid4().hex[:12]}@deleted.invalid"
    user.email = anon
    user.full_name = None
    user.password_hash = None
    for attr in ("google_id", "profile_image_url", "bio", "country", "phone"):
        if hasattr(user, attr):
            setattr(user, attr, None)
    if hasattr(user, "auth_provider"):
        user.auth_provider = "deleted"
    user.account_active = False
    db.commit()
    logger.info("Account anonymised + deactivated (erasure)")
