"""Unit tests for ADMIN-2.3 class management service.

These tests exercise the SchoolAdminService class-management methods using a
mock SQLAlchemy session so they pass in CI without a real database.
"""

import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.school_admin_service import SchoolAdminService


# ── Helpers ────────────────────────────────────────────────────────────────

def _school_id() -> str:
    return str(uuid.uuid4())


def _class_id() -> str:
    return str(uuid.uuid4())


def _user_id() -> str:
    return str(uuid.uuid4())


def _make_class(school_id: str, teacher_id=None, name="Math 101",
                max_students=30, subject="Mathematics"):
    c = MagicMock()
    c.id = uuid.uuid4()
    c.organization_id = uuid.UUID(school_id)
    c.teacher_id = uuid.UUID(teacher_id) if teacher_id else None
    c.name = name
    c.subject = subject
    c.description = None
    c.max_students = max_students
    c.enrolled_students = 0
    c.created_at = datetime(2025, 1, 15)
    return c


def _make_meta(class_id, is_archived=False, grade_level=None):
    m = MagicMock()
    m.class_id = class_id
    m.is_archived = is_archived
    m.archived_at = None
    m.grade_level = grade_level
    return m


def _make_membership(class_id, student_id, score=75):
    m = MagicMock()
    m.class_id = class_id
    m.student_id = student_id
    m.enrollment_status = "active"
    m.average_score = score
    m.progress_percent = 0
    m.last_active = None
    return m


def _make_db(cls=None, meta=None, members=None, teacher=None):
    """Return a mock db session wired for common queries."""
    db = MagicMock()

    def query_side_effect(model):
        q = MagicMock()
        q.filter_by.return_value = q
        q.filter.return_value = q
        q.first.return_value = None
        q.all.return_value = []
        q.count.return_value = 0

        name = getattr(model, "__name__", "")

        if name == "Class" and cls is not None:
            q.filter_by.return_value.first.return_value = cls
            q.filter_by.return_value.all.return_value = [cls]

        if name == "ClassMetadata" and meta is not None:
            q.filter_by.return_value.first.return_value = meta

        if name == "ClassMembership" and members is not None:
            q.filter_by.return_value.all.return_value = members
            q.filter_by.return_value.count.return_value = len(members)
            q.filter.return_value.all.return_value = members

        if name == "Teacher" and teacher is not None:
            q.filter_by.return_value.first.return_value = teacher

        return q

    db.query.side_effect = query_side_effect
    db.add = MagicMock()
    db.flush = MagicMock()
    db.commit = MagicMock()
    db.delete = MagicMock()
    return db


# ── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture
def svc():
    return SchoolAdminService()


@pytest.fixture
def ids():
    return {
        "school": _school_id(),
        "user": _user_id(),
        "class": _class_id(),
    }


# ── Access control ─────────────────────────────────────────────────────────

class TestVerifyAccess:
    def test_grants_school_user_role(self, svc, ids):
        from models import SchoolUserRole
        db = MagicMock()
        role = MagicMock()
        db.query.return_value.filter_by.return_value.first.return_value = role
        svc._verify_access(db, ids["user"], ids["school"])  # no exception

    def test_raises_403_when_no_access(self, svc, ids):
        from fastapi import HTTPException
        db = MagicMock()
        db.query.return_value.filter_by.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            svc._verify_access(db, ids["user"], ids["school"])
        assert exc.value.status_code == 403


# ── list_classes ────────────────────────────────────────────────────────────

class TestListClasses:
    def test_returns_paginated_dict(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        meta = _make_meta(cls.id)
        db = _make_db(cls=cls, meta=meta)

        with patch.object(svc, "_verify_access"):
            result = svc.list_classes(db, ids["user"], school_id)

        assert "classes" in result
        assert "pagination" in result
        assert result["pagination"]["page"] == 1

    def test_filters_active_by_default(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        archived_meta = _make_meta(cls.id, is_archived=True)
        db = _make_db(cls=cls, meta=archived_meta)

        with patch.object(svc, "_verify_access"):
            result = svc.list_classes(db, ids["user"], school_id, status="active")

        # Archived class should be excluded
        assert all(r["status"] == "active" for r in result["classes"])

    def test_filters_archived(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        archived_meta = _make_meta(cls.id, is_archived=True)
        db = _make_db(cls=cls, meta=archived_meta)

        with patch.object(svc, "_verify_access"):
            result = svc.list_classes(db, ids["user"], school_id, status="archived")

        assert all(r["status"] == "archived" for r in result["classes"])

    def test_search_filters_by_name(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id, name="Physics 101")
        meta = _make_meta(cls.id)
        db = _make_db(cls=cls, meta=meta)

        with patch.object(svc, "_verify_access"):
            result = svc.list_classes(db, ids["user"], school_id, search="Physics")

        assert all("physics" in r["name"].lower() for r in result["classes"])

    def test_pagination_respects_page_size(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        meta = _make_meta(cls.id)
        db = _make_db(cls=cls, meta=meta)

        with patch.object(svc, "_verify_access"):
            result = svc.list_classes(db, ids["user"], school_id, page=1, page_size=1)

        assert len(result["classes"]) <= 1


# ── create_class ────────────────────────────────────────────────────────────

class TestCreateClass:
    def test_creates_class_and_metadata(self, svc, ids):
        school_id = ids["school"]
        db = _make_db()

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_log"):
            result = svc.create_class(db, ids["user"], school_id, {"name": "Chemistry 101"})

        assert result["status"] == "created"
        assert result["students_added"] == 0
        db.add.assert_called()
        db.commit.assert_called_once()

    def test_rejects_blank_name(self, svc, ids):
        from fastapi import HTTPException
        db = _make_db()

        with patch.object(svc, "_verify_access"), pytest.raises(HTTPException) as exc:
            svc.create_class(db, ids["user"], ids["school"], {"name": "  "})

        assert exc.value.status_code == 400

    def test_adds_initial_students(self, svc, ids):
        school_id = ids["school"]
        student_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
        db = _make_db()

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_log"):
            result = svc.create_class(db, ids["user"], school_id,
                                       {"name": "Art", "student_ids": student_ids})

        assert result["students_added"] == 2


# ── update_class ────────────────────────────────────────────────────────────

class TestUpdateClass:
    def test_updates_name(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id, name="Old Name")
        meta = _make_meta(cls.id)
        db = _make_db(cls=cls, meta=meta)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_ensure_class_metadata", return_value=meta), \
             patch.object(svc, "_log"):
            result = svc.update_class(db, ids["user"], school_id, str(cls.id),
                                       {"name": "New Name"})

        assert result["status"] == "updated"
        assert cls.name == "New Name"
        db.commit.assert_called_once()

    def test_no_changes_still_commits(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id, name="Stable Name")
        meta = _make_meta(cls.id)
        db = _make_db(cls=cls, meta=meta)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_ensure_class_metadata", return_value=meta), \
             patch.object(svc, "_log"):
            result = svc.update_class(db, ids["user"], school_id, str(cls.id), {})

        assert result["changes"] == 0

    def test_teacher_change_updates_meta(self, svc, ids):
        school_id = ids["school"]
        old_tid = uuid.uuid4()
        new_tid = uuid.uuid4()
        cls = _make_class(school_id, teacher_id=str(old_tid))
        meta = _make_meta(cls.id)
        db = _make_db(cls=cls, meta=meta)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_ensure_class_metadata", return_value=meta), \
             patch.object(svc, "_log"):
            result = svc.update_class(db, ids["user"], school_id, str(cls.id),
                                       {"teacher_id": str(new_tid)})

        assert result["changes"] == 1
        assert cls.teacher_id == new_tid


# ── duplicate_class ─────────────────────────────────────────────────────────

class TestDuplicateClass:
    def test_creates_copy_with_new_name(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        meta = _make_meta(cls.id)
        db = _make_db(cls=cls, meta=meta)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_log"):
            result = svc.duplicate_class(db, ids["user"], school_id, str(cls.id),
                                          {"new_name": "Math 101 Spring"})

        assert result["status"] == "duplicated"
        assert result["students_copied"] == 0
        assert result["assignments_copied"] == 0

    def test_copies_roster_when_requested(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        meta = _make_meta(cls.id)
        m1 = _make_membership(cls.id, uuid.uuid4())
        m2 = _make_membership(cls.id, uuid.uuid4())
        db = _make_db(cls=cls, meta=meta, members=[m1, m2])

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_log"):
            result = svc.duplicate_class(db, ids["user"], school_id, str(cls.id),
                                          {"copy_roster": True})

        assert result["students_copied"] == 2

    def test_no_roster_copy_by_default(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        meta = _make_meta(cls.id)
        db = _make_db(cls=cls, meta=meta)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_log"):
            result = svc.duplicate_class(db, ids["user"], school_id, str(cls.id), {})

        assert result["students_copied"] == 0


# ── merge_classes ────────────────────────────────────────────────────────────

class TestMergeClasses:
    def _make_merge_db(self, src, tgt, members):
        db = MagicMock()
        call_count = {"Class": 0}

        def query_side(model):
            q = MagicMock()
            q.filter_by.return_value = q
            q.filter.return_value = q
            q.first.return_value = None
            q.all.return_value = []
            q.count.return_value = 0

            name = getattr(model, "__name__", "")
            if name == "ClassMembership":
                def fb(**kwargs):
                    inner = MagicMock()
                    if kwargs.get("class_id") == src.id:
                        inner.all.return_value = members
                    else:
                        inner.all.return_value = []
                    inner.count.return_value = 0
                    return inner
                q.filter_by.side_effect = fb

            return q

        db.query.side_effect = query_side
        db.add = MagicMock()
        db.delete = MagicMock()
        db.commit = MagicMock()
        return db

    def test_moves_students_to_target(self, svc, ids):
        school_id = ids["school"]
        src = _make_class(school_id, name="Source")
        tgt = _make_class(school_id, name="Target")
        m1 = _make_membership(src.id, uuid.uuid4())
        m2 = _make_membership(src.id, uuid.uuid4())
        db = self._make_merge_db(src, tgt, [m1, m2])

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", side_effect=[src, tgt]), \
             patch.object(svc, "_ensure_class_metadata", return_value=_make_meta(src.id)), \
             patch.object(svc, "_log"):
            result = svc.merge_classes(db, ids["user"], school_id, str(src.id),
                                        {"target_class_id": str(tgt.id), "archive_source": False})

        assert result["status"] == "merged"
        assert result["students_moved"] == 2
        assert result["students_skipped"] == 0

    def test_archives_source_when_requested(self, svc, ids):
        school_id = ids["school"]
        src = _make_class(school_id, name="Old Class")
        tgt = _make_class(school_id, name="New Class")
        meta = _make_meta(src.id)
        db = self._make_merge_db(src, tgt, [])

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", side_effect=[src, tgt]), \
             patch.object(svc, "_ensure_class_metadata", return_value=meta), \
             patch.object(svc, "_log"):
            result = svc.merge_classes(db, ids["user"], school_id, str(src.id),
                                        {"target_class_id": str(tgt.id), "archive_source": True})

        assert result["source_archived"] is True
        assert meta.is_archived is True

    def test_skips_existing_students_by_default(self, svc, ids):
        school_id = ids["school"]
        src = _make_class(school_id, name="Source")
        tgt = _make_class(school_id, name="Target")
        shared_sid = uuid.uuid4()
        m = _make_membership(src.id, shared_sid)

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            name = getattr(model, "__name__", "")
            if name == "ClassMembership":
                def fb(**kwargs):
                    inner = MagicMock()
                    if kwargs.get("class_id") == src.id:
                        inner.all.return_value = [m]
                    else:
                        # Simulate student already in target
                        inner.all.return_value = [_make_membership(tgt.id, shared_sid)]
                    inner.count.return_value = 0
                    return inner
                q.filter_by.side_effect = fb
                # For existing-in-target check: find_one
                q.filter_by.return_value.first = MagicMock(return_value=_make_membership(tgt.id, shared_sid))
            else:
                q.filter_by.return_value = q
                q.filter_by.return_value.first.return_value = None
            q.filter.return_value = q
            q.filter.return_value.all.return_value = []
            q.count.return_value = 0
            return q

        db.query.side_effect = query_side
        db.add = MagicMock()
        db.delete = MagicMock()
        db.commit = MagicMock()

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", side_effect=[src, tgt]), \
             patch.object(svc, "_ensure_class_metadata", return_value=_make_meta(src.id)), \
             patch.object(svc, "_log"):
            result = svc.merge_classes(db, ids["user"], school_id, str(src.id),
                                        {"target_class_id": str(tgt.id),
                                         "conflict_resolution": "skip",
                                         "archive_source": False})

        assert result["students_skipped"] == 1
        assert result["students_moved"] == 0


# ── set_archived ─────────────────────────────────────────────────────────────

class TestSetArchived:
    def test_archives_class(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        meta = _make_meta(cls.id, is_archived=False)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_ensure_class_metadata", return_value=meta), \
             patch.object(svc, "_log"):
            result = svc.set_archived(MagicMock(), ids["user"], school_id, str(cls.id), True)

        assert result["status"] == "archived"
        assert meta.is_archived is True
        assert meta.archived_at is not None

    def test_restores_class(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        meta = _make_meta(cls.id, is_archived=True)
        meta.archived_at = datetime(2025, 3, 1)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_ensure_class_metadata", return_value=meta), \
             patch.object(svc, "_log"):
            result = svc.set_archived(MagicMock(), ids["user"], school_id, str(cls.id), False)

        assert result["status"] == "active"
        assert meta.is_archived is False
        assert meta.archived_at is None


# ── delete_class ─────────────────────────────────────────────────────────────

class TestDeleteClass:
    def test_deletes_class_and_memberships(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        db = _make_db(cls=cls)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_log"):
            result = svc.delete_class(db, ids["user"], school_id, str(cls.id))

        assert result["status"] == "deleted"
        db.delete.assert_called_with(cls)
        db.commit.assert_called_once()


# ── add_to_roster ─────────────────────────────────────────────────────────────

class TestAddToRoster:
    def test_adds_new_students(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        new_sids = [str(uuid.uuid4()), str(uuid.uuid4())]
        db = _make_db(cls=cls)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_log"):
            result = svc.add_to_roster(db, ids["user"], school_id, str(cls.id), new_sids)

        assert result["status"] == "ok"
        assert result["added"] == 2
        assert result["skipped"] == 0

    def test_skips_invalid_uuids(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        db = _make_db(cls=cls)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_log"):
            result = svc.add_to_roster(db, ids["user"], school_id, str(cls.id),
                                        ["not-a-uuid", str(uuid.uuid4())])

        assert result["added"] == 1

    def test_skips_already_active_members(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        existing_sid = uuid.uuid4()
        existing_m = _make_membership(cls.id, existing_sid)

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            name = getattr(model, "__name__", "")
            if name == "ClassMembership":
                def fb(**kwargs):
                    inner = MagicMock()
                    if kwargs.get("student_id") == existing_sid:
                        inner.first.return_value = existing_m
                    else:
                        inner.first.return_value = None
                    inner.count.return_value = 1
                    return inner
                q.filter_by.side_effect = fb
            else:
                q.filter_by.return_value = q
                q.filter_by.return_value.first.return_value = cls if name == "Class" else None
            q.filter.return_value = q
            return q

        db.query.side_effect = query_side
        db.add = MagicMock()
        db.commit = MagicMock()

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_log"):
            result = svc.add_to_roster(db, ids["user"], school_id, str(cls.id),
                                        [str(existing_sid)])

        assert result["skipped"] == 1
        assert result["added"] == 0


# ── remove_from_roster ────────────────────────────────────────────────────────

class TestRemoveFromRoster:
    def test_removes_students(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        sid = str(uuid.uuid4())

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            name = getattr(model, "__name__", "")
            q.filter_by.return_value = q
            q.filter_by.return_value.delete.return_value = 1
            q.filter_by.return_value.count.return_value = 0
            q.filter.return_value = q
            return q

        db.query.side_effect = query_side
        db.commit = MagicMock()

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_log"):
            result = svc.remove_from_roster(db, ids["user"], school_id, str(cls.id), [sid])

        assert result["status"] == "ok"
        assert result["removed"] == 1

    def test_skips_invalid_uuids_on_remove(self, svc, ids):
        school_id = ids["school"]
        cls = _make_class(school_id)
        db = _make_db(cls=cls)

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_require_class", return_value=cls), \
             patch.object(svc, "_log"):
            result = svc.remove_from_roster(db, ids["user"], school_id, str(cls.id),
                                             ["bad-uuid"])

        assert result["removed"] == 0


# ── Router request models ─────────────────────────────────────────────────────

class TestRequestModels:
    def test_create_class_requires_name(self):
        from routers.school_admin import CreateClassRequest
        import pytest
        with pytest.raises(Exception):
            CreateClassRequest()  # name is required

    def test_create_class_defaults(self):
        from routers.school_admin import CreateClassRequest
        req = CreateClassRequest(name="Bio 101")
        assert req.max_students == 30
        assert req.student_ids == []
        assert req.teacher_id is None

    def test_merge_requires_target(self):
        from routers.school_admin import MergeClassRequest
        import pytest
        with pytest.raises(Exception):
            MergeClassRequest()  # target_class_id required

    def test_merge_defaults(self):
        from routers.school_admin import MergeClassRequest
        req = MergeClassRequest(target_class_id=str(uuid.uuid4()))
        assert req.conflict_resolution == "skip"
        assert req.archive_source is True

    def test_roster_update_model(self):
        from routers.school_admin import RosterUpdateRequest
        sids = [str(uuid.uuid4())]
        req = RosterUpdateRequest(student_ids=sids)
        assert req.student_ids == sids

    def test_duplicate_defaults(self):
        from routers.school_admin import DuplicateClassRequest
        req = DuplicateClassRequest()
        assert req.copy_roster is False
        assert req.copy_assignments is False
