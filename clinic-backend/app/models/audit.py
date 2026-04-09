import uuid
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class AuditLog(Base, UUIDMixin, TimestampMixin):
    """
    Immutable log of all write operations across the system.
    Records who changed what, when, and from where.
    """
    __tablename__ = "audit_logs"

    clinic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    action: Mapped[str] = mapped_column(String(50), nullable=False)    # create | update | delete
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "patient"
    resource_id: Mapped[str | None] = mapped_column(String(100))       # UUID of affected record

    changes: Mapped[dict | None] = mapped_column(JSONB)   # {field: {old: ..., new: ...}}
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)
