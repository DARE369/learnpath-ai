"""
Study-buddy social graph (Phase 2).

A lightweight friend-graph: search users, send/accept/decline requests, list
buddies. Presence is derived from User.last_seen_at (a throttled heartbeat set in
get_current_user). Buddy stats reuse UserStreak + recent QuizSession scores.

Deferred (recorded in the ledger): real-time WebSocket presence, messaging,
"study together" rooms, and sharing notes/uploads with buddies.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from models import (
    User, BuddyConnection, UserStreak, QuizSession, SharedItem, BuddyMessage,
)

logger = logging.getLogger(__name__)

ONLINE_WINDOW = timedelta(minutes=5)


class BuddyService:

    # ── presence + stats ─────────────────────────────────────────────────────

    @staticmethod
    def _is_online(u: User) -> bool:
        return bool(u.last_seen_at and (datetime.utcnow() - u.last_seen_at) <= ONLINE_WINDOW)

    def _card(self, db: Session, u: User, connection_id: str = None) -> dict:
        streak = db.query(UserStreak).filter(UserStreak.user_id == u.id).first()
        recent = (
            db.query(QuizSession.score_percent)
            .filter(QuizSession.user_id == u.id, QuizSession.score_percent.isnot(None))
            .order_by(QuizSession.created_at.desc())
            .limit(10)
            .all()
        )
        scores = [r[0] for r in recent if r[0] is not None]
        return {
            "user_id": str(u.id),
            "name": u.full_name or u.email.split("@")[0],
            "online": self._is_online(u),
            "streak_days": streak.current_streak_days if streak else 0,
            "avg_score": int(sum(scores) / len(scores)) if scores else None,
            "connection_id": connection_id,
        }

    # ── connection lookups ─────────────────────────────────────────────────--

    @staticmethod
    def _between(db: Session, a, b) -> Optional[BuddyConnection]:
        return (
            db.query(BuddyConnection)
            .filter(or_(
                and_(BuddyConnection.requester_id == a, BuddyConnection.recipient_id == b),
                and_(BuddyConnection.requester_id == b, BuddyConnection.recipient_id == a),
            ))
            .first()
        )

    # ── search ───────────────────────────────────────────────────────────────

    def search_users(self, db: Session, me_id, q: str, limit: int = 12) -> List[dict]:
        if not q or len(q.strip()) < 2:
            return []
        like = f"%{q.strip().lower()}%"
        rows = (
            db.query(User)
            .filter(
                User.id != me_id,
                User.account_active.is_(True),
                or_(User.full_name.ilike(like), User.email.ilike(like)),
            )
            .limit(limit)
            .all()
        )
        out = []
        for u in rows:
            conn = self._between(db, me_id, u.id)
            if conn is None:
                rel = "none"
            elif conn.status == "accepted":
                rel = "buddies"
            elif str(conn.requester_id) == str(me_id):
                rel = "request_sent"
            else:
                rel = "request_received"
            out.append({
                "user_id": str(u.id),
                "name": u.full_name or u.email.split("@")[0],
                "relationship": rel,
            })
        return out

    # ── requests ─────────────────────────────────────────────────────────────

    def send_request(self, db: Session, me_id, target_id: str) -> dict:
        if str(target_id) == str(me_id):
            raise ValueError("You can't add yourself.")
        target = db.query(User).filter(User.id == target_id).first()
        if not target:
            raise ValueError("User not found.")
        if self._between(db, me_id, target_id):
            raise ValueError("A connection already exists.")
        conn = BuddyConnection(requester_id=me_id, recipient_id=target_id, status="pending")
        db.add(conn)
        db.commit()
        return {"status": "request_sent", "connection_id": str(conn.id)}

    def respond(self, db: Session, me_id, connection_id: str, accept: bool) -> dict:
        conn = db.query(BuddyConnection).filter(BuddyConnection.id == connection_id).first()
        if not conn or str(conn.recipient_id) != str(me_id):
            raise ValueError("Request not found.")
        if conn.status != "pending":
            raise ValueError("Request already handled.")
        if accept:
            conn.status = "accepted"
            conn.accepted_at = datetime.utcnow()
            db.commit()
            return {"status": "accepted"}
        db.delete(conn)
        db.commit()
        return {"status": "declined"}

    def remove(self, db: Session, me_id, connection_id: str) -> dict:
        conn = db.query(BuddyConnection).filter(BuddyConnection.id == connection_id).first()
        if not conn or str(me_id) not in (str(conn.requester_id), str(conn.recipient_id)):
            raise ValueError("Connection not found.")
        db.delete(conn)
        db.commit()
        return {"status": "removed"}

    # ── listing ──────────────────────────────────────────────────────────────

    def list_for_user(self, db: Session, me_id) -> Dict:
        conns = (
            db.query(BuddyConnection)
            .filter(or_(BuddyConnection.requester_id == me_id, BuddyConnection.recipient_id == me_id))
            .all()
        )
        buddies, incoming, outgoing = [], [], []
        for c in conns:
            other_id = c.recipient_id if str(c.requester_id) == str(me_id) else c.requester_id
            other = db.query(User).filter(User.id == other_id).first()
            if not other:
                continue
            if c.status == "accepted":
                buddies.append(self._card(db, other, str(c.id)))
            elif str(c.recipient_id) == str(me_id):
                incoming.append({"connection_id": str(c.id),
                                 "name": other.full_name or other.email.split("@")[0],
                                 "user_id": str(other.id)})
            else:
                outgoing.append({"connection_id": str(c.id),
                                 "name": other.full_name or other.email.split("@")[0],
                                 "user_id": str(other.id)})
        buddies.sort(key=lambda b: (not b["online"], b["name"].lower()))
        return {"buddies": buddies, "incoming": incoming, "outgoing": outgoing}

    def _are_buddies(self, db: Session, a, b) -> bool:
        conn = self._between(db, a, b)
        return bool(conn and conn.status == "accepted")

    # ── sharing ─────────────────────────────────────────────────────────────--

    def share_item(self, db: Session, me_id, recipient_id: str, item_type: str,
                   item_ref: str, title: str = "") -> dict:
        if item_type not in ("note", "upload"):
            raise ValueError("Invalid item type.")
        if not self._are_buddies(db, me_id, recipient_id):
            raise ValueError("You can only share with your buddies.")
        db.add(SharedItem(owner_id=me_id, recipient_id=recipient_id,
                          item_type=item_type, item_ref=item_ref, title=title or item_ref))
        db.commit()
        return {"status": "shared"}

    def list_shared_with_me(self, db: Session, me_id) -> List[dict]:
        rows = (
            db.query(SharedItem)
            .filter(SharedItem.recipient_id == me_id)
            .order_by(SharedItem.created_at.desc())
            .limit(50)
            .all()
        )
        out = []
        for s in rows:
            owner = db.query(User).filter(User.id == s.owner_id).first()
            out.append({
                "id": str(s.id),
                "item_type": s.item_type,
                "item_ref": s.item_ref,
                "title": s.title,
                "from": (owner.full_name or owner.email.split("@")[0]) if owner else "a buddy",
                "created_at": s.created_at.isoformat() if s.created_at else None,
            })
        return out

    # ── messaging ────────────────────────────────────────────────────────────

    def send_message(self, db: Session, me_id, recipient_id: str, body: str) -> dict:
        body = (body or "").strip()
        if not body:
            raise ValueError("Message is empty.")
        if not self._are_buddies(db, me_id, recipient_id):
            raise ValueError("You can only message your buddies.")
        msg = BuddyMessage(sender_id=me_id, recipient_id=recipient_id, body=body[:2000])
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return self._msg(msg, me_id)

    def thread(self, db: Session, me_id, other_id: str, limit: int = 100) -> List[dict]:
        rows = (
            db.query(BuddyMessage)
            .filter(or_(
                and_(BuddyMessage.sender_id == me_id, BuddyMessage.recipient_id == other_id),
                and_(BuddyMessage.sender_id == other_id, BuddyMessage.recipient_id == me_id),
            ))
            .order_by(BuddyMessage.created_at.asc())
            .limit(limit)
            .all()
        )
        # Mark incoming as read.
        unread = [m for m in rows if str(m.recipient_id) == str(me_id) and not m.is_read]
        if unread:
            for m in unread:
                m.is_read = True
            db.commit()
        return [self._msg(m, me_id) for m in rows]

    def unread_count(self, db: Session, me_id) -> int:
        return (
            db.query(BuddyMessage)
            .filter(BuddyMessage.recipient_id == me_id, BuddyMessage.is_read.is_(False))
            .count()
        )

    def _msg(self, m: BuddyMessage, me_id) -> dict:
        return {
            "id": str(m.id),
            "body": m.body,
            "mine": str(m.sender_id) == str(me_id),
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }


buddy_service = BuddyService()
