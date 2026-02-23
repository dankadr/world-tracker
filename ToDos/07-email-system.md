# ToDo: Email System — Notifications, Digests & Engagement

**Date:** 2026-02-24
**Status:** Not Started
**Priority:** Medium
**Scope:** Add email-based notifications, weekly digests, and engagement emails

---

## Overview

Currently the app has no email functionality at all. Users authenticate via Google (which provides their email), but no emails are ever sent. This plan adds a full email system covering transactional emails (welcome, friend requests), engagement emails (weekly digest, achievement notifications), and planning emails (bucket list reminders).

## Current State

- **Auth:** Google Sign-In returns user's email — stored in the users table via `backend/models.py`
- **Backend:** FastAPI at `backend/main.py` — single file, 1,691 lines
- **Database:** PostgreSQL (Neon serverless in production)
- **No email service configured**
- **No email templates**
- **No user preferences for notifications**

## Email Types

### Transactional (immediate)
| Email | Trigger | Content |
|-------|---------|---------|
| Welcome | First login | Welcome message, quick start guide, app features overview |
| Friend Request | Someone sends a friend request | "X wants to be your friend", accept/decline buttons |
| Friend Accepted | Someone accepts your request | "X accepted your friend request" |
| Challenge Invite | Invited to a challenge | Challenge details, accept button, deadline |
| Challenge Completed | Challenge finishes | Results, your score, winner announcement |

### Engagement (scheduled)
| Email | Frequency | Content |
|-------|-----------|---------|
| Weekly Digest | Every Monday | Stats summary, new achievements unlocked, friends' activity highlights, bucket list reminders |
| Monthly Recap | 1st of month | Monthly stats, progress toward goals, top achievements |
| Milestone Celebration | On milestone | "You've visited 50 countries!", achievement badge image |
| Year in Review | January 1st | Link to Year in Review feature, top stats of the year |

### Planning (conditional)
| Email | Trigger | Content |
|-------|---------|---------|
| Bucket List Reminder | Target date approaching | "Your trip to Japan is in 2 weeks!", bucket list items for that trip |
| Inactive User | No activity for 30 days | "We miss you! You've visited X countries. Your next destination awaits." |

## Tech Stack Decision

| Service | Free Tier | API Quality | Recommendation |
|---------|-----------|-------------|----------------|
| **Resend** | 100 emails/day | Excellent (modern, React Email) | **Recommended** |
| SendGrid | 100 emails/day | Good (established) | Alternative |
| AWS SES | 62,000/month (from EC2) | Good (cheapest at scale) | For scale |
| Postmark | 100 emails/month | Excellent (transactional focus) | Too limited |

**Decision: Resend** — modern API, React Email templates, generous free tier, excellent DX.

## Implementation Plan

### Phase 1: Backend Email Infrastructure

#### Database Schema
```sql
-- User email preferences
CREATE TABLE email_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
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

-- Email send log (for debugging and preventing duplicates)
CREATE TABLE email_log (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_type TEXT NOT NULL,       -- 'welcome', 'friend_request', 'weekly_digest', etc.
    subject TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    resend_id TEXT,                  -- Resend message ID
    status TEXT DEFAULT 'sent'       -- 'sent', 'delivered', 'bounced', 'failed'
);
```

#### FastAPI Email Service
```python
# backend/email_service.py
import resend
from datetime import datetime

resend.api_key = os.getenv("RESEND_API_KEY")

FROM_EMAIL = "World Tracker <noreply@worldtracker.app>"

async def send_email(to: str, subject: str, html: str, email_type: str, user_id: str):
    """Send an email and log it."""
    try:
        result = resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        # Log to database
        await log_email(user_id, email_type, subject, result["id"])
        return result
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return None

async def check_preferences(user_id: str, email_type: str) -> bool:
    """Check if user has opted in for this email type."""
    # Query email_preferences table
    pass
```

#### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/email/preferences` | Get user's email preferences |
| `PUT` | `/api/email/preferences` | Update preferences |
| `POST` | `/api/email/unsubscribe/{token}` | One-click unsubscribe |
| `GET` | `/api/email/unsubscribe/{token}` | Unsubscribe page |

### Phase 2: Email Templates

#### Template Structure
```
backend/emails/
  templates/
    welcome.html
    friend_request.html
    friend_accepted.html
    challenge_invite.html
    challenge_completed.html
    weekly_digest.html
    monthly_recap.html
    milestone.html
    bucket_list_reminder.html
    reengagement.html
  base_layout.html      # Shared header/footer template
```

#### Design Spec
- Match app's warm amber glassmorphism aesthetic
- Header: World Tracker logo + warm gradient bar
- Body: Clean white/sand background, amber accents
- CTA buttons: `#c07a30` amber with white text, rounded
- Footer: Unsubscribe link, app link, social links
- Mobile-responsive (600px max-width)

#### Example: Welcome Email
```html
<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, sans-serif;">
  <div style="background: linear-gradient(135deg, #c07a30, #d89648); padding: 32px; text-align: center;">
    <img src="logo.png" alt="World Tracker" width="120" />
    <h1 style="color: white; margin-top: 16px;">Welcome to World Tracker!</h1>
  </div>
  <div style="padding: 32px; background: #faf6f0;">
    <p>Hey {{name}},</p>
    <p>Your travel journey starts now. Here's what you can do:</p>
    <ul>
      <li>🗺️ Track countries on the world map (238 countries)</li>
      <li>🏔️ Explore 10 regional trackers (Switzerland, USA, Japan...)</li>
      <li>🏆 Unlock 80+ achievement badges</li>
      <li>👥 Add friends and compare maps</li>
      <li>🎨 Customize your pixel art avatar</li>
    </ul>
    <a href="https://worldtracker.app" style="display: inline-block; background: #c07a30; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Start Exploring →
    </a>
  </div>
  <div style="padding: 16px; text-align: center; color: #888; font-size: 12px;">
    <a href="{{unsubscribe_url}}">Unsubscribe</a>
  </div>
</div>
```

### Phase 3: Scheduled Jobs (Digests)

#### Weekly Digest Cron
```python
# backend/jobs/weekly_digest.py
# Run every Monday at 9:00 AM UTC

async def send_weekly_digests():
    """Send weekly digest to all opted-in users."""
    users = await get_users_with_preference('weekly_digest', True)
    
    for user in users:
        stats = await compute_weekly_stats(user.id)
        if stats['has_activity']:
            html = render_template('weekly_digest.html', {
                'name': user.name,
                'new_visits': stats['new_visits'],
                'achievements_unlocked': stats['new_achievements'],
                'friends_activity': stats['friends_highlights'],
                'upcoming_bucket_list': stats['upcoming_items'],
                'total_countries': stats['total_countries'],
                'level': stats['level'],
                'xp': stats['xp'],
            })
            await send_email(user.email, "Your Weekly Travel Update 🗺️", html, 'weekly_digest', user.id)
```

#### Scheduling Options
| Option | Pros | Cons |
|--------|------|------|
| **Vercel Cron** | Already on Vercel, simple | Limited to 1/day on free tier |
| APScheduler (Python) | Flexible, in-process | Needs persistent server |
| External cron (cron-job.org) | Free, reliable | External dependency |
| GitHub Actions | Free, version-controlled | Slightly complex setup |

**Decision: Vercel Cron** for daily/weekly jobs. Configure in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/weekly-digest", "schedule": "0 9 * * 1" },
    { "path": "/api/cron/bucket-reminders", "schedule": "0 10 * * *" }
  ]
}
```

### Phase 4: Frontend — Preferences UI

Add email preferences section in Profile screen (or Settings modal):
```jsx
// In ProfileScreen or Settings
<div className="email-preferences">
  <h3>Email Notifications</h3>
  <Toggle label="Weekly Digest" checked={prefs.weekly_digest} onChange={...} />
  <Toggle label="Monthly Recap" checked={prefs.monthly_recap} onChange={...} />
  <Toggle label="Friend Notifications" checked={prefs.friend_notifications} onChange={...} />
  <Toggle label="Challenge Updates" checked={prefs.challenge_notifications} onChange={...} />
  <Toggle label="Bucket List Reminders" checked={prefs.bucket_list_reminders} onChange={...} />
  <Toggle label="Milestone Celebrations" checked={prefs.milestone_celebrations} onChange={...} />
</div>
```

## Privacy & Compliance

### GDPR Compliance
- [ ] Explicit opt-in for marketing emails (not pre-checked)
- [ ] One-click unsubscribe link in every email
- [ ] Unsubscribe page that works without login
- [ ] Email preference export (part of data export in `11-data-export-import.md`)
- [ ] Email data deletion on account deletion

### CAN-SPAM Compliance
- [ ] Physical mailing address in footer (or registered business address)
- [ ] Clear "unsubscribe" link
- [ ] Accurate "From" and "Subject" lines
- [ ] Honor unsubscribe requests within 10 business days

## Files to Create
| File | Purpose |
|------|---------|
| `backend/email_service.py` | Email sending logic + Resend integration |
| `backend/emails/templates/` | HTML email templates (10+ files) |
| `backend/jobs/weekly_digest.py` | Weekly digest generation |
| `backend/jobs/bucket_reminders.py` | Bucket list reminder logic |
| `api/cron/weekly-digest.py` | Vercel cron endpoint |
| `api/cron/bucket-reminders.py` | Vercel cron endpoint |

## Files to Modify
| File | Change |
|------|--------|
| `backend/models.py` | Add `EmailPreferences` and `EmailLog` models |
| `backend/main.py` | Add email preference endpoints, trigger transactional emails |
| `backend/requirements.txt` | Add `resend` package |
| `vercel.json` | Add cron job configuration |
| `src/App.jsx` or Profile component | Add email preferences UI |
| `requirements.txt` (root) | Add `resend` for Vercel serverless |

## Estimated Effort
- Email service setup & Resend integration: ~3-4 hours
- Email templates (HTML): ~6-8 hours
- Scheduled jobs (digest, reminders): ~4-5 hours
- Frontend preferences UI: ~2-3 hours
- Unsubscribe flow + compliance: ~2-3 hours
- **Total: ~17-23 hours**
