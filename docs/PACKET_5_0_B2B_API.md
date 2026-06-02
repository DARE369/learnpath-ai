# PACKET 5.0: B2B & Institutional API Documentation

## Overview

PACKET 5.0 introduces a complete B2B SaaS platform for schools and educational institutions. The system enables:

- **Organization Management**: Multi-tenant school/institution accounts
- **Teacher & Class Management**: Hierarchical classroom structure
- **Subscription Tiers**: Three pricing tiers with feature gating
- **School Analytics**: Institutional-level performance tracking
- **Student Progress Monitoring**: At-risk student identification and intervention

---

## Architecture

### Multi-Tenant Structure

```
Organization (School)
├── Subscription (Tier: Starter, Pro, Enterprise)
├── Teachers
│   ├── Classes
│   │   ├── Class Memberships (Students)
│   │   └── Assignments
│   ├── Teacher Analytics (Daily)
│   └── Dashboard
└── School Analytics (Daily)
```

### Subscription Tiers

| Tier | Price | Students | Teachers | Classes | Features |
|------|-------|----------|----------|---------|----------|
| **Starter** | ₦50,000/month | 100 | 10 | 10 | Basic dashboard, student tracking |
| **Pro** | ₦150,000/month | 500 | 50 | 50 | Advanced analytics, API access |
| **Enterprise** | Custom | Unlimited | Unlimited | Unlimited | SSO, custom branding, dedicated support |

---

## API Endpoints

### Organizations

#### Create Organization (Trial)

```http
POST /api/organizations/create
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "St. Mary's Secondary School",
  "school_type": "secondary",
  "country": "Nigeria",
  "state": "Lagos",
  "admin_name": "Dr. John Smith",
  "admin_email": "admin@stmarys.edu.ng"
}
```

**Response:**
```json
{
  "id": "org-uuid",
  "name": "St. Mary's Secondary School",
  "status": "trial",
  "subscription_tier": "starter",
  "admin_id": "user-uuid",
  "trial_ends_at": "2026-07-02T00:00:00Z",
  "students_count": 0,
  "teachers_count": 0,
  "classes_count": 0
}
```

**Features Enabled:**
- Basic dashboard
- Student progress tracking
- Up to 100 students, 10 teachers, 10 classes
- 30-day free trial

---

#### Get Organization Details

```http
GET /api/organizations/{org_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "id": "org-uuid",
  "name": "St. Mary's Secondary School",
  "school_type": "secondary",
  "country": "Nigeria",
  "state": "Lagos",
  "status": "active",
  "students_count": 450,
  "teachers_count": 35,
  "classes_count": 18,
  "created_at": "2026-05-15T10:30:00Z"
}
```

---

#### Check Organization Usage

```http
GET /api/organizations/{org_id}/usage
Authorization: Bearer {token}
```

**Response:**
```json
{
  "tier": "pro",
  "limits": {
    "students": 500,
    "teachers": 50,
    "classes": 50
  },
  "current_usage": {
    "students": 450,
    "teachers": 35,
    "classes": 18
  },
  "at_capacity": false,
  "utilization_percentage": 90
}
```

---

#### Upgrade Organization Tier

```http
POST /api/organizations/{org_id}/upgrade
Authorization: Bearer {token}
Content-Type: application/json

{
  "new_tier": "pro"
}
```

**Response:**
```json
{
  "status": "upgraded",
  "previous_tier": "starter",
  "new_tier": "pro",
  "invoice_id": "inv-uuid",
  "amount_ngn": 150000,
  "billing_cycle": "monthly",
  "next_billing_date": "2026-07-02T00:00:00Z"
}
```

---

### Teachers

#### Create Teacher

```http
POST /api/teachers/{org_id}/teachers
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Mrs. Jane Okafor",
  "email": "jane.okafor@stmarys.edu.ng",
  "role": "teacher"
}
```

**Response:**
```json
{
  "id": "teacher-uuid",
  "name": "Mrs. Jane Okafor",
  "email": "jane.okafor@stmarys.edu.ng",
  "role": "teacher",
  "organization_id": "org-uuid"
}
```

---

#### Get Teacher Dashboard

```http
GET /api/teachers/dashboard
Authorization: Bearer {token}
```

**Response:**
```json
{
  "teacher": {
    "id": "teacher-uuid",
    "name": "Mrs. Jane Okafor",
    "email": "jane.okafor@stmarys.edu.ng",
    "classes_count": 3
  },
  "this_week": {
    "active_students": 85,
    "avg_score": 72,
    "total_study_time_hours": 240
  },
  "classes": [
    {
      "id": "class-uuid",
      "name": "SS2 Biology A",
      "subject": "Biology",
      "enrolled": 35,
      "max": 40
    }
  ]
}
```

---

#### Create Class

```http
POST /api/teachers/{teacher_id}/classes
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "SS2 Biology A",
  "subject": "Biology",
  "description": "Senior Secondary 2 Biology - Advanced topics",
  "max_students": 40
}
```

**Response:**
```json
{
  "id": "class-uuid",
  "name": "SS2 Biology A",
  "subject": "Biology",
  "max_students": 40,
  "enrolled": 0
}
```

---

#### Get Class Details

```http
GET /api/teachers/classes/{class_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "class": {
    "id": "class-uuid",
    "name": "SS2 Biology A",
    "subject": "Biology",
    "description": "Senior Secondary 2 Biology - Advanced topics"
  },
  "students": [
    {
      "id": "student-uuid",
      "progress": 65,
      "avg_score": 78,
      "last_active": "2026-06-02T14:30:00Z",
      "status": "active"
    }
  ],
  "summary": {
    "total": 35,
    "active": 28,
    "avg_progress": 61,
    "avg_score": 73
  }
}
```

---

#### Get At-Risk Students

```http
GET /api/teachers/{teacher_id}/at-risk
Authorization: Bearer {token}
```

**Response:**
```json
{
  "at_risk_count": 5,
  "at_risk_students": [
    {
      "student_id": "student-uuid",
      "reasons": [
        "Low scores (45%)",
        "Inactive 9 days",
        "Low progress (12%)"
      ],
      "recommended_action": "Assign focused review path"
    }
  ]
}
```

---

#### Assign Assignment to Class

```http
POST /api/teachers/classes/{class_id}/assign
Authorization: Bearer {token}
Content-Type: application/json

{
  "assignment_type": "quiz",
  "assignment_id": "quiz-uuid"
}
```

**Response:**
```json
{
  "status": "success",
  "students_assigned": 35,
  "assignment_type": "quiz"
}
```

---

### Schools (Admin Dashboard)

#### Get School Dashboard

```http
GET /api/schools/{org_id}/dashboard
Authorization: Bearer {token}
```

**Response:**
```json
{
  "organization": {
    "id": "org-uuid",
    "name": "St. Mary's Secondary School",
    "school_type": "secondary",
    "status": "active"
  },
  "metrics": {
    "total_students": 450,
    "active_this_week": 380,
    "teachers": 35,
    "classes": 18,
    "avg_student_progress": 65,
    "avg_student_score": 71
  },
  "subscription": {
    "tier": "pro",
    "status": "active"
  }
}
```

---

#### List Teachers

```http
GET /api/schools/{org_id}/teachers
Authorization: Bearer {token}
```

**Response:**
```json
{
  "organization_id": "org-uuid",
  "teachers": [
    {
      "id": "teacher-uuid",
      "name": "Mrs. Jane Okafor",
      "email": "jane.okafor@stmarys.edu.ng",
      "role": "teacher",
      "created_at": "2026-05-20T10:00:00Z"
    }
  ]
}
```

---

#### List Classes

```http
GET /api/schools/{org_id}/classes
Authorization: Bearer {token}
```

**Response:**
```json
{
  "organization_id": "org-uuid",
  "classes": [
    {
      "id": "class-uuid",
      "name": "SS2 Biology A",
      "subject": "Biology",
      "teacher_id": "teacher-uuid",
      "enrolled": 35,
      "max": 40
    }
  ]
}
```

---

#### List All Students

```http
GET /api/schools/{org_id}/students
Authorization: Bearer {token}
```

**Response:**
```json
{
  "organization_id": "org-uuid",
  "total_students": 450,
  "students": [
    {
      "student_id": "student-uuid",
      "class_id": "class-uuid",
      "progress": 75,
      "avg_score": 82,
      "status": "active",
      "last_active": "2026-06-02T14:30:00Z"
    }
  ]
}
```

---

#### Get School Analytics

```http
GET /api/schools/{org_id}/analytics
Authorization: Bearer {token}
```

**Response:**
```json
{
  "organization_id": "org-uuid",
  "analytics": [
    {
      "date": "2026-06-02T00:00:00Z",
      "active_students": 380,
      "total_study_minutes": 4200,
      "avg_score": 71,
      "classes_active": 16,
      "teachers_active": 28
    }
  ]
}
```

---

#### Get School Health Score

```http
GET /api/schools/{org_id}/health
Authorization: Bearer {token}
```

**Response:**
```json
{
  "organization_id": "org-uuid",
  "health_score": 78,
  "engagement_rate": 85,
  "retention_rate": 71,
  "status": "healthy",
  "recommendations": [
    "Continue current engagement strategy",
    "Maintain retention programs"
  ]
}
```

---

## Data Models

### Organization

```python
{
  "id": UUID,
  "admin_id": UUID,                    # User ID of admin
  "name": str,
  "school_type": str,                  # primary, secondary, tertiary
  "country": str,
  "state": str,
  "status": str,                       # trial, active, suspended, expired
  "subscription_tier": str,            # starter, pro, enterprise
  "students_count": int,
  "teachers_count": int,
  "classes_count": int,
  "created_at": datetime,
  "trial_ends_at": datetime,
}
```

### Teacher

```python
{
  "id": UUID,
  "organization_id": UUID,
  "name": str,
  "email": str,
  "role": str,                         # teacher, lead_teacher
  "created_at": datetime,
}
```

### Class

```python
{
  "id": UUID,
  "organization_id": UUID,
  "teacher_id": UUID,
  "name": str,
  "subject": str,
  "description": str,
  "max_students": int,
  "enrolled_students": int,
  "created_at": datetime,
}
```

### ClassMembership

```python
{
  "id": UUID,
  "class_id": UUID,
  "student_id": UUID,
  "progress_percent": int,             # 0-100
  "average_score": int,                # 0-100
  "last_active": datetime,
  "enrollment_status": str,            # active, inactive, dropped
}
```

---

## Feature Gating by Tier

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| Basic Dashboard | ✓ | ✓ | ✓ |
| Student Progress Tracking | ✓ | ✓ | ✓ |
| Class Management | ✓ | ✓ | ✓ |
| At-Risk Student Detection | ✓ | ✓ | ✓ |
| Daily Analytics | ✗ | ✓ | ✓ |
| Advanced Reporting | ✗ | ✓ | ✓ |
| API Access | ✗ | ✓ | ✓ |
| Custom Branding | ✗ | ✗ | ✓ |
| SSO (OAuth) | ✗ | ✗ | ✓ |
| Offline Mode | ✗ | ✗ | ✓ |
| Dedicated Support | ✗ | ✗ | ✓ |

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Invalid request",
  "detail": "Organization not found",
  "status_code": 404
}
```

### Common Status Codes

- **400**: Invalid request parameters or tier limit exceeded
- **401**: Missing or invalid authentication token
- **403**: Unauthorized access to organization
- **404**: Resource not found
- **500**: Internal server error

---

## Rate Limiting

- **Free/Trial**: 100 requests/minute
- **Pro**: 1000 requests/minute
- **Enterprise**: Custom limits

---

## Future Enhancements

- Custom assessment creation in teacher dashboard
- Real-time collaboration features
- Parent portal for student progress
- Mobile app for teachers
- Integration with external LMS platforms
- White-label school website builder
