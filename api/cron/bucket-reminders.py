"""
Vercel serverless function — Bucket List Reminders cron job.

Schedule: every day at 10:00 AM UTC (configured in vercel.json).
Sends reminders to users with upcoming bucket-list target dates.

TODO (reminder logic not yet implemented):
  - Open a DB connection using the same DATABASE_URL pattern as backend/database.py
  - Query wishlist items WHERE target_date is within the next 30 days
  - JOIN with email_preferences WHERE bucket_list_reminders = TRUE
       AND unsubscribed_at IS NULL
  - Deduplicate: check email_log to avoid re-sending within 7 days
  - Render a reminder email template (to be added to email_service.py)
  - Call email_service.send_email() for each eligible user
  - Return {"status": "ok", "sent": N}
"""

import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

logger = logging.getLogger(__name__)

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

        # TODO: implement reminder logic (see module docstring above)
        logger.info("bucket-reminders cron triggered — reminder logic not yet implemented")

        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "sent": 0}).encode())

    def log_message(self, format, *args):
        logger.info(format, *args)
