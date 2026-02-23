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
    xp = Column(Integer, nullable=False, server_default="0", default=0)
    level = Column(Integer, nullable=False, server_default="1", default=1)

    visited_regions = relationship("VisitedRegions", back_populates="user", cascade="all, delete-orphan")
    visited_world = relationship("VisitedWorld", back_populates="user", cascade="all, delete-orphan", uselist=False)
    xp_logs = relationship("XpLog", back_populates="user", cascade="all, delete-orphan")


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


class WishlistItem(Base):
    __tablename__ = "wishlist"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tracker_id = Column(String(20), nullable=False)  # country_id or 'world'
    region_id = Column(String(50), nullable=False)
    priority = Column(String(10), nullable=False, default="medium")  # high | medium | low
    target_date = Column(String(7), nullable=True)  # YYYY-MM format
    notes = Column(String, nullable=True)
    category = Column(String(20), nullable=False, default="solo")  # solo | friends | family | work
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="wishlist_items")

    __table_args__ = (
        UniqueConstraint("user_id", "tracker_id", "region_id", name="uq_wishlist_item"),
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


class XpLog(Base):
    __tablename__ = "xp_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)  # 'visit_region', 'visit_country', 'unlock_achievement', etc.
    tracker_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="xp_logs")


def generate_challenge_id():
    """Generate a random 12-char alphanumeric challenge ID."""
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choices(chars, k=12))


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(String, primary_key=True, default=generate_challenge_id)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    tracker_id = Column(String, nullable=False)  # e.g. 'world', 'ch', 'us'
    target_regions = Column(JSONB, nullable=False, default=list)  # list of region IDs or ['*']
    challenge_type = Column(String, nullable=False, default="collaborative")  # 'collaborative' | 'race'
    difficulty = Column(String, nullable=True)  # 'easy' | 'medium' | 'hard' | null
    duration = Column(String, nullable=True)  # 'open-ended' | '48h' | '1w' | '1m' | null
    end_at = Column(DateTime(timezone=True), nullable=True)  # deadline for timed challenges
    completed_at = Column(DateTime(timezone=True), nullable=True)  # timestamp when challenge was completed
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    creator = relationship("User", foreign_keys=[creator_id])
    participants = relationship("ChallengeParticipant", back_populates="challenge", cascade="all, delete-orphan")


class ChallengeParticipant(Base):
    __tablename__ = "challenge_participants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    challenge_id = Column(String, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    xp_awarded = Column(Integer, nullable=False, default=0)  # XP awarded for completion

    challenge = relationship("Challenge", back_populates="participants")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("challenge_id", "user_id", name="uq_challenge_participant"),
    )
