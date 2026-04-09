"""
Treatment Plan and Treatment Record models.
Uses FDI (Fédération Dentaire Internationale) tooth notation:
  Quadrant 1-4 (adult), 5-8 (child), tooth 1-8.
  Example: tooth 16 = upper right first molar.
  Stored as JSONB array of integers, e.g. [16, 26, 36, 46].
"""
import uuid
import enum
from typing import TYPE_CHECKING
from sqlalchemy import String, Date, Text, ForeignKey, Enum as SAEnum, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.user import User
    from app.models.appointment import Appointment


class TreatmentPlanStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TreatmentPlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "treatment_plans"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TreatmentPlanStatus] = mapped_column(
        SAEnum(TreatmentPlanStatus), default=TreatmentPlanStatus.DRAFT
    )
    estimated_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))

    patient: Mapped["Patient"] = relationship("Patient")
    doctor: Mapped["User"] = relationship("User")
    records: Mapped[list["TreatmentRecord"]] = relationship("TreatmentRecord", back_populates="plan")


class TreatmentRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "treatment_records"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )

    procedure_name: Mapped[str] = mapped_column(String(300), nullable=False)
    procedure_code: Mapped[str | None] = mapped_column(String(20))   # ICD-10 or custom code

    # FDI tooth notation — list of tooth numbers, e.g. [16, 26]
    teeth: Mapped[list | None] = mapped_column(JSONB, default=list)

    date_performed: Mapped[str] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)

    patient: Mapped["Patient"] = relationship("Patient")
    doctor: Mapped["User"] = relationship("User")
    plan: Mapped["TreatmentPlan | None"] = relationship("TreatmentPlan", back_populates="records")
    appointment: Mapped["Appointment | None"] = relationship("Appointment")
