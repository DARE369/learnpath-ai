"""Transactional email notification service (Packet 6.5)"""

import os
import logging
from datetime import datetime
from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Email provider initialization
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")

# Determine which provider to use
EMAIL_PROVIDER = "resend" if RESEND_API_KEY else ("sendgrid" if SENDGRID_API_KEY else "none")

if EMAIL_PROVIDER == "resend":
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        logger.info("Resend email provider initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize Resend: {e}")
        EMAIL_PROVIDER = "none"

elif EMAIL_PROVIDER == "sendgrid":
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        logger.info("SendGrid email provider initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize SendGrid: {e}")
        EMAIL_PROVIDER = "none"


@dataclass
class EmailTemplate:
    """Email template definition"""

    subject: str
    text: str
    html: str


class NotificationService:
    """Send transactional emails via Resend or SendGrid."""

    # Email sender address
    FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@learnpath.ai")
    FROM_NAME = "LearnPath"

    @staticmethod
    def send_email(
        to: str,
        subject: str,
        html: str,
        text: Optional[str] = None,
        template_id: Optional[str] = None,
    ) -> bool:
        """
        Send email via configured provider.

        Args:
            to: Recipient email
            subject: Email subject
            html: HTML email body
            text: Plain text email body (optional)
            template_id: Template ID for tracking

        Returns:
            True if sent successfully
        """
        if EMAIL_PROVIDER == "none":
            logger.warning(f"No email provider configured. Email not sent to {to}")
            return False

        try:
            if EMAIL_PROVIDER == "resend":
                return NotificationService._send_via_resend(to, subject, html, text)
            elif EMAIL_PROVIDER == "sendgrid":
                return NotificationService._send_via_sendgrid(to, subject, html, text)
        except Exception as e:
            logger.error(f"Failed to send email to {to}: {e}")
            return False

    @staticmethod
    def _send_via_resend(to: str, subject: str, html: str, text: Optional[str]) -> bool:
        """Send via Resend."""
        try:
            resend.Emails.send(
                {
                    "from": f"{NotificationService.FROM_NAME} <{NotificationService.FROM_EMAIL}>",
                    "to": to,
                    "subject": subject,
                    "html": html,
                    "text": text or "",
                }
            )
            logger.info(f"Email sent to {to} via Resend")
            return True
        except Exception as e:
            logger.error(f"Resend error: {e}")
            return False

    @staticmethod
    def _send_via_sendgrid(to: str, subject: str, html: str, text: Optional[str]) -> bool:
        """Send via SendGrid."""
        try:
            message = Mail(
                from_email=NotificationService.FROM_EMAIL,
                to_emails=to,
                subject=subject,
                plain_text_content=text or "",
                html_content=html,
            )
            sg.send(message)
            logger.info(f"Email sent to {to} via SendGrid")
            return True
        except Exception as e:
            logger.error(f"SendGrid error: {e}")
            return False

    # ===== Trial Emails =====

    @staticmethod
    def send_trial_welcome(email: str, org_name: str) -> bool:
        """Send welcome email to trial organization."""
        template = NotificationService._get_template("trial_welcome")
        html = template.html.format(org_name=org_name)

        return NotificationService.send_email(
            to=email,
            subject=template.subject,
            html=html,
            text=template.text,
            template_id="trial_welcome",
        )

    @staticmethod
    def send_trial_7_days_left(email: str, org_name: str) -> bool:
        """Send reminder email (7 days left in trial)."""
        template = NotificationService._get_template("trial_7_days")
        html = template.html.format(org_name=org_name)

        return NotificationService.send_email(
            to=email,
            subject=template.subject,
            html=html,
            text=template.text,
            template_id="trial_7_days",
        )

    @staticmethod
    def send_trial_upgrade_now(email: str, org_name: str) -> bool:
        """Send upgrade prompt email (last day of trial)."""
        template = NotificationService._get_template("trial_upgrade")
        html = template.html.format(org_name=org_name)

        return NotificationService.send_email(
            to=email,
            subject=template.subject,
            html=html,
            text=template.text,
            template_id="trial_upgrade",
        )

    # ===== Invoice Emails =====

    @staticmethod
    def send_invoice_overdue(email: str, org_name: str, amount: float, days_overdue: int) -> bool:
        """Send overdue invoice notification."""
        template = NotificationService._get_template("invoice_overdue")
        html = template.html.format(org_name=org_name, amount=amount, days_overdue=days_overdue)

        return NotificationService.send_email(
            to=email,
            subject=template.subject,
            html=html,
            text=template.text,
            template_id="invoice_overdue",
        )

    @staticmethod
    def send_invoice_reminder(email: str, org_name: str, amount: float, due_date: str) -> bool:
        """Send invoice reminder (7 days before due)."""
        template = NotificationService._get_template("invoice_reminder")
        html = template.html.format(org_name=org_name, amount=amount, due_date=due_date)

        return NotificationService.send_email(
            to=email,
            subject=template.subject,
            html=html,
            text=template.text,
            template_id="invoice_reminder",
        )

    # ===== At-Risk Student Alerts =====

    @staticmethod
    def send_at_risk_student_alert(
        teacher_email: str,
        teacher_name: str,
        student_names: List[str],
        reason: str,
    ) -> bool:
        """Send weekly digest of at-risk students to teacher."""
        template = NotificationService._get_template("at_risk_alert")
        student_list = ", ".join(student_names[:5])  # Show first 5
        if len(student_names) > 5:
            student_list += f" +{len(student_names) - 5} more"

        html = template.html.format(
            teacher_name=teacher_name,
            student_list=student_list,
            reason=reason,
        )

        return NotificationService.send_email(
            to=teacher_email,
            subject=template.subject,
            html=html,
            text=template.text,
            template_id="at_risk_alert",
        )

    # ===== Organization Health Alerts =====

    @staticmethod
    def send_cs_alert(
        admin_email: str,
        organization_name: str,
        alert_type: str,
    ) -> bool:
        """Send health alert to school admin (for CS team awareness)."""
        alert_messages = {
            "inactive_14_days": "Your organization has been inactive for 14 days",
            "invoice_overdue": "Your invoice is overdue",
            "low_engagement": "Student engagement is below 30%",
            "trial_expiring": "Your trial expires in 7 days",
        }

        message = alert_messages.get(alert_type, "Your account needs attention")
        template = NotificationService._get_template("org_health_alert")
        html = template.html.format(org_name=organization_name, message=message)

        return NotificationService.send_email(
            to=admin_email,
            subject=template.subject,
            html=html,
            text=template.text,
            template_id="org_health_alert",
        )

    # ===== Invitation Emails =====

    @staticmethod
    def send_teacher_invitation(
        email: str,
        inviter_name: str,
        organization_name: str,
        invite_url: str,
    ) -> bool:
        """Send teacher invitation email."""
        template = NotificationService._get_template("teacher_invitation")
        html = template.html.format(
            inviter_name=inviter_name,
            organization_name=organization_name,
            invite_url=invite_url,
        )

        return NotificationService.send_email(
            to=email,
            subject=template.subject,
            html=html,
            text=template.text,
            template_id="teacher_invitation",
        )

    @staticmethod
    def send_student_invitation(
        email: str,
        class_name: str,
        teacher_name: str,
        invite_url: str,
    ) -> bool:
        """Send student invitation email."""
        template = NotificationService._get_template("student_invitation")
        html = template.html.format(
            class_name=class_name,
            teacher_name=teacher_name,
            invite_url=invite_url,
        )

        return NotificationService.send_email(
            to=email,
            subject=template.subject,
            html=html,
            text=template.text,
            template_id="student_invitation",
        )

    # ===== Template Loader =====

    @staticmethod
    def _get_template(template_name: str) -> EmailTemplate:
        """Load email template by name."""
        templates: Dict[str, EmailTemplate] = {
            "trial_welcome": EmailTemplate(
                subject="Welcome to LearnPath AI - Your Free Trial Starts Now",
                text="Welcome {org_name}! Your 30-day free trial is ready.",
                html="<h1>Welcome to LearnPath AI</h1><p>Hello {org_name},</p><p>Your 30-day free trial is now active. Explore all features risk-free!</p>",
            ),
            "trial_7_days": EmailTemplate(
                subject="Your Free Trial Expires in 7 Days",
                text="Only 7 days left in your trial for {org_name}.",
                html="<h1>Trial Expires Soon</h1><p>Hello,</p><p>Your LearnPath trial for {org_name} expires in 7 days. Make the most of your remaining time!</p>",
            ),
            "trial_upgrade": EmailTemplate(
                subject="Last Day! Upgrade Your LearnPath Account",
                text="Upgrade {org_name} to continue using LearnPath.",
                html="<h1>Upgrade Your Account</h1><p>Your trial for {org_name} expires today. Upgrade now to continue learning!</p>",
            ),
            "invoice_overdue": EmailTemplate(
                subject="Invoice Overdue - Action Required",
                text="Invoice for {org_name} is {days_overdue} days overdue.",
                html="<h1>Invoice Overdue</h1><p>Invoice for {org_name} is {days_overdue} days overdue. Amount: ${amount}. Please update payment.</p>",
            ),
            "invoice_reminder": EmailTemplate(
                subject="Invoice Reminder - Due {due_date}",
                text="Invoice reminder for {org_name}.",
                html="<h1>Invoice Due Soon</h1><p>Invoice for {org_name} due {due_date}. Amount: ${amount}.</p>",
            ),
            "at_risk_alert": EmailTemplate(
                subject="Weekly Alert: At-Risk Students in Your Class",
                text="Students need attention: {student_list}",
                html="<h1>At-Risk Students</h1><p>Hi {teacher_name},</p><p>The following students need attention: {student_list}. Reason: {reason}</p>",
            ),
            "org_health_alert": EmailTemplate(
                subject="Organization Health Alert",
                text="Alert for {org_name}: {message}",
                html="<h1>Organization Alert</h1><p>{org_name}: {message}. Please take action.</p>",
            ),
            "teacher_invitation": EmailTemplate(
                subject="Join {organization_name} on LearnPath",
                text="You're invited to teach at {organization_name}.",
                html="<h1>You're Invited</h1><p>{inviter_name} invites you to teach at {organization_name}. <a href='{invite_url}'>Accept Invitation</a></p>",
            ),
            "student_invitation": EmailTemplate(
                subject="Join {class_name} on LearnPath",
                text="You're invited to join {class_name} taught by {teacher_name}.",
                html="<h1>Join a Class</h1><p>You're invited to join {class_name} taught by {teacher_name}. <a href='{invite_url}'>Join Now</a></p>",
            ),
        }

        return templates.get(template_name, templates["trial_welcome"])
