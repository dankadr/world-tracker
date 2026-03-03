import sys
import os

# Make the backend/ directory importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timedelta, timezone

# Patch init_db BEFORE importing main so the app lifespan doesn't try to
# connect to Postgres during tests.
import database
database.init_db = AsyncMock()

import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt as jose_jwt
from main import app, get_db

# Re-use the same secret the app uses in test environments
_JWT_SECRET = "change-me-in-production-please"
_JWT_ALGORITHM = "HS256"


def make_token(user_id: int = 1, email: str = "test@example.com") -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jose_jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {make_token()}"}


@pytest.fixture
def mock_db():
    db = AsyncMock()
    # db.add is sync in SQLAlchemy — use MagicMock to avoid "coroutine never awaited" warnings
    db.add = MagicMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    result.scalars.return_value.all.return_value = []
    result.scalar.return_value = 0
    result.all.return_value = []
    db.execute.return_value = result
    return db


@pytest.fixture
async def client(mock_db):
    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)
