import uuid
import enum
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.clinic import Clinic


class UserRole(str, enum.Enum):
    SUPERADMIN   = "superadmin"    # Platform-level (DentFlow team)
    CLINIC_OWNER = "clinic_owner"  # Owns/manages a clinic
    DOCTOR       = "doctor"        # Treats patients
    RECEPTIONIST = "receptionist"  # Front desk, scheduling
    NURSE        = "nurse"         # Clinical support
    COMPOUNDER   = "compounder"    # Pharmacy / dispensary


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    clinic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=True
    )  # NULL only for superadmin

    # Identity
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False)

    # Profile
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    avatar_url: Mapped[str | None] = mapped_column(String(500))

    # Doctor-specific
    specialization: Mapped[str | None] = mapped_column(String(100))
    mci_number: Mapped[str | None] = mapped_column(String(50))   # Medical Council of India registration

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    clinic: Mapped["Clinic | None"] = relationship("Clinic", back_populates="users")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
