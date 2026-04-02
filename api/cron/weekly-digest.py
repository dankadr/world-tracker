"""
Vercel serverless function — Weekly Digest cron job.

Schedule: every Monday at 9:00 AM UTC (configured in vercel.json).
Iterates users with weekly_digest=True and sends a personalised digest email.

TODO (digest logic not yet implemented):
  - Open a DB connection using the same DATABASE_URL pattern as backend/database.py
  - Query email_preferences WHERE weekly_digest = TRUE AND unsubscribed_at IS NULL
  - For each user: fetch their visited region counts for the past week
  - Render a digest email template (to be added to email_service.py)
  - Call email_service.send_email() for each user
  - Return {"status": "ok", "sent": N}
"""

import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

logger = logging.getLogger(__name__)

# Verify request comes from Vercel's cron scheduler
CRON_SECRET = os.getenv("CRON_SECRET", "")


from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Verify cron secret header to prevent unauthorised invocations
        auth = self.headers.get("authorization", "")
        if CRON_SECRET and auth != f"Bearer {CRON_SECRET}":
            self.send_response(401)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "unauthorised"}).encode())
            return

        # TODO: implement digest logic (see module docstring above)
        logger.info("weekly-digest cron triggered — digest logic not yet implemented")

        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "sent": 0}).encode())

    def log_message(self, format, *args):
        logger.info(format, *args)
