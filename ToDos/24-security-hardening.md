# ToDo: Security Hardening

**Date:** 2026-03-16
**Status:** Partially complete — encryption and some hardening are live, but several security tasks remain open
**Priority:** High
**Scope:** Fix identified security weaknesses across frontend and backend: cryptographic RNG, rate limiting, input validation, CSP headers, and dependency audit

---


## PR Review Snapshot (2026-03-19)

Several hardening tasks described here are no longer hypothetical:

- **PR #75** added edge middleware rate limiting for `/auth/google` and `/admin/*`.
- **PR #81** added a `Permissions-Policy` response header in `vercel.json`.
- **PR #87** hardened auth expiry handling by rejecting expired JWTs on load and auto-logging out after authenticated 401s.
- **PR #84** added a lightweight `/api/health` endpoint for uptime monitoring, which supports operational readiness but does not replace deeper security controls.

Treat the remaining items below as the next security pass, not a greenfield list.

## Overview

A code review of the current stack reveals several security improvements that should be addressed before the user base grows significantly. None of these are critical vulnerabilities (the encryption layer is solid), but they are best-practice gaps that could be exploited at scale.

## Reality Check (2026-03-25)

- The repo now has encrypted-at-rest data handling, request IDs, JWT secret validation in production, and several security headers in `vercel.json`
- `secureStorage.js` already documents intentional legacy/plaintext fallback behavior in code comments
- Missing pieces from this plan still include CSP, broader rate limiting, stronger request/input validation, `security.txt`, and dependency-audit automation

## Identified Issues

### Backend

#### 1. `random` module used for security-sensitive IDs (HIGH)

`backend/models.py` uses Python's `random` module for `generate_friend_code()` and `generate_challenge_id()`. Python's `random` is not cryptographically secure — it uses a Mersenne Twister PRNG. These IDs are used for access control (friend codes let anyone add you as a friend without knowing your email).

**Fix:** Replace with `secrets.token_urlsafe` / `secrets.choice`:
```python
import secrets
import string

def generate_friend_code(length=8):
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars, k=length))  # NOT random.choices

def generate_challenge_id():
    return secrets.token_urlsafe(9)[:12]  # url-safe, 12 chars
```

#### 2. No rate limiting on most API endpoints (MEDIUM)

PR #75 already added edge rate limiting for `/auth/google` and `/admin/*`, but the broader `/api/*` surface is still unprotected against bulk operations (e.g. a user spamming `POST /api/friends/request`).

**Fix:** Add per-user rate limits in FastAPI middleware:
```python
# Simple in-process token bucket per user (adequate for Vercel serverless scale)
# Or use Vercel KV (Redis) for distributed rate limiting
POST /api/friends/request    → 10/hour per user
POST /api/challenges         → 5/hour per user
PATCH /api/visited/*         → 100/min per user
POST /api/media/*            → 20/hour per user (when photos added)
```

#### 3. No input length validation on text fields (MEDIUM)

Notes, challenge titles/descriptions, usernames, and captions have no server-side length limits. A user could POST a 10 MB note and it would be encrypted and stored.

**Fix:** Add Pydantic `Field(max_length=...)` to all string inputs:
```python
class VisitedRequest(BaseModel):
    regions: list[str] = Field(max_items=1000)
    dates: dict[str, str] | None = Field(default=None)
    notes: dict[str, str] | None = Field(default=None)
    # Add: validate each note value max length
```

#### 4. Missing `httponly` / `secure` cookie flags (LOW — JWTs are in headers not cookies)

JWTs are stored in localStorage on the frontend and sent as Bearer tokens. This is fine for a SPA but means XSS attacks can steal tokens. Mitigation: add a strong Content Security Policy (see below).

#### 5. CORS: `allow_origins` is a single exact string (LOW)

Currently `allow_origins=[FRONTEND_URL]`. When adding support for a mobile app (Capacitor), multiple origins will need to be allowed. Validate origin against a whitelist rather than a single string.

```python
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("FRONTEND_URLS", FRONTEND_URL).split(",")]
```

#### 6. No request size limit (MEDIUM)

FastAPI/Starlette has a default body size limit but it's large. Add explicit limits:
```python
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*.vercel.app", "your-domain.com"]
)
# And in Vercel config: maxRequestBodySize
```

### Frontend

#### 7. No Content Security Policy (MEDIUM)

No CSP headers are set yet. PR #81 added `Permissions-Policy`, which is helpful, but it does not mitigate script injection the way a real CSP would.

**Fix:** Add CSP via `vercel.json` headers:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'nonce-{nonce}' https://accounts.google.com; img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com;"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

Note: Leaflet map tiles from various CDNs need to be in `img-src` and `connect-src`. Audit all tile URLs in `mapLayers.json`.

#### 8. `secureStorage` falls back to `localStorage` (LOW)

`src/utils/secureStorage.js` — if the encryption key is not available, it falls back to unencrypted localStorage. Ensure this fallback is intentional and audited.

#### 9. Dependency audit (MEDIUM)

Run `npm audit` and `pip-audit` — fix all HIGH/CRITICAL findings. Pin exact versions in `requirements.txt` (currently uses `>=` version ranges).

#### 10. `lz-string` in bundle (LOW — informational)

`lz-string` is used for compressing share URLs. Ensure it's not used in paths that could be fed attacker-controlled input without validation (compression bombs are a known attack vector).

### Infrastructure

#### 11. No security.txt (LOW)

Add `public/.well-known/security.txt` with a responsible disclosure contact:
```
Contact: mailto:security@yourdomain.com
Expires: 2027-01-01T00:00:00.000Z
```

## Implementation Phases

### Phase 1 — Critical fixes (do this first)
- [ ] Replace `random` with `secrets` in `models.py` (`generate_friend_code`, `generate_challenge_id`)
- [ ] Add Pydantic `Field(max_length=...)` to all user-supplied string fields
- [ ] Run `npm audit --fix` and `pip-audit`, update vulnerable dependencies

### Phase 2 — Rate limiting
- [ ] Add per-user rate limiting middleware in FastAPI (token bucket, in-process or Vercel KV)
- [ ] Test rate limit responses: `429 Too Many Requests` with `Retry-After` header

### Phase 3 — Headers & CSP
- [ ] Audit all CDN URLs used by Leaflet tiles
- [ ] Add CSP + security headers to `vercel.json`
- [ ] Test in browser devtools that no CSP violations are triggered
- [ ] Add `FRONTEND_URLS` multi-origin support to CORS config

### Phase 4 — Misc
- [ ] `public/.well-known/security.txt`
- [ ] Audit `secureStorage.js` fallback behavior — document intentional fallbacks
- [ ] Add `X-Request-Id` to all error responses (already in middleware, verify coverage)
- [ ] Add request body size limits to both Vercel config and FastAPI

### Phase 5 — Ongoing
- [ ] Set up `pip-audit` and `npm audit` as CI checks (GitHub Actions step)
- [ ] Dependency pinning in `requirements.txt`
- [ ] Document security model in README/SECURITY.md

## Notes

- The encryption layer (`backend/crypto.py` with `ENCRYPTION_MASTER_KEY`) is well-designed — all user data is encrypted at rest. This ToDo focuses on the transport/auth/infrastructure layer
- JWT tokens expire in 30 days (`JWT_EXPIRE_DAYS = 30`) — consider adding refresh token support so access tokens can be shorter-lived (7 days)
- The most impactful fix is #1 (secrets module) — ship that ASAP
