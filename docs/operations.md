# Operations Guide

## Neon Database Backups

### Confirm backups are enabled
1. Open your [Neon console](https://console.neon.tech/)
2. Go to **Project → Settings → Backups**
3. Verify that point-in-time restore (PITR) is enabled. The free tier retains 7 days of restore points; paid tiers support up to 30 days.

### Restore from a Neon backup
1. In the Neon console, go to **Branches**.
2. Click **Restore** on your main branch.
3. Select the restore point (timestamp or transaction ID).
4. Neon creates a new branch at that point — verify data, then swap it to production if correct.

Full restore docs: [Neon point-in-time restore](https://neon.tech/docs/guides/branch-restore)

---

## ENCRYPTION_MASTER_KEY Policy

> **CRITICAL: Never rotate this key after data has been encrypted with it.**

The `ENCRYPTION_MASTER_KEY` is used to derive per-user encryption keys for all sensitive columns in the database (visited data, display names, profile pictures, notes, etc.).

**Changing this key renders all encrypted user data permanently unrecoverable.**

### If rotation is ever required
1. Run a full decrypt migration first using the `/admin/decrypt` endpoint (requires admin auth). This writes all data back to plaintext.
2. Update `ENCRYPTION_MASTER_KEY` to the new value in Vercel environment variables.
3. Re-deploy the app so the new key is active.
4. Run a full re-encrypt migration using the `/admin/encrypt` endpoint.

Steps 1–4 must be done with zero traffic or behind a maintenance window. There is no partial rotation.

---

## Secrets Storage (Vercel)

All secrets are stored in **Vercel Project Settings → Environment Variables**. Required variables:

| Variable | Description |
|---|---|
| `JWT_SECRET` | Signs auth tokens. Generate: `openssl rand -hex 32` |
| `ENCRYPTION_MASTER_KEY` | Encrypts DB columns. Generate: `openssl rand -hex 32`. Never change after first use. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID from Google Cloud Console |
| `ADMIN_EMAIL` | Email of the admin user (grants `/admin/*` access) |
| `FRONTEND_URL` | Production URL of the frontend (used for CORS, e.g. `https://your-app.vercel.app`) |
| `DATABASE_URL` | Neon pooled connection string |
| `SENTRY_DSN` | (Optional) Sentry DSN for backend error tracking |
| `VITE_SENTRY_DSN` | (Optional) Sentry DSN for frontend error tracking |

### Vercel auto-detects `VERCEL=1`
When running on Vercel, `VERCEL=1` is set automatically. The backend uses this to:
- Enable JSON structured logging (parseable by Vercel Log Drains)
- Enforce that no default placeholder secrets are in use

---

## Rate Limits

A Vercel Edge Middleware (`middleware.js`) enforces basic per-IP rate limits:

| Endpoint | Limit |
|---|---|
| `POST /auth/google` | 10 requests / minute |
| `POST /admin/*` | 5 requests / hour |

These limits are in-memory per edge instance and reset on cold start. For strict global enforcement, replace with Vercel KV.
