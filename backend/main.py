import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, init_db
from models import User, VisitedRegions

# --------------- Config ---------------
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-please")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

VALID_COUNTRIES = {"ch", "us", "no", "ca"}


# --------------- Lifespan ---------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Travel Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------- Schemas ---------------
class GoogleLoginRequest(BaseModel):
    token: str


class GoogleLoginResponse(BaseModel):
    jwt_token: str
    user: dict


class VisitedRequest(BaseModel):
    regions: list[str]


class VisitedResponse(BaseModel):
    country_id: str
    regions: list[str]


# --------------- Auth helpers ---------------
def create_jwt(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# --------------- Auth endpoint ---------------
@app.post("/auth/google", response_model=GoogleLoginResponse)
async def google_login(body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")

    try:
        idinfo = id_token.verify_oauth2_token(
            body.token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
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
    else:
        user = User(google_id=google_id, email=email, name=name, picture=picture)
        db.add(user)

    await db.commit()
    await db.refresh(user)

    jwt_token = create_jwt(user.id, user.email)

    return GoogleLoginResponse(
        jwt_token=jwt_token,
        user={"id": user.id, "email": user.email, "name": user.name, "picture": user.picture},
    )


# --------------- Visited endpoints ---------------
@app.get("/api/visited/{country_id}", response_model=VisitedResponse)
async def get_visited(
    country_id: str,
    user: User = Depends(get_current_user),
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
    regions = record.regions if record else []
    return VisitedResponse(country_id=country_id, regions=regions)


@app.put("/api/visited/{country_id}", response_model=VisitedResponse)
async def put_visited(
    country_id: str,
    body: VisitedRequest,
    user: User = Depends(get_current_user),
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
    else:
        record = VisitedRegions(user_id=user.id, country_id=country_id, regions=body.regions)
        db.add(record)

    await db.commit()
    await db.refresh(record)
    return VisitedResponse(country_id=country_id, regions=record.regions)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
