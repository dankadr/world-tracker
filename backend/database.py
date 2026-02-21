import os
import logging
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Detect if we're running on Vercel (needs SSL, NullPool, and psycopg driver)
IS_SERVERLESS = os.getenv("VERCEL", "") == "1"

# Choose the async driver: psycopg on Vercel (asyncpg DNS fails in Lambda), asyncpg locally
DRIVER = "psycopg" if IS_SERVERLESS else "asyncpg"

# If no DATABASE_URL, try to build one from individual PG* env vars (Vercel/Neon)
if not DATABASE_URL:
    pg_host = os.getenv("PGHOST", "")
    pg_user = os.getenv("PGUSER", "")
    pg_password = os.getenv("PGPASSWORD", "")
    pg_database = os.getenv("PGDATABASE", "")
    pg_port = os.getenv("PGPORT", "5432")
    if pg_host and pg_user and pg_database:
        DATABASE_URL = f"postgresql+{DRIVER}://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}"
    else:
        # Local Docker fallback
        DATABASE_URL = f"postgresql+{DRIVER}://tracker:tracker@postgres:5432/tracker"
else:
    # Normalise whatever scheme was provided to use the chosen driver
    for prefix in ("postgres://", "postgresql://", "postgresql+asyncpg://", "postgresql+psycopg://"):
        if DATABASE_URL.startswith(prefix):
            DATABASE_URL = DATABASE_URL.replace(prefix, f"postgresql+{DRIVER}://", 1)
            break

if "neon" in DATABASE_URL:
    IS_SERVERLESS = True

connect_args = {}
if IS_SERVERLESS:
    connect_args["sslmode"] = "require"

# Serverless: use NullPool (no persistent connections)
engine_kwargs = dict(
    echo=False,
    connect_args=connect_args,
)
if IS_SERVERLESS:
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs.update(
        pool_size=5,
        max_overflow=10,
        pool_recycle=3600,
    )

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        # On serverless cold starts, DNS may not be ready yet.
        # Tables should already exist in production; log and continue.
        if IS_SERVERLESS:
            logger.warning("init_db skipped on serverless cold start: %s", e)
        else:
            raise
