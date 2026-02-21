import os
import logging
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://tracker:tracker@postgres:5432/tracker",
)

# Handle Neon/Vercel connection strings that use postgres:// or postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Detect if we're running on Vercel/Neon (needs SSL + small pool)
IS_SERVERLESS = os.getenv("VERCEL", "") == "1" or "neon" in DATABASE_URL

connect_args = {}
if IS_SERVERLESS:
    connect_args["ssl"] = "require"

# Serverless: use NullPool (no persistent connections) to avoid cold-start DNS issues
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
