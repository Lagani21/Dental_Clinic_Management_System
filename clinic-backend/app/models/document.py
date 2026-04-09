import uuid
import enum
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, Enum as SAEnum, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.user import User


class DocumentType(str, enum.Enum):
    XRAY = "xray"
    PHOTO = "photo"
    CONSENT_FORM = "consent_form"
    LAB_REPORT = "lab_report"
    PRESCRIPTION = "prescription"
    INVOICE = "invoice"
    OTHER = "other"


class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    document_type: Mapped[DocumentType] = mapped_column(SAEnum(DocumentType), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # S3 storage
    s3_key: Mapped[str] = mapped_column(String(500), nullable=False)   # S3 object key
    s3_url: Mapped[str] = mapped_column(Text, nullable=False)          # Pre-signed or public URL
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    mime_type: Mapped[str | None] = mapped_column(String(100))

    patient: Mapped["Patient"] = relationship("Patient")
    uploaded_by: Mapped["User"] = relationship("User")
