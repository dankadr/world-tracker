"""
Travel Tracker API – FastAPI application.

Works in two modes:
- Docker (uvicorn):   ``uvicorn main:app --reload``
- Vercel serverless:  imported by ``api/index.py``
"""

import json
import logging
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Depends, HTTPException, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from jose import jwt, JWTError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from pydantic import BaseModel
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

# Conditional imports: allow running from repo root (Vercel) or backend/ (Docker)
try:
    from backend.database import get_db, init_db, engine, DATABASE_URL as _DATABASE_URL
    from backend.models import (
        User, VisitedRegions, VisitedWorld, FriendRequest, Friendship,
        Challenge, ChallengeParticipant, WishlistItem, XpLog,
        generate_friend_code, generate_challenge_id,
    )
except ImportError:
    from database import get_db, init_db, engine, DATABASE_URL as _DATABASE_URL
    from models import (
        User, VisitedRegions, VisitedWorld, FriendRequest, Friendship,
        Challenge, ChallengeParticipant, WishlistItem, XpLog,
        generate_friend_code, generate_challenge_id,
    )

try:
    from backend.crypto import enc, enc_json, dec_json_safe, dec_str_safe
except ImportError:
    from crypto import enc, enc_json, dec_json_safe, dec_str_safe

try:
    from backend.admin_tasks import encrypt_all, decrypt_all
except ImportError:
    from admin_tasks import encrypt_all, decrypt_all

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
class _JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
        })


_handler = logging.StreamHandler(sys.stdout)
if os.getenv("VERCEL"):
    _handler.setFormatter(_JsonFormatter())
else:
    _handler.setFormatter(logging.Formatter("%(levelname)s  %(name)s  %(message)s"))

logging.basicConfig(level=logging.INFO, handlers=[_handler], force=True)
logger = logging.getLogger("travel-tracker.api")

# ---------------------------------------------------------------------------
# Sentry (optional — only initialised when SENTRY_DSN is set)
# ---------------------------------------------------------------------------
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    try:
        import sentry_sdk  # type: ignore
        sentry_sdk.init(dsn=SENTRY_DSN)
    except ImportError:
        logger.warning("sentry-sdk not installed; skipping Sentry initialisation")

# --------------- Config ---------------
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-please")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")

VALID_COUNTRIES = {
    "ch", "us", "usparks", "nyc", "no", "ca", "capitals", "jp", "au", "unesco",
    "ph", "br", "fr", "de", "it", "es", "mx", "gb", "in", "nz",
}


# ---------------------------------------------------------------------------
# Secrets validation (enforced on Vercel or when ENFORCE_SECRETS=true)
# ---------------------------------------------------------------------------
def _validate_secrets() -> None:
    if JWT_SECRET == "change-me-in-production-please":
        raise RuntimeError("JWT_SECRET is set to the default placeholder. Set a strong secret.")
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET env var is required.")
    if not ADMIN_EMAIL:
        raise RuntimeError("ADMIN_EMAIL env var is required.")
    enc_key = os.getenv("ENCRYPTION_MASTER_KEY", "")
    if enc_key in ("", "change-me-generate-with-openssl-rand-hex-32"):
        raise RuntimeError(
            "ENCRYPTION_MASTER_KEY is not set or is the default placeholder. "
            "Generate one with: openssl rand -hex 32"
        )


if os.getenv("VERCEL") or os.getenv("ENFORCE_SECRETS"):
    _validate_secrets()


# --------------- Lifespan ---------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Startup: initialising database …")
    await init_db()
    logger.info("Startup complete")
    yield
    logger.info("Shutdown")


app = FastAPI(title="Travel Tracker API", lifespan=lifespan)


def _rate_limit_key(request: Request) -> str:
    """Use Vercel's platform-provided client IP header, otherwise remote address."""
    if os.getenv("VERCEL"):
        forwarded_for = request.headers.get("x-forwarded-for", "")
        forwarded_hops = [hop.strip() for hop in forwarded_for.split(",") if hop.strip()]
        if forwarded_hops:
            return forwarded_hops[-1]
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Middleware – request logging (visible in Vercel Logs)
# ---------------------------------------------------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start = time.time()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.time() - start) * 1000
        logger.exception(
            "UNHANDLED  %s %s  %.0fms  request_id=%s",
            request.method, request.url.path, duration_ms, request_id,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
    duration_ms = (time.time() - start) * 1000
    logger.info(
        "%s  %s %s  %.0fms  request_id=%s",
        response.status_code,
        request.method,
        request.url.path,
        duration_ms,
        request_id,
    )
    response.headers["X-Request-Id"] = request_id
    return response


# --------------- Schemas ---------------
class GoogleLoginRequest(BaseModel):
    token: str


class GoogleLoginResponse(BaseModel):
    jwt_token: str
    user: dict


class VisitedRequest(BaseModel):
    regions: list[str]
    dates: dict[str, str] | None = None
    notes: dict[str, str] | None = None
    wishlist: list[str] | None = None


class VisitedResponse(BaseModel):
    country_id: str
    regions: list[str]
    dates: dict[str, str]
    notes: dict[str, str]
    wishlist: list[str]


class WorldVisitedRequest(BaseModel):
    countries: list[str]


class WorldVisitedResponse(BaseModel):
    countries: list[str]


class ToggleRegionRequest(BaseModel):
    region: str
    action: str  # "add" or "remove"


class ToggleWishlistRequest(BaseModel):
    region: str
    action: str  # "add" or "remove"


class ToggleWorldRequest(BaseModel):
    country: str
    action: str  # "add" or "remove"


class FriendRequestCreate(BaseModel):
    friend_code: str


class WishlistItemCreate(BaseModel):
    priority: str = "medium"  # high | medium | low
    target_date: str | None = None  # YYYY-MM
    notes: str | None = None
    category: str = "solo"  # solo | friends | family | work


class WishlistItemUpdate(BaseModel):
    priority: str | None = None
    target_date: str | None = None
    notes: str | None = None
    category: str | None = None


class WishlistItemResponse(BaseModel):
    tracker_id: str
    region_id: str
    priority: str
    target_date: str | None
    notes: str | None
    category: str
    created_at: str


class BatchAction(BaseModel):
    action: str  # region_toggle | world_toggle | wishlist_upsert | wishlist_delete
    payload: dict


class BatchRequest(BaseModel):
    actions: list[BatchAction]


class ChallengeCreate(BaseModel):
    title: str
    description: str | None = None
    tracker_id: str  # 'world', 'ch', 'us', etc.
    target_regions: list[str]  # region IDs or ['*'] for all
    challenge_type: str = "collaborative"  # 'collaborative' | 'race'
    difficulty: str | None = None  # 'easy' | 'medium' | 'hard'
    duration: str | None = None  # 'open-ended' | '48h' | '1w' | '1m'
    invite_friend_ids: list[int] = []


class ChallengeUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


# --------------- Auth helpers ---------------
@dataclass
class CurrentUser:
    """Lightweight user object derived from JWT — no DB query needed."""
    id: int
    email: str


def create_jwt(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    authorization: str = Header(None),
) -> CurrentUser:
    """Decode the JWT and return a lightweight CurrentUser — no DB round-trip."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
        email = payload.get("email", "")
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")
    return CurrentUser(id=user_id, email=email)


async def require_admin(user: CurrentUser = Depends(get_current_user)):
    """Dependency: raises 403 unless the caller is the admin user."""
    if not ADMIN_EMAIL or user.email != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@app.post("/admin/encrypt")
async def admin_encrypt(admin: CurrentUser = Depends(require_admin)):
    """Encrypt all sensitive DB columns. Idempotent — skips already-encrypted rows."""
    import asyncio
    master_key = os.environ.get("ENCRYPTION_MASTER_KEY")
    if not _DATABASE_URL or not master_key:
        raise HTTPException(status_code=500, detail="Server misconfigured: missing DATABASE_URL or ENCRYPTION_MASTER_KEY")
    try:
        result = await asyncio.to_thread(encrypt_all, _DATABASE_URL, master_key)
    except Exception as exc:
        logger.error("admin_encrypt failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"encrypt_all failed: {exc!r}")
    return result


@app.post("/admin/decrypt")
async def admin_decrypt(admin: CurrentUser = Depends(require_admin)):
    """Decrypt all sensitive DB columns back to plaintext."""
    import asyncio
    master_key = os.environ.get("ENCRYPTION_MASTER_KEY")
    if not _DATABASE_URL or not master_key:
        raise HTTPException(status_code=500, detail="Server misconfigured: missing DATABASE_URL or ENCRYPTION_MASTER_KEY")
    try:
        result = await asyncio.to_thread(decrypt_all, _DATABASE_URL, master_key)
    except Exception as exc:
        logger.error("admin_decrypt failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"decrypt_all failed: {exc!r}")
    return result


# --------------- Auth endpoint ---------------
@app.post("/auth/google", response_model=GoogleLoginResponse)
@limiter.limit("10/minute")
async def google_login(request: Request, body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        logger.error("GOOGLE_CLIENT_ID env var is not set")
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")

    try:
        idinfo = id_token.verify_oauth2_token(
            body.token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        logger.warning("Google token verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid Google token")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")
    name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")

    # Upsert user
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user:
        user.email = email
        # name/picture set after flush (need user.id for key derivation)
        logger.info("User updated: id=%s email=%s", user.id, email)
    else:
        user = User(google_id=google_id, email=email, name=None, picture=None)
        db.add(user)
        logger.info("New user created: email=%s", email)

    await db.flush()  # user.id now available for both new and existing users
    uid = user.id
    user.name = enc(uid, name) if name else None
    user.picture = enc(uid, picture) if picture else None
    await db.commit()

    jwt_token = create_jwt(uid, user.email)

    return GoogleLoginResponse(
        jwt_token=jwt_token,
        user={"id": uid, "email": user.email, "name": name, "picture": picture, "sub": google_id},  # return plaintext
    )


# --------------- Bulk endpoints ---------------
@app.get("/api/visited/all")
async def get_all_visited(
    response: Response,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all visited regions and world data in a single response."""
    response.headers["Cache-Control"] = "private, max-age=5"
    result = await db.execute(
        select(VisitedRegions).where(VisitedRegions.user_id == user.id)
    )
    records = result.scalars().all()
    uid = user.id
    regions_data = {}
    for r in records:
        regions_data[r.country_id] = {
            "country_id": r.country_id,
            "regions": dec_json_safe(uid, r.regions) or [],
            "dates": dec_json_safe(uid, r.dates) or {},
            "notes": dec_json_safe(uid, r.notes) or {},
            "wishlist": dec_json_safe(uid, r.wishlist) or [],
        }

    result = await db.execute(
        select(VisitedWorld).where(VisitedWorld.user_id == uid)
    )
    world_record = result.scalar_one_or_none()
    world_countries = dec_json_safe(uid, world_record.countries) if world_record and world_record.countries else []

    return {"regions": regions_data, "world": world_countries}


@app.delete("/api/visited/all")
async def delete_all_visited(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all visited regions for the user (used by resetAll)."""
    await db.execute(
        delete(VisitedRegions).where(VisitedRegions.user_id == user.id)
    )
    await db.commit()
    return {"status": "ok"}


# --------------- Visited endpoints ---------------
@app.get("/api/visited/{country_id}", response_model=VisitedResponse)
async def get_visited(
    country_id: str,
    response: Response,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "private, max-age=5"
    if country_id not in VALID_COUNTRIES:
        raise HTTPException(status_code=400, detail="Invalid country")

    result = await db.execute(
        select(VisitedRegions).where(
            VisitedRegions.user_id == user.id,
            VisitedRegions.country_id == country_id,
        )
    )
    record = result.scalar_one_or_none()
    uid = user.id
    regions = (dec_json_safe(uid, record.regions) or []) if record else []
    dates = (dec_json_safe(uid, record.dates) or {}) if record else {}
    notes = (dec_json_safe(uid, record.notes) or {}) if record else {}
    wishlist = (dec_json_safe(uid, record.wishlist) or []) if record else []
    return VisitedResponse(country_id=country_id, regions=regions, dates=dates, notes=notes, wishlist=wishlist)


@app.put("/api/visited/{country_id}", response_model=VisitedResponse)
async def put_visited(
    country_id: str,
    body: VisitedRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if country_id not in VALID_COUNTRIES:
        raise HTTPException(status_code=400, detail="Invalid country")

    result = await db.execute(
        select(VisitedRegions).where(
            VisitedRegions.user_id == user.id,
            VisitedRegions.country_id == country_id,
        )
    )
    record = result.scalar_one_or_none()
    uid = user.id

    if record:
        record.regions = enc_json(uid, body.regions)
        if body.dates is not None:
            record.dates = enc_json(uid, body.dates)
        if body.notes is not None:
            record.notes = enc_json(uid, body.notes)
        if body.wishlist is not None:
            record.wishlist = enc_json(uid, body.wishlist)
        record.updated_at = datetime.now(timezone.utc)
    else:
        record = VisitedRegions(
            user_id=uid,
            country_id=country_id,
            regions=enc_json(uid, body.regions),
            dates=enc_json(uid, body.dates or {}),
            notes=enc_json(uid, body.notes or {}),
            wishlist=enc_json(uid, body.wishlist or []),
        )
        db.add(record)

    await db.commit()
    return VisitedResponse(
        country_id=country_id,
        regions=body.regions,
        dates=body.dates or {},
        notes=body.notes or {},
        wishlist=body.wishlist or [],
    )


# --------------- Atomic PATCH endpoints ---------------
@app.patch("/api/visited/{country_id}", response_model=VisitedResponse)
async def patch_visited_region(
    country_id: str,
    body: ToggleRegionRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if country_id not in VALID_COUNTRIES:
        raise HTTPException(status_code=400, detail="Invalid country")
    if body.action not in ("add", "remove"):
        raise HTTPException(status_code=400, detail="action must be 'add' or 'remove'")

    result = await db.execute(
        select(VisitedRegions).where(
            VisitedRegions.user_id == user.id,
            VisitedRegions.country_id == country_id,
        )
    )
    record = result.scalar_one_or_none()

    uid = user.id
    if not record:
        record = VisitedRegions(
            user_id=uid,
            country_id=country_id,
            regions=enc_json(uid, []),
            dates=enc_json(uid, {}),
            notes=enc_json(uid, {}),
            wishlist=enc_json(uid, []),
        )
        db.add(record)

    regions = dec_json_safe(uid, record.regions) or []
    dates = dec_json_safe(uid, record.dates) or {}
    notes = dec_json_safe(uid, record.notes) or {}

    if body.action == "add":
        if body.region not in regions:
            regions.append(body.region)
    else:
        if body.region in regions:
            regions.remove(body.region)
        dates.pop(body.region, None)
        notes.pop(body.region, None)

    record.regions = enc_json(uid, regions)
    record.dates = enc_json(uid, dates)
    record.notes = enc_json(uid, notes)
    record.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return VisitedResponse(
        country_id=country_id,
        regions=regions,
        dates=dates,
        notes=notes,
        wishlist=dec_json_safe(uid, record.wishlist) or [],
    )


@app.patch("/api/visited/{country_id}/wishlist", response_model=VisitedResponse)
async def patch_visited_wishlist(
    country_id: str,
    body: ToggleWishlistRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if country_id not in VALID_COUNTRIES:
        raise HTTPException(status_code=400, detail="Invalid country")
    if body.action not in ("add", "remove"):
        raise HTTPException(status_code=400, detail="action must be 'add' or 'remove'")

    result = await db.execute(
        select(VisitedRegions).where(
            VisitedRegions.user_id == user.id,
            VisitedRegions.country_id == country_id,
        )
    )
    record = result.scalar_one_or_none()

    uid = user.id
    if not record:
        record = VisitedRegions(
            user_id=uid,
            country_id=country_id,
            regions=enc_json(uid, []),
            dates=enc_json(uid, {}),
            notes=enc_json(uid, {}),
            wishlist=enc_json(uid, []),
        )
        db.add(record)

    wishlist = dec_json_safe(uid, record.wishlist) or []

    if body.action == "add":
        if body.region not in wishlist:
            wishlist.append(body.region)
    else:
        if body.region in wishlist:
            wishlist.remove(body.region)

    record.wishlist = enc_json(uid, wishlist)
    record.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return VisitedResponse(
        country_id=country_id,
        regions=dec_json_safe(uid, record.regions) or [],
        dates=dec_json_safe(uid, record.dates) or {},
        notes=dec_json_safe(uid, record.notes) or {},
        wishlist=wishlist,
    )


@app.patch("/api/visited-world", response_model=WorldVisitedResponse)
async def patch_visited_world(
    body: ToggleWorldRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.action not in ("add", "remove"):
        raise HTTPException(status_code=400, detail="action must be 'add' or 'remove'")

    result = await db.execute(
        select(VisitedWorld).where(VisitedWorld.user_id == user.id)
    )
    record = result.scalar_one_or_none()

    uid = user.id
    if not record:
        record = VisitedWorld(user_id=uid, countries=enc_json(uid, []))
        db.add(record)

    countries = dec_json_safe(uid, record.countries) or []

    if body.action == "add":
        if body.country not in countries:
            countries.append(body.country)
    else:
        if body.country in countries:
            countries.remove(body.country)

    record.countries = enc_json(uid, countries)
    record.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return WorldVisitedResponse(countries=countries)


# --------------- Batch endpoint ---------------
@app.post("/api/batch")
@limiter.limit("60/minute")
async def batch_actions(
    request: Request,
    body: BatchRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute multiple actions in a single request (single DB transaction)."""
    uid = user.id
    results = []
    for item in body.actions:
        action = item.action
        p = item.payload

        if action == "region_toggle":
            country_id = p.get("country_id", "")
            region = p.get("region", "")
            act = p.get("action", "")
            if country_id not in VALID_COUNTRIES or act not in ("add", "remove"):
                results.append({"action": action, "ok": False, "error": "invalid params"})
                continue
            result = await db.execute(
                select(VisitedRegions).where(
                    VisitedRegions.user_id == uid,
                    VisitedRegions.country_id == country_id,
                )
            )
            record = result.scalar_one_or_none()
            if not record:
                record = VisitedRegions(
                    user_id=uid, country_id=country_id,
                    regions=enc_json(uid, []), dates=enc_json(uid, {}),
                    notes=enc_json(uid, {}), wishlist=enc_json(uid, []),
                )
                db.add(record)
            regions = dec_json_safe(uid, record.regions) or []
            dates = dec_json_safe(uid, record.dates) or {}
            notes = dec_json_safe(uid, record.notes) or {}
            if act == "add":
                if region not in regions:
                    regions.append(region)
            else:
                if region in regions:
                    regions.remove(region)
                dates.pop(region, None)
                notes.pop(region, None)
            record.regions = enc_json(uid, regions)
            record.dates = enc_json(uid, dates)
            record.notes = enc_json(uid, notes)
            record.updated_at = datetime.now(timezone.utc)
            results.append({"action": action, "ok": True})

        elif action == "world_toggle":
            country_code = p.get("country", "")
            act = p.get("action", "")
            if act not in ("add", "remove"):
                results.append({"action": action, "ok": False, "error": "invalid params"})
                continue
            result = await db.execute(
                select(VisitedWorld).where(VisitedWorld.user_id == uid)
            )
            record = result.scalar_one_or_none()
            if not record:
                record = VisitedWorld(user_id=uid, countries=enc_json(uid, []))
                db.add(record)
            countries_list = dec_json_safe(uid, record.countries) or []
            if act == "add":
                if country_code not in countries_list:
                    countries_list.append(country_code)
            else:
                if country_code in countries_list:
                    countries_list.remove(country_code)
            record.countries = enc_json(uid, countries_list)
            record.updated_at = datetime.now(timezone.utc)
            results.append({"action": action, "ok": True})

        elif action == "wishlist_upsert":
            tracker_id = p.get("tracker_id", "")
            region_id = p.get("region_id", "")
            priority = p.get("priority", "medium")
            target_date = p.get("target_date")
            notes_val = p.get("notes")
            category = p.get("category", "solo")
            result = await db.execute(
                select(WishlistItem).where(
                    WishlistItem.user_id == uid,
                    WishlistItem.tracker_id == tracker_id,
                    WishlistItem.region_id == region_id,
                )
            )
            wi = result.scalar_one_or_none()
            if wi:
                wi.priority = enc(uid, priority)
                wi.target_date = enc(uid, target_date) if target_date else None
                wi.notes = enc(uid, notes_val) if notes_val else None
                wi.category = enc(uid, category)
                wi.updated_at = datetime.now(timezone.utc)
            else:
                wi = WishlistItem(
                    user_id=uid, tracker_id=tracker_id, region_id=region_id,
                    priority=enc(uid, priority),
                    target_date=enc(uid, target_date) if target_date else None,
                    notes=enc(uid, notes_val) if notes_val else None,
                    category=enc(uid, category),
                )
                db.add(wi)
            results.append({"action": action, "ok": True})

        elif action == "wishlist_delete":
            tracker_id = p.get("tracker_id", "")
            region_id = p.get("region_id", "")
            del_result = await db.execute(
                delete(WishlistItem).where(
                    WishlistItem.user_id == user.id,
                    WishlistItem.tracker_id == tracker_id,
                    WishlistItem.region_id == region_id,
                )
            )
            results.append({"action": action, "ok": del_result.rowcount > 0})

        else:
            results.append({"action": action, "ok": False, "error": "unknown action"})

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return {"results": results}


# --------------- World visited endpoints ---------------
@app.get("/api/visited-world", response_model=WorldVisitedResponse)
async def get_visited_world(
    response: Response,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "private, max-age=5"
    result = await db.execute(
        select(VisitedWorld).where(VisitedWorld.user_id == user.id)
    )
    record = result.scalar_one_or_none()
    countries = dec_json_safe(user.id, record.countries) if record and record.countries else []
    return WorldVisitedResponse(countries=countries)


@app.put("/api/visited-world", response_model=WorldVisitedResponse)
async def put_visited_world(
    body: WorldVisitedRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VisitedWorld).where(VisitedWorld.user_id == user.id)
    )
    record = result.scalar_one_or_none()

    uid = user.id
    if record:
        record.countries = enc_json(uid, body.countries)
        record.updated_at = datetime.now(timezone.utc)
    else:
        record = VisitedWorld(user_id=uid, countries=enc_json(uid, body.countries))
        db.add(record)

    await db.commit()
    return WorldVisitedResponse(countries=body.countries)


# --------------- Friends endpoints ---------------

@app.get("/api/me")
async def get_me(user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(404, "User not found")

    # Auto-generate friend code if missing
    if not db_user.friend_code:
        db_user.friend_code = generate_friend_code()
        await db.commit()

    # Count stats
    world = await db.execute(select(VisitedWorld).where(VisitedWorld.user_id == user.id))
    world_row = world.scalar_one_or_none()
    countries_count = len(dec_json_safe(db_user.id, world_row.countries) or []) if world_row and world_row.countries else 0

    return {
        "id": db_user.id,
        "name": dec_str_safe(db_user.id, db_user.name),
        "picture": dec_str_safe(db_user.id, db_user.picture),
        "email": db_user.email,
        "friend_code": db_user.friend_code,
        "countries_count": countries_count,
    }


@app.get("/api/user/{friend_code}")
async def get_user_by_code(friend_code: str, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.friend_code == friend_code.upper()))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")
    return {"id": target.id, "name": dec_str_safe(target.id, target.name), "picture": dec_str_safe(target.id, target.picture)}


@app.post("/api/friends/request")
async def send_friend_request(body: FriendRequestCreate, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    code = body.friend_code.upper().strip()
    target = (await db.execute(select(User).where(User.friend_code == code))).scalar_one_or_none()

    if not target:
        raise HTTPException(404, "No user found with that friend code")
    if target.id == user.id:
        raise HTTPException(400, "You can't add yourself")

    # Enforce 50-friend limit
    count = (await db.execute(
        select(func.count()).select_from(Friendship).where(Friendship.user_id == user.id)
    )).scalar()
    if count >= 50:
        raise HTTPException(400, "Friend limit reached (50)")

    # Check existing friendship
    existing = (await db.execute(
        select(Friendship).where(Friendship.user_id == user.id, Friendship.friend_id == target.id)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Already friends")

    # Check duplicate/existing request (in either direction)
    existing_req = (await db.execute(
        select(FriendRequest).where(
            ((FriendRequest.from_user_id == user.id) & (FriendRequest.to_user_id == target.id)) |
            ((FriendRequest.from_user_id == target.id) & (FriendRequest.to_user_id == user.id)),
            FriendRequest.status == "pending"
        )
    )).scalar_one_or_none()
    if existing_req:
        raise HTTPException(400, "A pending request already exists")

    req = FriendRequest(from_user_id=user.id, to_user_id=target.id, status="pending")
    db.add(req)
    await db.commit()
    return {"id": req.id, "status": "pending", "to_user": {"id": target.id, "name": dec_str_safe(target.id, target.name), "picture": dec_str_safe(target.id, target.picture)}}


@app.get("/api/friends/requests")
async def list_friend_requests(user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Incoming
    incoming = (await db.execute(
        select(FriendRequest, User)
        .join(User, FriendRequest.from_user_id == User.id)
        .where(FriendRequest.to_user_id == user.id, FriendRequest.status == "pending")
    )).all()

    # Outgoing
    outgoing = (await db.execute(
        select(FriendRequest, User)
        .join(User, FriendRequest.to_user_id == User.id)
        .where(FriendRequest.from_user_id == user.id, FriendRequest.status == "pending")
    )).all()

    return {
        "incoming": [{"id": r.id, "status": r.status, "created_at": r.created_at.isoformat(),
                       "from_user": {"id": u.id, "name": dec_str_safe(u.id, u.name), "picture": dec_str_safe(u.id, u.picture)}} for r, u in incoming],
        "outgoing": [{"id": r.id, "status": r.status, "created_at": r.created_at.isoformat(),
                       "to_user": {"id": u.id, "name": dec_str_safe(u.id, u.name), "picture": dec_str_safe(u.id, u.picture)}} for r, u in outgoing],
    }


@app.post("/api/friends/requests/{request_id}/accept")
async def accept_friend_request(request_id: int, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    req = (await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))).scalar_one_or_none()
    if not req or req.to_user_id != user.id:
        raise HTTPException(404, "Request not found")
    if req.status != "pending":
        raise HTTPException(400, f"Request already {req.status}")

    req.status = "accepted"
    req.updated_at = datetime.now(timezone.utc)

    # Create bidirectional friendship
    db.add(Friendship(user_id=req.from_user_id, friend_id=req.to_user_id))
    db.add(Friendship(user_id=req.to_user_id, friend_id=req.from_user_id))
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    # Count friends
    count = (await db.execute(
        select(func.count()).select_from(Friendship).where(Friendship.user_id == user.id)
    )).scalar()
    return {"status": "accepted", "friends_count": count}


@app.post("/api/friends/requests/{request_id}/decline")
async def decline_friend_request(request_id: int, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    req = (await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))).scalar_one_or_none()
    if not req or req.to_user_id != user.id:
        raise HTTPException(404, "Request not found")
    if req.status != "pending":
        raise HTTPException(400, f"Request already {req.status}")
    req.status = "declined"
    req.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "declined"}


@app.delete("/api/friends/requests/{request_id}")
async def cancel_friend_request(request_id: int, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    req = (await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))).scalar_one_or_none()
    if not req or req.from_user_id != user.id:
        raise HTTPException(404, "Request not found")
    if req.status != "pending":
        raise HTTPException(400, "Can only cancel pending requests")
    await db.execute(delete(FriendRequest).where(FriendRequest.id == request_id))
    await db.commit()
    return {"status": "cancelled"}


@app.get("/api/friends")
async def list_friends(user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User, Friendship.created_at.label("since"))
        .join(Friendship, Friendship.friend_id == User.id)
        .where(Friendship.user_id == user.id)
    )
    friends = []
    for u, since in result.all():
        # Get countries count
        world = (await db.execute(select(VisitedWorld).where(VisitedWorld.user_id == u.id))).scalar_one_or_none()
        friends.append({
            "id": u.id, "name": dec_str_safe(u.id, u.name), "picture": dec_str_safe(u.id, u.picture),
            "friend_code": u.friend_code,
            "countries_count": len(dec_json_safe(u.id, world.countries) or []) if world and world.countries else 0,
            "since": since.isoformat() if since else None,
        })
    return friends


@app.delete("/api/friends/{friend_id}")
async def remove_friend(friend_id: int, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify friendship exists
    existing = (await db.execute(
        select(Friendship).where(Friendship.user_id == user.id, Friendship.friend_id == friend_id)
    )).scalar_one_or_none()
    if not existing:
        raise HTTPException(404, "Not friends")

    # Delete both directions
    await db.execute(delete(Friendship).where(
        ((Friendship.user_id == user.id) & (Friendship.friend_id == friend_id)) |
        ((Friendship.user_id == friend_id) & (Friendship.friend_id == user.id))
    ))
    await db.commit()
    return {"status": "removed"}


@app.get("/api/friends/{friend_id}/visited")
async def get_friend_visited(friend_id: int, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Validate friendship
    friendship = (await db.execute(
        select(Friendship).where(Friendship.user_id == user.id, Friendship.friend_id == friend_id)
    )).scalar_one_or_none()
    if not friendship:
        raise HTTPException(403, "Not friends")

    # Regions
    regions_result = await db.execute(select(VisitedRegions).where(VisitedRegions.user_id == friend_id))
    regions = [
        {"country_id": r.country_id, "regions": dec_json_safe(friend_id, r.regions) or []}
        for r in regions_result.scalars().all()
    ]

    # World
    world = (await db.execute(select(VisitedWorld).where(VisitedWorld.user_id == friend_id))).scalar_one_or_none()

    return {
        "regions": regions,
        "world": {"countries": dec_json_safe(friend_id, world.countries) if world and world.countries else []},
    }


@app.get("/api/friends/leaderboard")
async def get_leaderboard(user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Get friend IDs
    friends_result = await db.execute(
        select(Friendship.friend_id).where(Friendship.user_id == user.id)
    )
    friend_ids = [r[0] for r in friends_result.all()]
    all_ids = [user.id] + friend_ids

    entries = []
    for uid in all_ids:
        u = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
        if not u:
            continue
        world = (await db.execute(select(VisitedWorld).where(VisitedWorld.user_id == uid))).scalar_one_or_none()
        countries_count = len(dec_json_safe(u.id, world.countries) or []) if world and world.countries else 0

        regions_result = await db.execute(select(VisitedRegions).where(VisitedRegions.user_id == uid))
        regions_count = sum(len(dec_json_safe(u.id, r.regions) or []) for r in regions_result.scalars().all())

        entries.append({
            "user_id": u.id, "name": dec_str_safe(u.id, u.name), "picture": dec_str_safe(u.id, u.picture),
            "countries_count": countries_count, "regions_count": regions_count,
            "is_self": u.id == user.id,
        })

    # Sort by countries descending, then regions
    entries.sort(key=lambda e: (e["countries_count"], e["regions_count"]), reverse=True)
    for i, e in enumerate(entries):
        e["rank"] = i + 1

    return entries


@app.get("/api/friends/activity")
async def get_activity(user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Get friend IDs
    friends_result = await db.execute(
        select(Friendship.friend_id).where(Friendship.user_id == user.id)
    )
    friend_ids = [r[0] for r in friends_result.all()]
    if not friend_ids:
        return []

    # Recent updates (last 30 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    activities = []

    # Region changes
    regions = await db.execute(
        select(VisitedRegions, User)
        .join(User, VisitedRegions.user_id == User.id)
        .where(VisitedRegions.user_id.in_(friend_ids), VisitedRegions.updated_at >= cutoff)
        .order_by(VisitedRegions.updated_at.desc())
        .limit(50)
    )
    for r, u in regions.all():
        activities.append({
            "type": "regions", "user_id": u.id, "name": dec_str_safe(u.id, u.name), "picture": dec_str_safe(u.id, u.picture),
            "country_id": r.country_id, "count": len(dec_json_safe(u.id, r.regions) or []),
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })

    # World changes
    worlds = await db.execute(
        select(VisitedWorld, User)
        .join(User, VisitedWorld.user_id == User.id)
        .where(VisitedWorld.user_id.in_(friend_ids), VisitedWorld.updated_at >= cutoff)
        .order_by(VisitedWorld.updated_at.desc())
        .limit(50)
    )
    for w, u in worlds.all():
        activities.append({
            "type": "world", "user_id": u.id, "name": dec_str_safe(u.id, u.name), "picture": dec_str_safe(u.id, u.picture),
            "count": len(dec_json_safe(u.id, w.countries) or []),
            "updated_at": w.updated_at.isoformat() if w.updated_at else None,
        })

    # Sort combined by updated_at descending, take top 50
    activities.sort(key=lambda a: a.get("updated_at") or "", reverse=True)
    return activities[:50]


# --------------- Challenges endpoints ---------------

TRACKER_MAP = {
    "world": "world",
    "ch": "ch",
    "us": "us",
    "usparks": "usparks",
    "nyc": "nyc",
    "no": "no",
    "ca": "ca",
    "capitals": "capitals",
}


def _get_user_visited_for_tracker(tracker_id: str, regions_data, world_data):
    """Extract relevant visited regions for a given tracker from raw DB data."""
    if tracker_id == "world":
        return set(world_data)
    else:
        return set(regions_data.get(tracker_id, []))


async def _get_visited_for_user(user_id: int, db: AsyncSession):
    """Return (regions_dict, world_list) for a user."""
    result = await db.execute(
        select(VisitedRegions).where(VisitedRegions.user_id == user_id)
    )
    records = result.scalars().all()
    regions = {}
    for r in records:
        regions[r.country_id] = dec_json_safe(user_id, r.regions) or []

    result = await db.execute(
        select(VisitedWorld).where(VisitedWorld.user_id == user_id)
    )
    world_record = result.scalar_one_or_none()
    world = dec_json_safe(user_id, world_record.countries) if world_record and world_record.countries else []

    return regions, world


async def _compute_challenge_progress(challenge, db: AsyncSession):
    """Compute progress for a challenge, returning participant details."""
    target = challenge.target_regions or []
    is_all = target == ["*"]

    participants_result = await db.execute(
        select(ChallengeParticipant, User)
        .join(User, ChallengeParticipant.user_id == User.id)
        .where(ChallengeParticipant.challenge_id == challenge.id)
    )
    participants = participants_result.all()

    participant_progress = []
    all_visited = set()
    total_target = None

    for cp, u in participants:
        regions, world = await _get_visited_for_user(cp.user_id, db)
        user_visited = _get_user_visited_for_tracker(challenge.tracker_id, regions, world)

        if is_all:
            user_matching = user_visited
            if total_target is None:
                # For "all" targets, total is hard to know without data files,
                # so we just track what people have visited
                total_target = -1  # will be set below
        else:
            user_matching = user_visited & set(target)

        all_visited |= user_matching
        participant_progress.append({
            "user_id": u.id,
            "name": dec_str_safe(u.id, u.name),
            "picture": dec_str_safe(u.id, u.picture),
            "visited_count": len(user_matching),
            "visited_regions": list(user_matching),
        })

    if is_all:
        total = len(all_visited) if all_visited else 0
    else:
        total = len(target)

    collab_count = len(all_visited) if not is_all else len(all_visited)
    collab_pct = round(collab_count / total * 100) if total > 0 else 0

    # Check if challenge is completed
    is_completed = collab_pct >= 100 and not challenge.completed_at

    return {
        "participants": participant_progress,
        "total": total,
        "collaborative_count": collab_count,
        "collaborative_pct": collab_pct,
        "is_completed": is_completed,
    }


async def _check_and_award_challenge_completion(challenge, progress, db: AsyncSession):
    """Check if challenge is completed and award XP to participants."""
    if challenge.completed_at:
        return  # Already completed and rewarded

    is_completed = progress.get("is_completed", False)
    if not is_completed:
        return

    # Mark challenge as completed
    challenge.completed_at = datetime.now(timezone.utc)

    # Award XP to participants
    participants_result = await db.execute(
        select(ChallengeParticipant, User)
        .join(User, ChallengeParticipant.user_id == User.id)
        .where(ChallengeParticipant.challenge_id == challenge.id)
    )
    participants = participants_result.all()

    # For collaborative: everyone gets 100 XP
    # For race: top 3 get different amounts
    if challenge.challenge_type == "collaborative":
        for cp, u in participants:
            if cp.xp_awarded == 0:  # Only award once
                xp_amount = 100
                u.xp += xp_amount
                cp.xp_awarded = xp_amount
                db.add(XpLog(
                    user_id=u.id,
                    amount=xp_amount,
                    reason=enc(u.id, "complete_challenge"),
                    tracker_id=challenge.tracker_id,
                ))
    else:  # race
        # Sort by visited count
        sorted_participants = sorted(
            [(cp, u, next((p for p in progress["participants"] if p["user_id"] == u.id), None))
             for cp, u in participants],
            key=lambda x: x[2]["visited_count"] if x[2] else 0,
            reverse=True
        )
        
        # Award XP based on rank
        xp_awards = [250, 150, 100]  # 1st, 2nd, 3rd place
        for i, (cp, u, prog) in enumerate(sorted_participants[:3]):
            if cp.xp_awarded == 0 and prog:  # Only award once
                xp_amount = xp_awards[i]
                u.xp += xp_amount
                cp.xp_awarded = xp_amount
                db.add(XpLog(
                    user_id=u.id,
                    amount=xp_amount,
                    reason=enc(u.id, f"complete_challenge_rank{i+1}"),
                    tracker_id=challenge.tracker_id,
                ))

    await db.commit()


@app.get("/api/challenges")
async def list_challenges(user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List all challenges the current user is participating in."""
    result = await db.execute(
        select(Challenge)
        .join(ChallengeParticipant, ChallengeParticipant.challenge_id == Challenge.id)
        .where(ChallengeParticipant.user_id == user.id)
        .order_by(Challenge.created_at.desc())
    )
    challenges = result.scalars().all()

    out = []
    for c in challenges:
        # Get participant count & avatars
        parts = await db.execute(
            select(User)
            .join(ChallengeParticipant, ChallengeParticipant.user_id == User.id)
            .where(ChallengeParticipant.challenge_id == c.id)
        )
        part_users = parts.scalars().all()

        progress = await _compute_challenge_progress(c, db)

        out.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "tracker_id": c.tracker_id,
            "challenge_type": c.challenge_type,
            "target_regions": c.target_regions,
            "difficulty": c.difficulty,
            "duration": c.duration,
            "end_at": c.end_at.isoformat() if c.end_at else None,
            "created_at": c.created_at.isoformat(),
            "completed_at": c.completed_at.isoformat() if c.completed_at else None,
            "creator_id": c.creator_id,
            "participant_count": len(part_users),
            "participants": [{"id": u.id, "name": dec_str_safe(u.id, u.name), "picture": dec_str_safe(u.id, u.picture)} for u in part_users[:5]],
            "progress": progress,
        })

    return out


@app.post("/api/challenges")
async def create_challenge(body: ChallengeCreate, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Create a new challenge."""
    if body.challenge_type not in ("collaborative", "race"):
        raise HTTPException(400, "challenge_type must be 'collaborative' or 'race'")

    # Limit: max 10 active challenges per user
    count = (await db.execute(
        select(func.count())
        .select_from(ChallengeParticipant)
        .where(ChallengeParticipant.user_id == user.id)
    )).scalar()
    if count >= 10:
        raise HTTPException(
            409,
            "Maximum 10 active challenges reached. Complete or leave a challenge to create a new one."
        )

    # Calculate end_at if duration is specified
    end_at = None
    if body.duration:
        now = datetime.now(timezone.utc)
        if body.duration == "48h":
            end_at = now + timedelta(hours=48)
        elif body.duration == "1w":
            end_at = now + timedelta(weeks=1)
        elif body.duration == "1m":
            end_at = now + timedelta(days=30)

    challenge = Challenge(
        id=generate_challenge_id(),
        creator_id=user.id,
        title=body.title[:100],
        description=(body.description or "")[:500],
        tracker_id=body.tracker_id,
        target_regions=body.target_regions,
        challenge_type=body.challenge_type,
        difficulty=body.difficulty,
        duration=body.duration,
        end_at=end_at,
    )
    db.add(challenge)

    # Auto-join creator
    db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=user.id))

    # Invite friends (auto-join them)
    if body.invite_friend_ids:
        # Validate they are actual friends
        friends_result = await db.execute(
            select(Friendship.friend_id).where(
                Friendship.user_id == user.id,
                Friendship.friend_id.in_(body.invite_friend_ids)
            )
        )
        valid_friend_ids = {r[0] for r in friends_result.all()}

        for fid in valid_friend_ids:
            db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=fid))

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    return {
        "id": challenge.id,
        "title": challenge.title,
        "description": challenge.description,
        "tracker_id": challenge.tracker_id,
        "challenge_type": challenge.challenge_type,
        "target_regions": challenge.target_regions,
        "difficulty": challenge.difficulty,
        "duration": challenge.duration,
        "end_at": challenge.end_at.isoformat() if challenge.end_at else None,
        "created_at": challenge.created_at.isoformat(),
        "creator_id": challenge.creator_id,
    }


@app.get("/api/challenges/{challenge_id}")
async def get_challenge_detail(challenge_id: str, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get full detail of a challenge including progress."""
    challenge = (await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )).scalar_one_or_none()
    if not challenge:
        raise HTTPException(404, "Challenge not found")

    # Verify user is a participant
    is_participant = (await db.execute(
        select(ChallengeParticipant).where(
            ChallengeParticipant.challenge_id == challenge_id,
            ChallengeParticipant.user_id == user.id,
        )
    )).scalar_one_or_none()
    if not is_participant:
        raise HTTPException(403, "You are not a participant in this challenge")

    progress = await _compute_challenge_progress(challenge, db)
    
    # Check for completion and award XP
    await _check_and_award_challenge_completion(challenge, progress, db)

    # Get all participants
    parts = await db.execute(
        select(ChallengeParticipant, User)
        .join(User, ChallengeParticipant.user_id == User.id)
        .where(ChallengeParticipant.challenge_id == challenge_id)
    )

    return {
        "id": challenge.id,
        "title": challenge.title,
        "description": challenge.description,
        "tracker_id": challenge.tracker_id,
        "challenge_type": challenge.challenge_type,
        "target_regions": challenge.target_regions,
        "difficulty": challenge.difficulty,
        "duration": challenge.duration,
        "end_at": challenge.end_at.isoformat() if challenge.end_at else None,
        "created_at": challenge.created_at.isoformat(),
        "completed_at": challenge.completed_at.isoformat() if challenge.completed_at else None,
        "creator_id": challenge.creator_id,
        "participants": [
            {"id": u.id, "name": dec_str_safe(u.id, u.name), "picture": dec_str_safe(u.id, u.picture), "joined_at": cp.joined_at.isoformat()}
            for cp, u in parts.all()
        ],
        "progress": progress,
    }


@app.post("/api/challenges/{challenge_id}/join")
async def join_challenge(challenge_id: str, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Join a challenge (must be friends with creator)."""
    challenge = (await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )).scalar_one_or_none()
    if not challenge:
        raise HTTPException(404, "Challenge not found")

    # Check not already joined
    existing = (await db.execute(
        select(ChallengeParticipant).where(
            ChallengeParticipant.challenge_id == challenge_id,
            ChallengeParticipant.user_id == user.id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Already joined")

    # Max 50 participants
    part_count = (await db.execute(
        select(func.count()).select_from(ChallengeParticipant)
        .where(ChallengeParticipant.challenge_id == challenge_id)
    )).scalar()
    if part_count >= 50:
        raise HTTPException(400, "Challenge is full (max 50 participants)")

    db.add(ChallengeParticipant(challenge_id=challenge_id, user_id=user.id))
    await db.commit()
    return {"status": "joined"}


@app.delete("/api/challenges/{challenge_id}/leave")
async def leave_challenge(challenge_id: str, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Leave a challenge."""
    challenge = (await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )).scalar_one_or_none()
    if not challenge:
        raise HTTPException(404, "Challenge not found")

    participant = (await db.execute(
        select(ChallengeParticipant).where(
            ChallengeParticipant.challenge_id == challenge_id,
            ChallengeParticipant.user_id == user.id,
        )
    )).scalar_one_or_none()
    if not participant:
        raise HTTPException(404, "Not a participant")

    await db.execute(
        delete(ChallengeParticipant).where(
            ChallengeParticipant.challenge_id == challenge_id,
            ChallengeParticipant.user_id == user.id,
        )
    )

    # If creator leaves or 0 participants remain, delete the challenge
    remaining = (await db.execute(
        select(func.count()).select_from(ChallengeParticipant)
        .where(ChallengeParticipant.challenge_id == challenge_id)
    )).scalar()

    if remaining == 0 or challenge.creator_id == user.id:
        await db.execute(delete(ChallengeParticipant).where(ChallengeParticipant.challenge_id == challenge_id))
        await db.execute(delete(Challenge).where(Challenge.id == challenge_id))

    await db.commit()
    return {"status": "left"}


@app.delete("/api/challenges/{challenge_id}")
async def delete_challenge(challenge_id: str, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Delete a challenge (creator only)."""
    challenge = (await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )).scalar_one_or_none()
    if not challenge:
        raise HTTPException(404, "Challenge not found")
    if challenge.creator_id != user.id:
        raise HTTPException(403, "Only the creator can delete a challenge")

    await db.execute(delete(ChallengeParticipant).where(ChallengeParticipant.challenge_id == challenge_id))
    await db.execute(delete(Challenge).where(Challenge.id == challenge_id))
    await db.commit()
    return {"status": "deleted"}


# --------------- Wishlist / Bucket List endpoints ---------------

@app.get("/api/wishlist")
async def get_all_wishlist(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all wishlist items across all trackers."""
    result = await db.execute(
        select(WishlistItem)
        .where(WishlistItem.user_id == user.id)
        .order_by(WishlistItem.created_at.desc())
    )
    items = result.scalars().all()
    uid = user.id
    return [
        {
            "tracker_id": item.tracker_id,
            "region_id": item.region_id,
            "priority": dec_str_safe(uid, item.priority),
            "target_date": dec_str_safe(uid, item.target_date),
            "notes": dec_str_safe(uid, item.notes),
            "category": dec_str_safe(uid, item.category),
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in items
    ]


@app.get("/api/wishlist/{tracker_id}")
async def get_wishlist_for_tracker(
    tracker_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get wishlist items for a specific tracker."""
    result = await db.execute(
        select(WishlistItem)
        .where(WishlistItem.user_id == user.id, WishlistItem.tracker_id == tracker_id)
        .order_by(WishlistItem.created_at.desc())
    )
    items = result.scalars().all()
    uid = user.id
    return [
        {
            "tracker_id": item.tracker_id,
            "region_id": item.region_id,
            "priority": dec_str_safe(uid, item.priority),
            "target_date": dec_str_safe(uid, item.target_date),
            "notes": dec_str_safe(uid, item.notes),
            "category": dec_str_safe(uid, item.category),
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in items
    ]


@app.put("/api/wishlist/{tracker_id}/{region_id}")
async def upsert_wishlist_item(
    tracker_id: str,
    region_id: str,
    body: WishlistItemCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add or update a wishlist item."""
    if body.priority not in ("high", "medium", "low"):
        raise HTTPException(400, "priority must be 'high', 'medium', or 'low'")
    if body.category not in ("solo", "friends", "family", "work"):
        raise HTTPException(400, "category must be 'solo', 'friends', 'family', or 'work'")

    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.user_id == user.id,
            WishlistItem.tracker_id == tracker_id,
            WishlistItem.region_id == region_id,
        )
    )
    item = result.scalar_one_or_none()
    uid = user.id

    if item:
        item.priority = enc(uid, body.priority)
        item.target_date = enc(uid, body.target_date) if body.target_date else None
        item.notes = enc(uid, body.notes) if body.notes else None
        item.category = enc(uid, body.category)
        item.updated_at = datetime.now(timezone.utc)
    else:
        item = WishlistItem(
            user_id=uid,
            tracker_id=tracker_id,
            region_id=region_id,
            priority=enc(uid, body.priority),
            target_date=enc(uid, body.target_date) if body.target_date else None,
            notes=enc(uid, body.notes) if body.notes else None,
            category=enc(uid, body.category),
        )
        db.add(item)

    await db.commit()
    return {
        "tracker_id": item.tracker_id,
        "region_id": item.region_id,
        "priority": body.priority,
        "target_date": body.target_date,
        "notes": body.notes,
        "category": body.category,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@app.patch("/api/wishlist/{tracker_id}/{region_id}")
async def patch_wishlist_item(
    tracker_id: str,
    region_id: str,
    body: WishlistItemUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Partially update a wishlist item."""
    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.user_id == user.id,
            WishlistItem.tracker_id == tracker_id,
            WishlistItem.region_id == region_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Wishlist item not found")

    uid = user.id
    if body.priority is not None:
        if body.priority not in ("high", "medium", "low"):
            raise HTTPException(400, "priority must be 'high', 'medium', or 'low'")
        item.priority = enc(uid, body.priority)
    if body.target_date is not None:
        item.target_date = enc(uid, body.target_date) if body.target_date else None
    if body.notes is not None:
        item.notes = enc(uid, body.notes) if body.notes else None
    if body.category is not None:
        if body.category not in ("solo", "friends", "family", "work"):
            raise HTTPException(400, "category must be 'solo', 'friends', 'family', or 'work'")
        item.category = enc(uid, body.category)

    item.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "tracker_id": item.tracker_id,
        "region_id": item.region_id,
        "priority": body.priority if body.priority is not None else dec_str_safe(uid, item.priority),
        "target_date": body.target_date if body.target_date is not None else dec_str_safe(uid, item.target_date),
        "notes": body.notes if body.notes is not None else dec_str_safe(uid, item.notes),
        "category": body.category if body.category is not None else dec_str_safe(uid, item.category),
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@app.delete("/api/wishlist/{tracker_id}/{region_id}")
async def delete_wishlist_item(
    tracker_id: str,
    region_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a wishlist item."""
    result = await db.execute(
        delete(WishlistItem).where(
            WishlistItem.user_id == user.id,
            WishlistItem.tracker_id == tracker_id,
            WishlistItem.region_id == region_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Wishlist item not found")
    await db.commit()
    return {"status": "deleted"}


# --------------- XP / Leveling endpoints ---------------
import math


def _xp_for_level(level: int) -> int:
    """XP needed to advance from `level` to level+1."""
    if level <= 1:
        return 0
    return round(50 * math.pow(level, 1.5))


def _level_from_xp(total_xp: int) -> dict:
    level = 1
    cumulative = 0
    while True:
        next_xp = _xp_for_level(level + 1)
        if cumulative + next_xp > total_xp:
            break
        cumulative += next_xp
        level += 1
    return {
        "level": level,
        "current_xp": total_xp - cumulative,
        "next_level_xp": _xp_for_level(level + 1),
    }


class AddXpRequest(BaseModel):
    amount: int
    reason: str
    tracker_id: str | None = None


class XpResponse(BaseModel):
    total_xp: int
    level: int
    current_xp: int
    next_level_xp: int
    xp_gained: int | None = None


@app.get("/api/user/xp", response_model=XpResponse)
async def get_user_xp(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get total XP, level, and progress for the current user."""
    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(404, "User not found")

    total_xp = db_user.xp or 0
    info = _level_from_xp(total_xp)

    return XpResponse(
        total_xp=total_xp,
        level=info["level"],
        current_xp=info["current_xp"],
        next_level_xp=info["next_level_xp"],
    )


@app.post("/api/user/xp", response_model=XpResponse)
async def add_user_xp(
    body: AddXpRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply a signed XP delta for the current user and log the effective change."""
    if body.amount == 0:
        raise HTTPException(400, "Amount must be non-zero")
    if body.amount < -500 or body.amount > 500:
        raise HTTPException(400, "Amount out of range")

    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(404, "User not found")

    old_xp = db_user.xp or 0
    new_xp = max(0, old_xp + body.amount)
    applied_delta = new_xp - old_xp
    new_level_info = _level_from_xp(new_xp)

    db_user.xp = new_xp
    db_user.level = new_level_info["level"]

    # Log the effective XP transaction (can be 0 when negative delta is clamped at 0 total XP).
    log_entry = XpLog(
        user_id=user.id,
        amount=applied_delta,
        reason=enc(user.id, body.reason),
        tracker_id=body.tracker_id,
    )
    db.add(log_entry)

    await db.commit()

    return XpResponse(
        total_xp=new_xp,
        level=new_level_info["level"],
        current_xp=new_level_info["current_xp"],
        next_level_xp=new_level_info["next_level_xp"],
        xp_gained=applied_delta,
    )


# --------------- Health check ---------------
@app.get("/api/health")
async def health():
    """Liveness check — no auth, no DB. For uptime monitors."""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
