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
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

# Conditional imports: allow running from repo root (Vercel) or backend/ (Docker)
try:
    from backend.database import get_db, init_db, engine
    from backend.models import User, VisitedRegions, VisitedWorld, FriendRequest, Friendship, generate_friend_code
except ImportError:
    from database import get_db, init_db, engine
    from models import User, VisitedRegions, VisitedWorld, FriendRequest, Friendship, generate_friend_code

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

VALID_COUNTRIES = {"ch", "us", "usparks", "nyc", "no", "ca", "capitals"}


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


class FriendRequestCreate(BaseModel):
    friend_code: str


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
        record.updated_at = datetime.now(timezone.utc)
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
    record.updated_at = datetime.now(timezone.utc)

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
    record.updated_at = datetime.now(timezone.utc)

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
    record.updated_at = datetime.now(timezone.utc)

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
        record.updated_at = datetime.now(timezone.utc)
    else:
        record = VisitedWorld(user_id=user.id, countries=body.countries)
        db.add(record)

    await db.commit()
    return WorldVisitedResponse(countries=record.countries)


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
    countries_count = len(world_row.countries) if world_row else 0

    return {
        "id": db_user.id,
        "name": db_user.name,
        "picture": db_user.picture,
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
    return {"id": target.id, "name": target.name, "picture": target.picture}


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
    return {"id": req.id, "status": "pending", "to_user": {"id": target.id, "name": target.name, "picture": target.picture}}


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
                       "from_user": {"id": u.id, "name": u.name, "picture": u.picture}} for r, u in incoming],
        "outgoing": [{"id": r.id, "status": r.status, "created_at": r.created_at.isoformat(),
                       "to_user": {"id": u.id, "name": u.name, "picture": u.picture}} for r, u in outgoing],
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
    await db.commit()

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
            "id": u.id, "name": u.name, "picture": u.picture,
            "friend_code": u.friend_code,
            "countries_count": len(world.countries) if world else 0,
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
    regions = [{"country_id": r.country_id, "regions": r.regions} for r in regions_result.scalars().all()]

    # World
    world = (await db.execute(select(VisitedWorld).where(VisitedWorld.user_id == friend_id))).scalar_one_or_none()

    return {
        "regions": regions,
        "world": {"countries": world.countries if world else []},
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
        countries_count = len(world.countries) if world else 0

        regions_result = await db.execute(select(VisitedRegions).where(VisitedRegions.user_id == uid))
        regions_count = sum(len(r.regions) for r in regions_result.scalars().all())

        entries.append({
            "user_id": u.id, "name": u.name, "picture": u.picture,
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
            "type": "regions", "user_id": u.id, "name": u.name, "picture": u.picture,
            "country_id": r.country_id, "count": len(r.regions),
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
            "type": "world", "user_id": u.id, "name": u.name, "picture": u.picture,
            "count": len(w.countries),
            "updated_at": w.updated_at.isoformat() if w.updated_at else None,
        })

    # Sort combined by updated_at descending, take top 50
    activities.sort(key=lambda a: a.get("updated_at") or "", reverse=True)
    return activities[:50]


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
