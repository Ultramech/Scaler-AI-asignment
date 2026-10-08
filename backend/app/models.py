import secrets
import string
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

ID_ALPHABET = string.ascii_uppercase + string.digits


def new_zone_id() -> str:
    """Route 53 hosted zone IDs look like Z0339963VQYFAZU1F154."""
    return "Z" + "".join(secrets.choice(ID_ALPHABET) for _ in range(19))


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class HostedZone(Base):
    __tablename__ = "hosted_zones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_zone_id)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    comment: Mapped[str] = mapped_column(String, default="")
    private_zone: Mapped[bool] = mapped_column(Boolean, default=False)
    vpc_region: Mapped[str] = mapped_column(String, default="")
    vpc_id: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    query_log_group: Mapped[str] = mapped_column(String, default="")
    accelerated_recovery: Mapped[bool] = mapped_column(Boolean, default=False)
    dnssec_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    dnssec_ksk_name: Mapped[str] = mapped_column(String, default="")
    dnssec_enabled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    records: Mapped[list["DNSRecord"]] = relationship(back_populates="zone", cascade="all, delete-orphan")
    tags: Mapped[list["HostedZoneTag"]] = relationship(
        back_populates="zone", cascade="all, delete-orphan", order_by="HostedZoneTag.id"
    )


class HostedZoneTag(Base):
    __tablename__ = "hosted_zone_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id"), index=True)
    key: Mapped[str] = mapped_column(String)
    value: Mapped[str] = mapped_column(String, default="")
    zone: Mapped[HostedZone] = relationship(back_populates="tags")


class DNSRecord(Base):
    __tablename__ = "dns_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id"), index=True)
    name: Mapped[str] = mapped_column(String, index=True)
    type: Mapped[str] = mapped_column(String)
    # Multi-value records (NS, MX, several A addresses...) keep one value per line.
    value: Mapped[str] = mapped_column(String)
    ttl: Mapped[int] = mapped_column(Integer, default=300)
    routing_policy: Mapped[str] = mapped_column(String, default="Simple")
    alias: Mapped[bool] = mapped_column(Boolean, default=False)
    evaluate_target_health: Mapped[bool] = mapped_column(Boolean, default=False)
    set_identifier: Mapped[str] = mapped_column(String, default="")
    zone: Mapped[HostedZone] = relationship(back_populates="records")
