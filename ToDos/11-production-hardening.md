# ToDo: Production Hardening

**Date:** 2026-03-15
**Status:** Partially complete — most quick wins and one medium-risk item are already shipped
**Priority:** High
**Scope:** Three phased plans to harden the app for beta launch and beyond. Each task is independently shippable.

**Spec:** `docs/superpowers/specs/2026-03-15-production-hardening-design.md`

---

## Plan 1 — Zero-risk quick wins
All tasks are independent. No regressions possible. Ship in any order.

- [x] **1.1** Add `cryptography` to `requirements.txt` explicitly
- [x] **1.2** Move `ADMIN_EMAIL` to env var (`backend/main.py`)
- [x] **1.3** Add security headers via `vercel.json` (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`)
- [ ] **1.4** Cap batch endpoint at 50 actions — Pydantic v2 `Annotated[list[BatchAction], Field(max_length=50)]`
- [x] **1.5** Check JWT expiry inside `loadAuth()` in `AuthContext.jsx` — return null if expired
- [x] **1.6** Cache Fernet instance per `(user_id, key_fingerprint)` in `backend/crypto.py`
- [x] **1.7** Guard insecure `JWT_SECRET` default — crash on startup if unset in production
- [x] **1.8** Add `GET /api/health` endpoint
- [x] **1.9** Guard `console.log/warn` behind `import.meta.env.DEV` — create `src/utils/logger.js`

---

## Plan 2 — Medium-risk hardening
Validate each task in the beta environment before merging.

- [ ] **2.1** Restrict CORS to production domain via `ALLOWED_ORIGINS` env var
- [ ] **2.2** Rate limiting on `/auth/google` (10 req/min) and `/api/batch` (60 req/min) via `slowapi`
- [x] **2.3** Add React `<ErrorBoundary>` wrapping the app root in `src/main.jsx`
- [ ] **2.4** Fix N+1 queries in batch endpoint — group DB fetches by table before the loop
- [ ] **2.5** Fix PWA API cache — only cache 200 responses, reduce TTL to 5 min, tighten URL pattern to production domain

---

## Plan 3 — Architectural (post-beta)
Larger tasks. Each requires dedicated testing before merging.

- [ ] **3.1** Code splitting — `React.lazy()` + `Suspense` for all non-critical screens/panels. Target: initial bundle under 3MB (currently 17MB+)
- [ ] **3.2** JWT httpOnly cookie migration — move token out of `localStorage` into `Set-Cookie: HttpOnly; Secure; SameSite=Strict`
- [ ] **3.3** Proper DB migrations with Alembic — replace the "add missing columns" cold-start hack in `database.py`

---

## Notes

- Verified in current repo: explicit `cryptography`, env-backed `ADMIN_EMAIL`, security headers, JWT expiry handling, Fernet caching, health endpoint, logger utility, and root `ErrorBoundary`
- Still open: batch request caps, multi-origin CORS config, backend rate limiting, batch query optimization, and tighter service-worker API caching rules
- Plans 1 and 2 are scoped for beta launch
- Plan 3 is post-beta / GA prep
- Each task has full implementation detail in the spec doc linked above
