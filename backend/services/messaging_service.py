"""Messaging service for ADMIN-1.5: teacher 1-on-1, group, and announcement flows."""

import logging
import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import (
    Announcement,
    AnnouncementRead,
    ClassMembership,
    Conversation,
    Message,
    MessageReadReceipt,
    NotificationPreference,
    Teacher,
    TypingIndicator,
    User,
)

logger = logging.getLogger(__name__)


class MessagingService:
    """Teacher messaging: 1-on-1 threads, group threads, class announcements."""

    # ── Inbox ──────────────────────────────────────────────────────────────────

    def get_inbox(
        self,
        db: Session,
        teacher_user_id: str,
        search_query: Optional[str],
        filter_type: Optional[str],
        date_from: Optional[str],
        date_to: Optional[str],
        page: int,
        page_size: int,
    ) -> Dict:
        skip = (page - 1) * page_size

        q = db.query(Conversation).filter(
            Conversation.teacher_id == teacher_user_id
        )

        if search_query:
            q = q.filter(
                Conversation.conversation_name.ilike(f"%{search_query}%")
            )

        if filter_type and filter_type not in ("all", "announcements"):
            q = q.filter(Conversation.conversation_type == filter_type)

        if date_from:
            q = q.filter(Conversation.updated_at >= datetime.fromisoformat(date_from))
        if date_to:
            q = q.filter(Conversation.updated_at <= datetime.fromisoformat(date_to))

        total_convs = q.count()
        convs = q.order_by(Conversation.updated_at.desc()).offset(skip).limit(page_size).all()

        formatted_convs = []
        if filter_type != "announcements":
            for conv in convs:
                last_msg = (
                    db.query(Message)
                    .filter(Message.conversation_id == conv.id)
                    .order_by(Message.created_at.desc())
                    .first()
                )
                unread = (
                    db.query(MessageReadReceipt)
                    .filter(
                        MessageReadReceipt.message_id == (last_msg.id if last_msg else None),
                        MessageReadReceipt.is_read.is_(False),
                    )
                    .count()
                    if last_msg
                    else 0
                )
                formatted_convs.append({
                    "conversation_id": str(conv.id),
                    "name": conv.conversation_name,
                    "type": conv.conversation_type,
                    "participant_count": len(conv.participant_ids or []),
                    "last_message": (last_msg.content[:50] if last_msg else ""),
                    "last_message_time": last_msg.created_at.isoformat() if last_msg else None,
                    "unread_count": unread,
                })

        # Announcements section
        formatted_anns = []
        if not filter_type or filter_type in ("all", "announcements"):
            ann_q = db.query(Announcement).filter(
                Announcement.teacher_id == teacher_user_id,
                Announcement.status == "sent",
            )
            if search_query:
                ann_q = ann_q.filter(Announcement.title.ilike(f"%{search_query}%"))

            anns = ann_q.order_by(Announcement.sent_at.desc()).offset(skip).limit(page_size).all()
            for ann in anns:
                read_count = (
                    db.query(AnnouncementRead)
                    .filter(AnnouncementRead.announcement_id == ann.id, AnnouncementRead.is_read.is_(True))
                    .count()
                )
                total_rec = (
                    db.query(AnnouncementRead)
                    .filter(AnnouncementRead.announcement_id == ann.id)
                    .count()
                )
                formatted_anns.append({
                    "announcement_id": str(ann.id),
                    "title": ann.title,
                    "sent_at": ann.sent_at.isoformat() if ann.sent_at else None,
                    "read_count": read_count,
                    "total_recipients": total_rec,
                })

        return {
            "conversations": formatted_convs,
            "announcements": formatted_anns,
            "pagination": {"page": page, "page_size": page_size, "total": total_convs},
        }

    # ── Thread ─────────────────────────────────────────────────────────────────

    def get_thread(
        self,
        db: Session,
        user_id: str,
        conversation_id: str,
        page: int,
        page_size: int,
    ) -> Dict:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv or str(user_id) not in (conv.participant_ids or []):
            raise HTTPException(status_code=403, detail="Not a participant")

        skip = (page - 1) * page_size
        total = db.query(Message).filter(Message.conversation_id == conversation_id).count()
        msgs = (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
            .offset(skip)
            .limit(page_size)
            .all()
        )

        formatted = []
        for msg in msgs:
            sender = db.query(User).filter(User.id == msg.sender_id).first()
            receipts = (
                db.query(MessageReadReceipt)
                .filter(MessageReadReceipt.message_id == msg.id, MessageReadReceipt.is_read.is_(True))
                .all()
            )
            read_by = [str(r.user_id) for r in receipts]

            # Mark read by viewer
            existing = db.query(MessageReadReceipt).filter(
                MessageReadReceipt.message_id == msg.id,
                MessageReadReceipt.user_id == user_id,
            ).first()
            if existing and not existing.is_read:
                existing.is_read = True
                existing.read_at = datetime.utcnow()
            elif not existing and str(msg.sender_id) != str(user_id):
                db.add(MessageReadReceipt(
                    id=uuid.uuid4(),
                    message_id=msg.id,
                    user_id=user_id,
                    is_read=True,
                    read_at=datetime.utcnow(),
                ))

            formatted.append({
                "message_id": str(msg.id),
                "sender_id": str(msg.sender_id),
                "sender_name": sender.full_name if sender else "Unknown",
                "sender_role": msg.sender_role,
                "content": msg.content,
                "links": msg.links or [],
                "created_at": msg.created_at.isoformat(),
                "read_by": read_by,
                "display_time": self._format_time(msg.created_at),
            })

        db.commit()

        # Active typing indicators
        now = datetime.utcnow()
        typing_rows = (
            db.query(TypingIndicator)
            .filter(
                TypingIndicator.conversation_id == conversation_id,
                TypingIndicator.expires_at > now,
                TypingIndicator.user_id != user_id,
            )
            .all()
        )
        typing_names = []
        for t in typing_rows:
            u = db.query(User).filter(User.id == t.user_id).first()
            if u:
                typing_names.append(u.full_name or u.email)

        return {
            "conversation_id": str(conv.id),
            "conversation_name": conv.conversation_name,
            "conversation_type": conv.conversation_type,
            "messages": formatted,
            "typing_users": typing_names,
            "pagination": {"page": page, "page_size": page_size, "total": total},
        }

    # ── Send message ───────────────────────────────────────────────────────────

    def send_message(
        self,
        db: Session,
        sender_id: str,
        conversation_id: str,
        content: str,
        links: Optional[List[Dict]],
    ) -> Dict:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv or str(sender_id) not in (conv.participant_ids or []):
            raise HTTPException(status_code=403, detail="Not a participant")

        if not links:
            links = self._extract_urls(content)

        sender = db.query(User).filter(User.id == sender_id).first()

        msg = Message(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            sender_id=sender_id,
            sender_role=sender.role if sender else "user",
            content=content,
            links=links,
        )
        db.add(msg)

        for pid in (conv.participant_ids or []):
            if pid != str(sender_id):
                db.add(MessageReadReceipt(
                    id=uuid.uuid4(),
                    message_id=msg.id,
                    user_id=pid,
                    is_read=False,
                ))

        conv.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(msg)

        return {"message_id": str(msg.id), "status": "sent", "created_at": msg.created_at.isoformat()}

    # ── Create direct conversation ─────────────────────────────────────────────

    def create_direct_conversation(
        self, db: Session, teacher_user_id: str, student_id: str
    ) -> Dict:
        existing = (
            db.query(Conversation)
            .filter(
                Conversation.teacher_id == teacher_user_id,
                Conversation.conversation_type == "direct",
            )
            .all()
        )
        for c in existing:
            if student_id in (c.participant_ids or []):
                return {"conversation_id": str(c.id), "created": False}

        student = db.query(User).filter(User.id == student_id).first()
        name = student.full_name if student else student_id

        conv = Conversation(
            id=uuid.uuid4(),
            teacher_id=teacher_user_id,
            conversation_type="direct",
            conversation_name=name,
            participant_ids=[str(teacher_user_id), str(student_id)],
            retention_days=90,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return {"conversation_id": str(conv.id), "created": True}

    # ── Create group conversation ──────────────────────────────────────────────

    def create_group_conversation(
        self,
        db: Session,
        teacher_user_id: str,
        class_id: str,
        group_type: str,
        group_criteria: Dict,
        custom_student_ids: Optional[List[str]],
    ) -> Dict:
        if group_type == "custom" and custom_student_ids:
            recipient_ids = custom_student_ids
        elif group_type in ("at_risk", "advanced"):
            memberships = (
                db.query(ClassMembership)
                .filter(ClassMembership.class_id == class_id)
                .all()
            )
            if group_type == "at_risk":
                recipient_ids = [
                    str(m.student_id)
                    for m in memberships
                    if (m.average_score or 0) < 60
                ]
            else:
                recipient_ids = [
                    str(m.student_id)
                    for m in memberships
                    if (m.average_score or 0) >= 85
                ]
        else:
            recipient_ids = custom_student_ids or []

        label_map = {
            "at_risk": f"At-risk Students ({len(recipient_ids)})",
            "advanced": f"Advanced Students ({len(recipient_ids)})",
            "custom": f"Group ({len(recipient_ids)})",
        }
        group_name = label_map.get(group_type, f"Group ({len(recipient_ids)})")

        conv = Conversation(
            id=uuid.uuid4(),
            teacher_id=teacher_user_id,
            conversation_type="group",
            conversation_name=group_name,
            participant_ids=[str(teacher_user_id)] + recipient_ids,
            group_type=group_type,
            group_criteria=group_criteria,
            retention_days=60,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return {
            "conversation_id": str(conv.id),
            "group_name": group_name,
            "recipients": len(recipient_ids),
            "created": True,
        }

    # ── Announcements ──────────────────────────────────────────────────────────

    def send_announcement(
        self,
        db: Session,
        teacher_user_id: str,
        class_id: str,
        title: str,
        content: str,
        links: Optional[List[Dict]],
        scheduled_for: Optional[str],
    ) -> Dict:
        memberships = (
            db.query(ClassMembership)
            .filter(ClassMembership.class_id == class_id)
            .all()
        )
        student_ids = [str(m.student_id) for m in memberships]

        if not links:
            links = self._extract_urls(content)

        now = datetime.utcnow()
        sched = datetime.fromisoformat(scheduled_for) if scheduled_for else None

        ann = Announcement(
            id=uuid.uuid4(),
            teacher_id=teacher_user_id,
            class_id=class_id,
            title=title,
            content=content,
            links=links,
            scheduled_for=sched,
            sent_at=None if sched else now,
            status="scheduled" if sched else "sent",
        )
        db.add(ann)
        db.flush()

        for sid in student_ids:
            db.add(AnnouncementRead(
                id=uuid.uuid4(),
                announcement_id=ann.id,
                student_id=sid,
                is_read=False,
                acknowledged=False,
            ))

        db.commit()
        db.refresh(ann)
        return {
            "announcement_id": str(ann.id),
            "status": ann.status,
            "recipients": len(student_ids),
        }

    def get_announcements(
        self,
        db: Session,
        user_id: str,
        is_teacher: bool,
        page: int,
        page_size: int,
    ) -> Dict:
        skip = (page - 1) * page_size

        if is_teacher:
            q = db.query(Announcement).filter(Announcement.teacher_id == user_id)
        else:
            class_ids = [
                str(m.class_id)
                for m in db.query(ClassMembership).filter(ClassMembership.student_id == user_id).all()
            ]
            q = db.query(Announcement).filter(
                Announcement.class_id.in_(class_ids),
                Announcement.status == "sent",
            )

        total = q.count()
        anns = q.order_by(Announcement.sent_at.desc()).offset(skip).limit(page_size).all()

        formatted = []
        for ann in anns:
            if is_teacher:
                read_count = (
                    db.query(AnnouncementRead)
                    .filter(AnnouncementRead.announcement_id == ann.id, AnnouncementRead.is_read.is_(True))
                    .count()
                )
                total_rec = (
                    db.query(AnnouncementRead)
                    .filter(AnnouncementRead.announcement_id == ann.id)
                    .count()
                )
                formatted.append({
                    "announcement_id": str(ann.id),
                    "title": ann.title,
                    "content": ann.content[:150],
                    "sent_at": ann.sent_at.isoformat() if ann.sent_at else None,
                    "status": ann.status,
                    "read_count": read_count,
                    "total_recipients": total_rec,
                })
            else:
                row = db.query(AnnouncementRead).filter(
                    AnnouncementRead.announcement_id == ann.id,
                    AnnouncementRead.student_id == user_id,
                ).first()
                formatted.append({
                    "announcement_id": str(ann.id),
                    "title": ann.title,
                    "content": ann.content,
                    "links": ann.links or [],
                    "sent_at": ann.sent_at.isoformat() if ann.sent_at else None,
                    "is_read": row.is_read if row else False,
                    "acknowledged": row.acknowledged if row else False,
                })

        return {"announcements": formatted, "pagination": {"page": page, "page_size": page_size, "total": total}}

    def mark_announcement_read(self, db: Session, announcement_id: str, student_id: str) -> Dict:
        row = db.query(AnnouncementRead).filter(
            AnnouncementRead.announcement_id == announcement_id,
            AnnouncementRead.student_id == student_id,
        ).first()
        if row and not row.is_read:
            row.is_read = True
            row.read_at = datetime.utcnow()
            db.commit()
        return {"status": "ok"}

    def acknowledge_announcement(self, db: Session, announcement_id: str, student_id: str) -> Dict:
        row = db.query(AnnouncementRead).filter(
            AnnouncementRead.announcement_id == announcement_id,
            AnnouncementRead.student_id == student_id,
        ).first()
        if row:
            row.is_read = True
            row.read_at = row.read_at or datetime.utcnow()
            row.acknowledged = True
            row.acknowledged_at = datetime.utcnow()
            db.commit()
        return {"status": "acknowledged"}

    # ── Typing indicator ───────────────────────────────────────────────────────

    def update_typing(
        self, db: Session, user_id: str, conversation_id: str, is_typing: bool
    ) -> Dict:
        row = db.query(TypingIndicator).filter(
            TypingIndicator.conversation_id == conversation_id,
            TypingIndicator.user_id == user_id,
        ).first()

        if is_typing:
            expires = datetime.utcnow() + timedelta(seconds=5)
            if row:
                row.expires_at = expires
                row.is_typing = True
            else:
                db.add(TypingIndicator(
                    id=uuid.uuid4(),
                    conversation_id=conversation_id,
                    user_id=user_id,
                    is_typing=True,
                    expires_at=expires,
                ))
        else:
            if row:
                db.delete(row)

        db.commit()
        return {"status": "updated"}

    # ── Notification preferences ───────────────────────────────────────────────

    def get_preferences(self, db: Session, user_id: str) -> Dict:
        row = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
        if not row:
            return self._default_prefs(user_id)
        return self._pref_to_dict(row)

    def set_preferences(self, db: Session, user_id: str, prefs: Dict) -> Dict:
        row = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
        allowed = {
            "email_enabled", "email_direct_messages", "email_group_messages",
            "email_announcements", "email_replies", "email_frequency",
            "in_app_enabled", "in_app_direct_messages", "in_app_group_messages",
            "in_app_announcements", "in_app_replies",
        }
        if not row:
            row = NotificationPreference(id=uuid.uuid4(), user_id=user_id)
            db.add(row)
        for k, v in prefs.items():
            if k in allowed:
                setattr(row, k, v)
        row.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(row)
        return self._pref_to_dict(row)

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _extract_urls(self, text: str) -> List[Dict]:
        urls = re.findall(r"https?://\S+", text)
        return [{"url": u, "title": u[:60]} for u in urls]

    def _format_time(self, dt: datetime) -> str:
        now = datetime.utcnow()
        if dt.date() == now.date():
            return dt.strftime("%-I:%M %p") if hasattr(dt, "strftime") else dt.isoformat()
        if (now - dt).days == 1:
            return "Yesterday"
        if (now - dt).days < 7:
            return dt.strftime("%a")
        return dt.strftime("%b %d")

    def _default_prefs(self, user_id: str) -> Dict:
        return {
            "user_id": str(user_id),
            "email_enabled": True,
            "email_direct_messages": True,
            "email_group_messages": True,
            "email_announcements": True,
            "email_replies": True,
            "email_frequency": "immediate",
            "in_app_enabled": True,
            "in_app_direct_messages": True,
            "in_app_group_messages": True,
            "in_app_announcements": True,
            "in_app_replies": True,
        }

    def _pref_to_dict(self, row: NotificationPreference) -> Dict:
        return {
            "user_id": str(row.user_id),
            "email_enabled": row.email_enabled,
            "email_direct_messages": row.email_direct_messages,
            "email_group_messages": row.email_group_messages,
            "email_announcements": row.email_announcements,
            "email_replies": row.email_replies,
            "email_frequency": row.email_frequency,
            "in_app_enabled": row.in_app_enabled,
            "in_app_direct_messages": row.in_app_direct_messages,
            "in_app_group_messages": row.in_app_group_messages,
            "in_app_announcements": row.in_app_announcements,
            "in_app_replies": row.in_app_replies,
        }


messaging_service = MessagingService()
