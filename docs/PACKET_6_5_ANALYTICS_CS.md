# Analytics & Customer Success Service (Packet 6.5)

## Overview

Automated account health engine identifying at-risk organizations and triggering retention interventions. Includes health scoring, churn detection, transactional email notifications, and analytics aggregation.

---

## Health Scoring Algorithm

Composite 0-100 score based on:

| Factor | Weight | Formula |
|--------|--------|---------|
| Engagement Rate | 30% | (active_students_7d / total_students) × 100 |
| Progress Rate | 30% | (quizzes_completed_30d / expected_quizzes) × 100 |
| Login Frequency | 20% | (active_days_30d / 22 working days) × 100 |
| Invoice Status | 10% | 100 if current, 50 if failed, 0 if overdue |
| Trial Conversion | 10% | 0-100 based on trial age and usage depth |

**Status Classification:**
- **Healthy** (≥70): Engaged, good payment status
- **At-Risk** (40-69): Declining engagement or payment issues
- **Churning** (<40): Inactive or multiple risk triggers

---

## Churn Detection Triggers

Organization is flagged as `churning` if 2+ triggers occur:

```
1. Inactive >14 days on paid plan
2. Invoice overdue
3. Student engagement <30%
4. Trial expiring in 7 days with low conversion
```

---

## Notification Service

Send transactional emails via Resend or SendGrid.

### Setup

```bash
# Install provider SDK
pip install resend  # or sendgrid

# Set environment variable
export RESEND_API_KEY="re_xxx"
# or
export SENDGRID_API_KEY="SG.xxx"
```

### Available Templates

**Trial Emails:**
- `send_trial_welcome()` - Day 1 welcome
- `send_trial_7_days_left()` - Day 23 reminder
- `send_trial_upgrade_now()` - Day 28 upgrade prompt

**Invoice Emails:**
- `send_invoice_reminder()` - 7 days before due
- `send_invoice_overdue()` - Overdue notification

**Alert Emails:**
- `send_at_risk_student_alert()` - Weekly digest to teachers
- `send_cs_alert()` - Health alert to org admin

### Usage

```python
from services.notification_service import NotificationService

# Send trial welcome
NotificationService.send_trial_welcome(
    email="admin@school.edu",
    org_name="Lincoln High School"
)

# Send invoice overdue
NotificationService.send_invoice_overdue(
    email="admin@school.edu",
    org_name="Lincoln High School",
    amount=499.00,
    days_overdue=5
)
```

---

## Customer Success API Endpoints

### Get All Organizations Health

```
GET /api/admin/customer-success/orgs/health
Authorization: Bearer <admin_token>
```

Returns:
```json
{
  "total_organizations": 42,
  "healthy": 28,
  "at_risk": 10,
  "churning": 4,
  "total_mrr": 42000,
  "organizations": [
    {
      "organization_id": "org_123",
      "organization_name": "Lincoln High School",
      "health_score": 65,
      "status": "at_risk",
      "engagement_rate": 35,
      "is_churning": true,
      "churn_triggers": ["low_engagement", "inactive_14_days"],
      "mrr": 499
    }
  ]
}
```

### Get Organization Health

```
GET /api/admin/customer-success/orgs/{org_id}/health
Authorization: Bearer <user_token>
```

Available to org admins and platform admins.

### Send Outreach

```
POST /api/admin/customer-success/orgs/{org_id}/send-outreach
Authorization: Bearer <admin_token>

Body:
{
  "reason": "low_engagement"
}
```

Flags organization for CS team follow-up.

### Send Email Notifications

```
POST /api/admin/customer-success/notify/trial-welcome
POST /api/admin/customer-success/notify/trial-7-days
POST /api/admin/customer-success/notify/invoice-overdue
POST /api/admin/customer-success/notify/at-risk-students
```

---

## Nightly Analytics Aggregation

Job runs daily (configured in APScheduler) to:
1. Count active students per org (last 7 days)
2. Calculate average quiz scores
3. Calculate completion rates
4. Write to `school_analytics` table
5. Identify at-risk students

```python
# In jobs/nightly_analytics.py
@scheduler.scheduled_job('cron', hour=2, minute=0)
def aggregate_school_analytics():
    """Run nightly analytics aggregation."""
    from services.analytics_service import AnalyticsService
    AnalyticsService.aggregate_daily_metrics()
```

---

## Implementation Checklist

- [x] CustomerSuccessService with health scoring
- [x] Churn detection algorithm
- [x] NotificationService with template system
- [x] Email provider integration (Resend/SendGrid)
- [x] Customer success API endpoints
- [ ] Nightly analytics aggregation job
- [ ] Admin dashboard frontend
- [ ] Automated CS workflows (onboarding, retention)
- [ ] Slack integration for CS team alerts
- [ ] SMS notifications for urgent alerts (optional)

---

## Example Workflows

### Trial-to-Paid Conversion

```
Day 1:  send_trial_welcome()
Day 23: send_trial_7_days_left()
Day 28: send_trial_upgrade_now()
        → If no upgrade, send CS alert
```

### Invoice Recovery

```
Day 1:  send_invoice_reminder() (7 days before due)
Day 7:  send_invoice_overdue() (if still unpaid)
Day 14: Send 2nd overdue notice
Day 21: Flag for manual CS outreach
```

### At-Risk Student Alert

```
Weekly (Monday 9am):
  For each class:
    Find students with <30% completion
    send_at_risk_student_alert(teacher_email, student_names)
```

---

## Metrics to Monitor

| Metric | Target | Alert |
|--------|--------|-------|
| Trial-to-Paid Conversion Rate | 30%+ | <20% |
| Payment Success Rate | 98%+ | <95% |
| Customer Churn Rate (MoM) | <5% | >10% |
| Avg Org Health Score | 75+ | <60 |
| Active Orgs (MoM) | +10% | -5% |

---

