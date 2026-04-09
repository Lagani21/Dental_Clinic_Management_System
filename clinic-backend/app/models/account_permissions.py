import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import UUIDMixin


class AccountPermission(Base):
    """Per-account permission override. One row per (account, permission)."""
    __tablename__ = "account_permissions"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    permission: Mapped[str] = mapped_column(
        String(100), primary_key=True, nullable=False
    )
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class PermissionAuditLog(Base, UUIDMixin):
    """Immutable record of every permission change."""
    __tablename__ = "permission_audit_log"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission: Mapped[str] = mapped_column(String(100), nullable=False)
    old_value: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    new_value: Mapped[bool] = mapped_column(Boolean, nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
