"""
Travel Tracker API – FastAPI application.

Works in two modes:
- Docker (uvicorn):   ``uvicorn main:app --reload``
- Vercel serverless:  imported by ``api/index.py``
"""

import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Depends, HTTPException, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

# Conditional imports: allow running from repo root (Vercel) or backend/ (Docker)
try:
    from backend.database import get_db, init_db, engine
    from backend.models import User, VisitedRegions, VisitedWorld
except ImportError:
    from database import get_db, init_db, engine
    from models import User, VisitedRegions, VisitedWorld

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(name)s  %(message)s",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger("travel-tracker.api")

# --------------- Config ---------------
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-please")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

VALID_COUNTRIES = {"ch", "us", "usparks", "nyc", "no", "ca"}


# --------------- Lifespan ---------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Startup: initialising database …")
    await init_db()
    logger.info("Startup complete")
    yield
    logger.info("Shutdown")


app = FastAPI(title="Travel Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Middleware – request logging (visible in Vercel Logs)
# ---------------------------------------------------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.time() - start) * 1000
        logger.exception(
            "UNHANDLED  %s %s  %.0fms", request.method, request.url.path, duration_ms
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
    duration_ms = (time.time() - start) * 1000
    logger.info(
        "%s  %s %s  %.0fms",
        response.status_code,
        request.method,
        request.url.path,
        duration_ms,
    )
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


# --------------- Auth endpoint ---------------
@app.post("/auth/google", response_model=GoogleLoginResponse)
async def google_login(body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
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
        user.name = name
        user.picture = picture
        logger.info("User updated: id=%s email=%s", user.id, email)
    else:
        user = User(google_id=google_id, email=email, name=name, picture=picture)
        db.add(user)
        logger.info("New user created: email=%s", email)

    await db.flush()
    await db.commit()

    jwt_token = create_jwt(user.id, user.email)

    return GoogleLoginResponse(
        jwt_token=jwt_token,
        user={"id": user.id, "email": user.email, "name": user.name, "picture": user.picture},
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
    regions_data = {}
    for r in records:
        regions_data[r.country_id] = {
            "country_id": r.country_id,
            "regions": r.regions or [],
            "dates": r.dates or {},
            "notes": r.notes or {},
            "wishlist": r.wishlist or [],
        }

    result = await db.execute(
        select(VisitedWorld).where(VisitedWorld.user_id == user.id)
    )
    world_record = result.scalar_one_or_none()
    world_countries = world_record.countries if world_record else []

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
    regions = record.regions if record else []
    dates = record.dates if record and record.dates else {}
    notes = record.notes if record and record.notes else {}
    wishlist = record.wishlist if record and record.wishlist else []
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

    if record:
        record.regions = body.regions
        if body.dates is not None:
            record.dates = body.dates
        if body.notes is not None:
            record.notes = body.notes
        if body.wishlist is not None:
            record.wishlist = body.wishlist
    else:
        record = VisitedRegions(
            user_id=user.id,
            country_id=country_id,
            regions=body.regions,
            dates=body.dates or {},
            notes=body.notes or {},
            wishlist=body.wishlist or [],
        )
        db.add(record)

    await db.commit()
    return VisitedResponse(
        country_id=country_id,
        regions=record.regions,
        dates=record.dates or {},
        notes=record.notes or {},
        wishlist=record.wishlist or [],
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

    if not record:
        record = VisitedRegions(
            user_id=user.id,
            country_id=country_id,
            regions=[],
            dates={},
            notes={},
            wishlist=[],
        )
        db.add(record)

    regions = list(record.regions or [])
    dates = dict(record.dates or {})
    notes = dict(record.notes or {})

    if body.action == "add":
        if body.region not in regions:
            regions.append(body.region)
    else:
        if body.region in regions:
            regions.remove(body.region)
        dates.pop(body.region, None)
        notes.pop(body.region, None)

    record.regions = regions
    record.dates = dates
    record.notes = notes

    await db.commit()
    return VisitedResponse(
        country_id=country_id,
        regions=record.regions or [],
        dates=record.dates or {},
        notes=record.notes or {},
        wishlist=record.wishlist or [],
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

    if not record:
        record = VisitedRegions(
            user_id=user.id,
            country_id=country_id,
            regions=[],
            dates={},
            notes={},
            wishlist=[],
        )
        db.add(record)

    wishlist = list(record.wishlist or [])

    if body.action == "add":
        if body.region not in wishlist:
            wishlist.append(body.region)
    else:
        if body.region in wishlist:
            wishlist.remove(body.region)

    record.wishlist = wishlist

    await db.commit()
    return VisitedResponse(
        country_id=country_id,
        regions=record.regions or [],
        dates=record.dates or {},
        notes=record.notes or {},
        wishlist=record.wishlist or [],
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

    if not record:
        record = VisitedWorld(user_id=user.id, countries=[])
        db.add(record)

    countries = list(record.countries or [])

    if body.action == "add":
        if body.country not in countries:
            countries.append(body.country)
    else:
        if body.country in countries:
            countries.remove(body.country)

    record.countries = countries

    await db.commit()
    return WorldVisitedResponse(countries=record.countries)


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
    countries = record.countries if record else []
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

    if record:
        record.countries = body.countries
    else:
        record = VisitedWorld(user_id=user.id, countries=body.countries)
        db.add(record)

    await db.commit()
    return WorldVisitedResponse(countries=record.countries)


# --------------- Health check ---------------
@app.get("/api/health")
async def health():
    """Basic health check. Pings the database to verify connectivity."""
    db_ok = False
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        logger.warning("Health check DB ping failed: %s", exc)

    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
    }
