import uuid
from typing import TYPE_CHECKING
from sqlalchemy import String, Date, Text, ForeignKey, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.user import User
    from app.models.appointment import Appointment


class Prescription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "prescriptions"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )

    prescription_date: Mapped[str] = mapped_column(Date, nullable=False)
    diagnosis: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    patient: Mapped["Patient"] = relationship("Patient")
    doctor: Mapped["User"] = relationship("User")
    appointment: Mapped["Appointment | None"] = relationship("Appointment")
    items: Mapped[list["PrescriptionItem"]] = relationship(
        "PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan"
    )


class PrescriptionItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "prescription_items"

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False
    )

    medicine_name: Mapped[str] = mapped_column(String(300), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)   # e.g. "500mg"
    frequency: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "Twice daily"
    duration: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "5 days"
    instructions: Mapped[str | None] = mapped_column(Text)              # e.g. "After food"
    quantity: Mapped[int] = mapped_column(Integer, default=1)

    prescription: Mapped["Prescription"] = relationship("Prescription", back_populates="items")
