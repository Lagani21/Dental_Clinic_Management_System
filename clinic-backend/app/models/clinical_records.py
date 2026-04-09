"""
Clinical Records models:
  - DentalChart       : per-patient tooth condition map (FDI notation, JSONB)
  - ClinicalNote      : per-visit SOAP note, locked after 24h
  - ClinicalNoteAmend : amendment log when a locked note is edited
  - PerioExam         : periodontal exam header (date, examiner)
  - PerioMeasurement  : 6-point pocket depth per tooth, with bleeding/furcation

FDI notation: teeth 11-48 (adult) and 51-85 (primary).
Surfaces: mesial | distal | buccal | lingual | occlusal | incisal
Conditions: intact | caries | filled | crown | missing | implant | root_canal | fracture | other
"""
import uuid
import enum
from typing import TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, Text, Date, ForeignKey, Enum as SAEnum, Boolean, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.user import User
    from app.models.appointment import Appointment


class NotationSystem(str, enum.Enum):
    FDI = "fdi"
    UNIVERSAL = "universal"


# ── Dental Chart ───────────────────────────────────────────────────────────────

class DentalChart(Base, UUIDMixin, TimestampMixin):
    """
    One row per patient. Stores the full tooth map as JSONB.
    Structure: { "11": { "mesial": "caries", "occlusal": "filled", ... }, ... }
    """
    __tablename__ = "dental_charts"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    notation_system: Mapped[NotationSystem] = mapped_column(
        SAEnum(NotationSystem), default=NotationSystem.FDI
    )
    # { tooth_number: { surface: condition } }
    chart_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    # { tooth_number: "missing" | "implant" | "unerupted" }
    tooth_status: Mapped[dict] = mapped_column(JSONB, default=dict)

    last_modified_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    patient: Mapped["Patient"] = relationship("Patient")
    last_modified_by: Mapped["User | None"] = relationship("User")


# ── Clinical Notes (SOAP) ─────────────────────────────────────────────────────

class ClinicalNote(Base, UUIDMixin, TimestampMixin):
    """One SOAP note per visit/appointment."""
    __tablename__ = "clinical_notes"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )

    visit_date: Mapped[str] = mapped_column(Date, nullable=False)

    # SOAP fields
    chief_complaint: Mapped[str | None] = mapped_column(Text)       # S – Subjective
    examination:     Mapped[str | None] = mapped_column(Text)       # O – Objective
    assessment:      Mapped[str | None] = mapped_column(Text)       # A – Assessment
    plan:            Mapped[str | None] = mapped_column(Text)       # P – Plan
    procedures_done: Mapped[str | None] = mapped_column(Text)       # procedures performed this visit

    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)

    patient: Mapped["Patient"] = relationship("Patient")
    doctor: Mapped["User"] = relationship("User", foreign_keys=[doctor_id])
    appointment: Mapped["Appointment | None"] = relationship("Appointment")
    amendments: Mapped[list["ClinicalNoteAmend"]] = relationship(
        "ClinicalNoteAmend", back_populates="note", order_by="ClinicalNoteAmend.created_at.desc()"
    )


class ClinicalNoteAmend(Base, UUIDMixin, TimestampMixin):
    """Immutable record of every post-lock edit."""
    __tablename__ = "clinical_note_amends"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinical_notes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amended_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    # Snapshot of fields before this amendment
    snapshot: Mapped[dict] = mapped_column(JSONB)

    note: Mapped["ClinicalNote"] = relationship("ClinicalNote", back_populates="amendments")
    amended_by: Mapped["User"] = relationship("User")


# ── Periodontal Charting ───────────────────────────────────────────────────────

class PerioExam(Base, UUIDMixin, TimestampMixin):
    """Header record for one periodontal examination session."""
    __tablename__ = "perio_exams"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    exam_date: Mapped[str] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    patient: Mapped["Patient"] = relationship("Patient")
    doctor: Mapped["User"] = relationship("User")
    measurements: Mapped[list["PerioMeasurement"]] = relationship(
        "PerioMeasurement", back_populates="exam", cascade="all, delete-orphan"
    )


class PerioMeasurement(Base, UUIDMixin):
    """
    6-point pocket depth for one tooth in one exam.
    Points (buccal side L→R, then lingual side L→R):
      db = disto-buccal, b = buccal, mb = mesio-buccal,
      dl = disto-lingual, l = lingual, ml = mesio-lingual
    Depths stored in mm (0-12 typical).
    """
    __tablename__ = "perio_measurements"

    exam_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("perio_exams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tooth_number: Mapped[int] = mapped_column(Integer, nullable=False)   # FDI e.g. 11, 36

    # Pocket depths (mm)
    db: Mapped[int | None] = mapped_column(Integer)   # disto-buccal
    b:  Mapped[int | None] = mapped_column(Integer)   # buccal
    mb: Mapped[int | None] = mapped_column(Integer)   # mesio-buccal
    dl: Mapped[int | None] = mapped_column(Integer)   # disto-lingual
    l:  Mapped[int | None] = mapped_column(Integer)   # lingual
    ml: Mapped[int | None] = mapped_column(Integer)   # mesio-lingual

    # Markers (stored as JSONB booleans per point, e.g. {"db": true, "b": false})
    bleeding:   Mapped[dict] = mapped_column(JSONB, default=dict)
    furcation:  Mapped[dict] = mapped_column(JSONB, default=dict)   # grade 1/2/3 per point

    exam: Mapped["PerioExam"] = relationship("PerioExam", back_populates="measurements")
