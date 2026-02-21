from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
try:
    from backend.database import Base
except ImportError:
    from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    google_id = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=False)
    name = Column(String, nullable=True)
    picture = Column(String, nullable=True)

    visited_regions = relationship("VisitedRegions", back_populates="user", cascade="all, delete-orphan")
    visited_world = relationship("VisitedWorld", back_populates="user", cascade="all, delete-orphan", uselist=False)


class VisitedRegions(Base):
    __tablename__ = "visited_regions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    country_id = Column(String(10), nullable=False)
    regions = Column(JSONB, nullable=False, default=list)
    dates = Column(JSONB, nullable=False, server_default="{}", default=dict)
    notes = Column(JSONB, nullable=False, server_default="{}", default=dict)
    wishlist = Column(JSONB, nullable=False, server_default="[]", default=list)

    user = relationship("User", back_populates="visited_regions")

    __table_args__ = (
        UniqueConstraint("user_id", "country_id", name="uq_user_country"),
    )


class VisitedWorld(Base):
    __tablename__ = "visited_world"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    countries = Column(JSONB, nullable=False, default=list)

    user = relationship("User", back_populates="visited_world")
