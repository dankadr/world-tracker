"""
Database configuration for Travel Tracker.

Supports two deployment modes:
- **Docker / local**: Uses asyncpg driver with connection pooling.
- **Vercel serverless (Neon)**: Uses psycopg driver with NullPool and SSL.

Environment variable priority for the connection string:
  1. DATABASE_URL
  2. POSTGRES_URL          (Vercel Neon integration sets this)
  3. Individual PG* vars   (PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT)
  4. Docker-compose default (postgresql+asyncpg://tracker:tracker@postgres:5432/tracker)
"""

import os
import logging
import sys
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

# ---------------------------------------------------------------------------
# Logging – use a structured format that shows up nicely in Vercel's log panel
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(name)s  %(message)s",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger("travel-tracker.db")

# ---------------------------------------------------------------------------
# Detect environment
# ---------------------------------------------------------------------------
IS_SERVERLESS = os.getenv("VERCEL", "") == "1"

# Choose the async driver: psycopg on Vercel (asyncpg DNS fails in Lambda), asyncpg locally
DRIVER = "psycopg" if IS_SERVERLESS else "asyncpg"

# ---------------------------------------------------------------------------
# Helper: read env var with optional Neon-integration prefix
# Vercel's Neon integration namespaces vars, e.g. db_world_tracker_DATABASE_URL
# ---------------------------------------------------------------------------
_NEON_PREFIX = "db_world_tracker_"


def _env(name: str, default: str = "") -> str:
    """Return env var by *name*, falling back to the Neon-prefixed variant."""
    return os.getenv(name) or os.getenv(f"{_NEON_PREFIX}{name}") or default


# ---------------------------------------------------------------------------
# Resolve DATABASE_URL
# ---------------------------------------------------------------------------
DATABASE_URL = (
    _env("DATABASE_URL")
    or _env("POSTGRES_URL")                # Vercel Neon integration
    or _env("POSTGRES_URL_NON_POOLING")
    or ""
)

if not DATABASE_URL:
    # Try individual PG* env vars (Neon also sets these)
    pg_host = _env("PGHOST")
    pg_user = _env("PGUSER")
    pg_password = _env("PGPASSWORD")
    pg_database = _env("PGDATABASE")
    pg_port = _env("PGPORT", "5432")
    if pg_host and pg_user and pg_database:
        DATABASE_URL = (
            f"postgresql+{DRIVER}://{pg_user}:{pg_password}"
            f"@{pg_host}:{pg_port}/{pg_database}?sslmode=require"
        )
        logger.info("DB URL built from PG* env vars (host=%s)", pg_host)
    else:
        # Local Docker fallback
        DATABASE_URL = f"postgresql+{DRIVER}://tracker:tracker@postgres:5432/tracker"
        logger.info("Using Docker-compose fallback DB URL")
else:
    logger.info("DB URL loaded from environment variable")

# ---------------------------------------------------------------------------
# Normalise the scheme to use our chosen async driver
# ---------------------------------------------------------------------------
_SCHEME_PREFIXES = (
    "postgres://",
    "postgresql://",
    "postgresql+asyncpg://",
    "postgresql+psycopg://",
)
for _prefix in _SCHEME_PREFIXES:
    if DATABASE_URL.startswith(_prefix):
        DATABASE_URL = DATABASE_URL.replace(_prefix, f"postgresql+{DRIVER}://", 1)
        break

# Auto-detect Neon even when VERCEL env var isn't set
if "neon" in DATABASE_URL:
    IS_SERVERLESS = True

# ---------------------------------------------------------------------------
# Ensure sslmode=require is in the URL query string (not connect_args)
# This avoids psycopg3 edge cases where conninfo keyword conflicts with URL params.
# ---------------------------------------------------------------------------
_parsed = urlparse(DATABASE_URL)
_qs = parse_qs(_parsed.query)
if IS_SERVERLESS and "sslmode" not in _qs:
    _qs["sslmode"] = ["require"]
    DATABASE_URL = urlunparse(_parsed._replace(query=urlencode(_qs, doseq=True)))

# ---------------------------------------------------------------------------
# Log sanitised URL (mask password)
# ---------------------------------------------------------------------------
_safe_url = DATABASE_URL
if "@" in _safe_url:
    _before_at = _safe_url.split("@")[0]
    _after_at = _safe_url.split("@", 1)[1]
    # Mask password portion (between : and @)
    if ":" in _before_at:
        _scheme_user = _before_at.rsplit(":", 1)[0]
        _safe_url = f"{_scheme_user}:***@{_after_at}"

logger.info("driver=%s  serverless=%s  url=%s", DRIVER, IS_SERVERLESS, _safe_url)

# ---------------------------------------------------------------------------
# Engine configuration
# ---------------------------------------------------------------------------
connect_args: dict = {}
if IS_SERVERLESS:
    connect_args["connect_timeout"] = 10   # seconds – avoid hanging cold starts

engine_kwargs: dict = {
    "echo": False,
    "connect_args": connect_args,
}

if IS_SERVERLESS:
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs.update(
        pool_size=5,
        max_overflow=10,
        pool_recycle=3600,
        pool_pre_ping=True,  # verify connections before reuse
    )

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency – yields an async DB session."""
    async with async_session() as session:
        yield session


async def init_db():
    """Create tables if they don't exist.

    On serverless cold starts the database should already have the schema.
    Failures are logged but do not crash the app so the function can still
    serve requests (the first actual query will surface any real DB issue).
    """
    logger.info("init_db: creating tables …")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("init_db: success")
    except Exception as e:
        if IS_SERVERLESS:
            logger.warning("init_db skipped on serverless cold start: %s", e)
        else:
            logger.error("init_db failed: %s", e)
            raise
