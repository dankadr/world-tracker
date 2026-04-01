"""
Email service for World Tracker — uses Resend for transactional email delivery.

Database migrations required before use:

    CREATE TABLE IF NOT EXISTS email_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        welcome_sent BOOLEAN DEFAULT FALSE,
        weekly_digest BOOLEAN DEFAULT TRUE,
        monthly_recap BOOLEAN DEFAULT TRUE,
        friend_notifications BOOLEAN DEFAULT TRUE,
        challenge_notifications BOOLEAN DEFAULT TRUE,
        bucket_list_reminders BOOLEAN DEFAULT TRUE,
        milestone_celebrations BOOLEAN DEFAULT TRUE,
        marketing BOOLEAN DEFAULT FALSE,
        unsubscribed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        email_type TEXT NOT NULL,
        subject TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW(),
        resend_id TEXT,
        status TEXT DEFAULT 'sent'
    );
"""

import logging
import os
from typing import Optional

import resend
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

resend.api_key = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = "World Tracker <noreply@worldtracker.app>"

# ---------------------------------------------------------------------------
# Email sending + logging
# ---------------------------------------------------------------------------

async def send_email(
    to: str,
    subject: str,
    html: str,
    email_type: str,
    user_id: str,
    db: AsyncSession,
) -> Optional[str]:
    """Send an email via Resend and log it to email_log.

    Returns the Resend message ID on success, or None on failure.
    Email failures are caught and logged — they never propagate to callers.
    """
    resend_id: Optional[str] = None
    status = "failed"
    try:
        if not resend.api_key:
            logger.warning("RESEND_API_KEY not set — skipping email send (type=%s user_id=%s)", email_type, user_id)
            return None

        response = resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        resend_id = response.get("id") if isinstance(response, dict) else getattr(response, "id", None)
        status = "sent"
        logger.info("Email sent: type=%s user_id=%s resend_id=%s", email_type, user_id, resend_id)
    except Exception as exc:
        logger.error("Email send failed: type=%s user_id=%s error=%s", email_type, user_id, exc)

    try:
        await db.execute(
            text(
                """
                INSERT INTO email_log (user_id, email_type, subject, resend_id, status)
                VALUES (:user_id, :email_type, :subject, :resend_id, :status)
                """
            ),
            {
                "user_id": str(user_id),
                "email_type": email_type,
                "subject": subject,
                "resend_id": resend_id,
                "status": status,
            },
        )
        await db.commit()
    except Exception as exc:
        logger.error("Failed to log email: type=%s user_id=%s error=%s", email_type, user_id, exc)

    return resend_id


# ---------------------------------------------------------------------------
# Preference helpers
# ---------------------------------------------------------------------------

async def check_email_preference(user_id: str, email_type: str, db: AsyncSession) -> bool:
    """Return True if the user has opted in to this email type (default True).

    Returns False if the user is fully unsubscribed or has disabled this type.
    """
    try:
        row = await db.execute(
            text(
                """
                SELECT unsubscribed_at,
                       welcome_sent, weekly_digest, monthly_recap,
                       friend_notifications, challenge_notifications,
                       bucket_list_reminders, milestone_celebrations, marketing
                FROM email_preferences
                WHERE user_id = :user_id
                """
            ),
            {"user_id": str(user_id)},
        )
        pref = row.mappings().one_or_none()
        if pref is None:
            # No row yet — default to opted in for all non-marketing types
            return email_type != "marketing"

        # If globally unsubscribed, block everything
        if pref["unsubscribed_at"] is not None:
            return False

        column_map = {
            "welcome": "welcome_sent",
            "weekly_digest": "weekly_digest",
            "monthly_recap": "monthly_recap",
            "friend_notification": "friend_notifications",
            "challenge_notification": "challenge_notifications",
            "bucket_list_reminder": "bucket_list_reminders",
            "milestone": "milestone_celebrations",
            "marketing": "marketing",
        }
        col = column_map.get(email_type)
        if col is None:
            logger.warning("Unknown email_type for preference check: %s", email_type)
            return True

        return bool(pref[col])
    except Exception as exc:
        logger.error("check_email_preference failed: user_id=%s type=%s error=%s", user_id, email_type, exc)
        return True  # Fail open — don't silently suppress emails on DB error


async def get_or_create_preferences(user_id: str, db: AsyncSession) -> dict:
    """Return the user's email_preferences row, creating defaults if missing."""
    try:
        row = await db.execute(
            text("SELECT * FROM email_preferences WHERE user_id = :user_id"),
            {"user_id": str(user_id)},
        )
        pref = row.mappings().one_or_none()
        if pref is not None:
            return dict(pref)

        # Create with defaults
        await db.execute(
            text(
                """
                INSERT INTO email_preferences (user_id)
                VALUES (:user_id)
                ON CONFLICT (user_id) DO NOTHING
                """
            ),
            {"user_id": str(user_id)},
        )
        await db.commit()

        row = await db.execute(
            text("SELECT * FROM email_preferences WHERE user_id = :user_id"),
            {"user_id": str(user_id)},
        )
        pref = row.mappings().one_or_none()
        return dict(pref) if pref is not None else {}
    except Exception as exc:
        logger.error("get_or_create_preferences failed: user_id=%s error=%s", user_id, exc)
        return {}


# ---------------------------------------------------------------------------
# Email templates
# ---------------------------------------------------------------------------

def _base_template(title: str, content: str) -> str:
    """Wrap email content in the branded base layout."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#faf6f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#faf6f0;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0" role="presentation">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#c07a30,#d89648);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                🌍 World Tracker
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">{title}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #ede8e0;border-right:1px solid #ede8e0;">
              {content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f5f0e8;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border:1px solid #ede8e0;border-top:none;">
              <p style="margin:0;color:#8a7560;font-size:12px;line-height:1.6;">
                You're receiving this email because you have a World Tracker account.<br>
                <a href="{{unsubscribe_url}}" style="color:#c07a30;text-decoration:underline;">Unsubscribe from all emails</a>
              </p>
              <p style="margin:8px 0 0;color:#b0a090;font-size:11px;">
                World Tracker &bull; Travel the world, track your journey
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def render_welcome_email(name: str) -> str:
    """Return HTML for the welcome email sent after first login."""
    display_name = name or "Explorer"
    content = f"""
      <h2 style="margin:0 0 16px;color:#1a1208;font-size:24px;font-weight:700;">
        Welcome aboard, {display_name}! 🎉
      </h2>
      <p style="margin:0 0 16px;color:#4a3820;font-size:16px;line-height:1.6;">
        Your adventure tracking journey starts now. World Tracker helps you map every region
        you've visited, build your bucket list, and challenge friends to explore more.
      </p>
      <p style="margin:0 0 24px;color:#4a3820;font-size:16px;line-height:1.6;">
        Here's what you can do right away:
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;">
            <span style="color:#c07a30;font-size:20px;">🗺️</span>
            <span style="color:#4a3820;font-size:15px;margin-left:12px;"><strong>Mark regions</strong> you've already visited</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;">
            <span style="color:#c07a30;font-size:20px;">⭐</span>
            <span style="color:#4a3820;font-size:15px;margin-left:12px;"><strong>Build your bucket list</strong> of places to explore</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;">
            <span style="color:#c07a30;font-size:20px;">🏆</span>
            <span style="color:#4a3820;font-size:15px;margin-left:12px;"><strong>Challenge friends</strong> and earn XP together</span>
          </td>
        </tr>
      </table>
      <div style="text-align:center;">
        <a href="https://worldtracker.app" style="display:inline-block;background:#c07a30;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
          Start Exploring →
        </a>
      </div>
    """
    return _base_template("Welcome to World Tracker", content)


def render_milestone_email(name: str, milestone: str, count: int) -> str:
    """Return HTML for a milestone celebration email."""
    display_name = name or "Explorer"
    content = f"""
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:64px;line-height:1;">🏆</div>
        <h2 style="margin:16px 0 8px;color:#1a1208;font-size:26px;font-weight:700;">
          Milestone unlocked!
        </h2>
        <p style="margin:0;color:#8a7560;font-size:15px;">Keep exploring, {display_name}</p>
      </div>
      <div style="background:#fef9f0;border:2px solid #f0d8a8;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <p style="margin:0 0 8px;color:#8a7560;font-size:13px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">
          Achievement
        </p>
        <p style="margin:0;color:#c07a30;font-size:22px;font-weight:700;">{milestone}</p>
        <p style="margin:8px 0 0;color:#4a3820;font-size:32px;font-weight:800;">{count:,}</p>
        <p style="margin:4px 0 0;color:#8a7560;font-size:14px;">regions explored</p>
      </div>
      <p style="margin:0 0 24px;color:#4a3820;font-size:16px;line-height:1.6;text-align:center;">
        Every journey starts with a single step — and you've taken {count:,} of them.
        Where will you go next?
      </p>
      <div style="text-align:center;">
        <a href="https://worldtracker.app" style="display:inline-block;background:#c07a30;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
          Keep Exploring →
        </a>
      </div>
    """
    return _base_template(f"Milestone: {milestone}", content)
