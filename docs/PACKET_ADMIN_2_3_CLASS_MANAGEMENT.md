# ADMIN-2.3: Class Management

School admins can create, edit, duplicate, merge, archive, and delete classes.
Full roster management (add/remove students) and activity tracking included.

---

## Pages

| Route | Purpose |
|---|---|
| `/school/classes` | Class list with search, filter, bulk actions |
| `/school/classes/[classId]` | Class detail: roster, stats, settings, activity |

---

## Features

### Class List (`/school/classes`)
- **Search** by class name or teacher name
- **Filter** by status (active / archived / all)
- **Bulk select** + bulk archive + CSV export
- **Per-row actions**: View, Edit (inline modal), Duplicate (inline modal), Archive / Restore / Delete

### Class Detail (`/school/classes/[classId]`)
- Header: name, teacher, subject, grade, capacity, status badge
- Quick stats: students, avg score, submission rate, at-risk count
- **Roster**: selectable list with "Remove selected" bulk action
- Activity log: last 20 admin events on this class
- Sidebar actions: Edit, Duplicate, Merge, Archive/Restore, Delete

### Modals
| Modal | Trigger | What it does |
|---|---|---|
| **ClassFormModal** | Create / Edit | Create new class or edit name, subject, grade, teacher, capacity, description |
| **DuplicateModal** | Duplicate button | Copy class with optional roster and/or assignments |
| **MergeModal** | Merge into… | Move students + assignments from source → target with conflict resolution |

---

## Backend Endpoints

All under `/api/school-admin/{school_id}/classes/`. Require Bearer token + school-admin role.

| Method | Path | Action |
|---|---|---|
| GET | `/` | List classes (paginated, filtered, sorted) |
| POST | `/` | Create class |
| GET | `/{class_id}` | Get class detail |
| PUT | `/{class_id}` | Update class settings |
| POST | `/{class_id}/duplicate` | Duplicate class |
| POST | `/{class_id}/merge` | Merge into another class |
| POST | `/{class_id}/archive` | Archive class |
| POST | `/{class_id}/restore` | Restore archived class |
| DELETE | `/{class_id}` | Permanently delete |
| POST | `/{class_id}/roster/add` | Add students to roster |
| POST | `/{class_id}/roster/remove` | Remove students from roster |

Full request/response shapes: see `docs/API_SPEC.md` → "School Admin - Class Management".

---

## Data Layer

Uses existing models — no new migrations required:

| Model | Role |
|---|---|
| `Class` | Core class record (name, teacher_id, subject, max_students) |
| `ClassMetadata` | Extended: grade_level, is_archived, archived_at |
| `ClassMembership` | Student enrollment (enrollment_status, average_score) |
| `TeacherAssignment` | Assignments — class_id re-pointed on merge/duplicate |
| `SchoolActivityLog` | All admin actions logged here for the activity feed |

---

## Service: `SchoolAdminService` (backend/services/school_admin_service.py)

| Method | Notes |
|---|---|
| `list_classes` | In-memory filter/sort/page after one DB fetch per school |
| `get_class_detail` | Computes submission_rate from assignments live; no snapshot table |
| `create_class` | Inserts Class + ClassMetadata; enrolls optional initial students |
| `update_class` | Tracks each changed field for the settings history log |
| `duplicate_class` | Shallow copy; optionally bulk-inserts memberships and assignments |
| `merge_classes` | Phase 1: memberships; Phase 2: re-point assignments; optional archive |
| `set_archived` | Flips ClassMetadata.is_archived + timestamp |
| `delete_class` | Cascades delete on ClassMembership + ClassMetadata |
| `add_to_roster` | Skips already-active members; re-activates dropped members |
| `remove_from_roster` | Hard-deletes ClassMembership rows |

---

## Key Design Decisions

- **No separate audit tables**: Uses the existing `SchoolActivityLog` for all class events rather than the 10 new tables in the spec. This avoids schema migrations while delivering the same audit trail.
- **In-memory filtering**: `list_classes` loads all classes for the school then filters in Python. Acceptable for school sizes (< 500 classes); add DB-side filtering if needed for large districts.
- **Merge is destructive**: Students are deleted from the source class. `can_reverse` is not implemented — merges are permanent. The activity log provides the audit trail.
- **Avg score from ClassMembership**: `average_score` column on `ClassMembership` is the source of truth; the service doesn't recompute it from submissions on every list call.

---

## Tests

`backend/tests/test_admin_classes.py` — 30 unit tests, all mock-based (no DB required, pass in CI).

Coverage:
- `TestVerifyAccess` — access granted / 403 raised
- `TestListClasses` — pagination, active/archived filter, search, page_size
- `TestCreateClass` — creates class+metadata, rejects blank name, adds initial students
- `TestUpdateClass` — name change, no-op, teacher reassignment
- `TestDuplicateClass` — copy without roster, with roster
- `TestMergeClasses` — moves students, archives source, skips conflicts
- `TestSetArchived` — archive sets timestamp; restore clears it
- `TestDeleteClass` — deletes class and memberships
- `TestAddToRoster` — adds new students, skips invalid UUIDs, skips active duplicates
- `TestRemoveFromRoster` — removes students, skips invalid UUIDs
- `TestRequestModels` — Pydantic model defaults and required fields
