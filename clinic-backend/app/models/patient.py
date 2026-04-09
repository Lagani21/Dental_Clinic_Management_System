import uuid
import enum
from typing import TYPE_CHECKING
from sqlalchemy import String, Date, Text, ForeignKey, Enum as SAEnum, Boolean, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.clinic import Clinic
    from app.models.user import User
    from app.models.appointment import Appointment


class BloodGroup(str, enum.Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"
    UNKNOWN = "unknown"


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Patient(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "patients"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Identity
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    gender: Mapped[Gender] = mapped_column(SAEnum(Gender), nullable=False)
    date_of_birth: Mapped[str | None] = mapped_column(Date)

    # Contact
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    pincode: Mapped[str | None] = mapped_column(String(10))

    # Medical
    blood_group: Mapped[BloodGroup] = mapped_column(SAEnum(BloodGroup), default=BloodGroup.UNKNOWN)
    allergies: Mapped[str | None] = mapped_column(Text)
    medical_history: Mapped[str | None] = mapped_column(Text)

    # ABDM (Ayushman Bharat Digital Mission) compliance
    abha_id: Mapped[str | None] = mapped_column(String(50), unique=True)  # 14-digit ABHA number

    # Insurance
    insurance_id: Mapped[str | None] = mapped_column(String(100))

    # Emergency contact
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20))
    emergency_contact_relation: Mapped[str | None] = mapped_column(String(50))

    # Medications (separate from general medical_history)
    medications: Mapped[str | None] = mapped_column(Text)

    # Per-clinic sequential patient number — used as human-readable ID (PA-0001)
    patient_number: Mapped[int | None] = mapped_column(Integer, index=True)

    # Photo
    photo_url: Mapped[str | None] = mapped_column(String(500))

    # Assigned doctor (optional default)
    assigned_doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="patients")
    assigned_doctor: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_doctor_id])
    appointments: Mapped[list["Appointment"]] = relationship("Appointment", back_populates="patient")
    medical_history_versions: Mapped[list["MedicalHistoryVersion"]] = relationship(
        "MedicalHistoryVersion", back_populates="patient", order_by="MedicalHistoryVersion.created_at.desc()"
    )

    __table_args__ = (
        UniqueConstraint("clinic_id", "patient_number", name="uq_patient_clinic_number"),
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def patient_id(self) -> str | None:
        if self.patient_number is not None:
            return f"PA-{self.patient_number:04d}"
        return None


class MedicalHistoryVersion(Base, UUIDMixin, TimestampMixin):
    """
    Immutable snapshot of a patient's medical history after each update.
    created_at = when the change was made, changed_by = who made it.
    """
    __tablename__ = "medical_history_versions"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    changed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Snapshot values after this change
    allergies: Mapped[str | None] = mapped_column(Text)
    medications: Mapped[str | None] = mapped_column(Text)
    prior_conditions: Mapped[str | None] = mapped_column(Text)  # maps to Patient.medical_history

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="medical_history_versions")
    changed_by: Mapped["User | None"] = relationship("User")
