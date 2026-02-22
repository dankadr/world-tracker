import random
import string
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
try:
    from backend.database import Base
except ImportError:
    from database import Base


def generate_friend_code(length=8):
    """Generate a random 8-char alphanumeric code like 'AXQJ7K2M'."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    google_id = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=False)
    name = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    friend_code = Column(String(8), unique=True, nullable=True, index=True)

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
    updated_at = Column(DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="visited_regions")

    __table_args__ = (
        UniqueConstraint("user_id", "country_id", name="uq_user_country"),
    )


class VisitedWorld(Base):
    __tablename__ = "visited_world"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    countries = Column(JSONB, nullable=False, default=list)
    updated_at = Column(DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="visited_world")


class FriendRequest(Base):
    __tablename__ = "friend_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(10), nullable=False, default="pending")  # pending / accepted / declined
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])

    __table_args__ = (
        UniqueConstraint("from_user_id", "to_user_id", name="uq_friend_request"),
    )


class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    friend_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
    friend = relationship("User", foreign_keys=[friend_id])

    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friendship"),
    )
