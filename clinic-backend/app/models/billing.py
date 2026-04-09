"""
Invoice and InvoiceItem models with full Indian GST compliance.
GST rates for dental:
  - Consultation: exempt (NIL rate)
  - Dental implants/prosthetics: 12% or 18%
  - Medicines/drugs: 0-18% depending on product
  Rates stored per line item so they can vary.
"""
import uuid
import enum
from typing import TYPE_CHECKING
from sqlalchemy import String, Date, Text, ForeignKey, Enum as SAEnum, Numeric, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.user import User
    from app.models.clinical import TreatmentRecord


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    UPI = "upi"
    CARD = "card"
    NETBANKING = "netbanking"
    CHEQUE = "cheque"
    INSURANCE = "insurance"


class Invoice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoices"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    invoice_date: Mapped[str] = mapped_column(Date, nullable=False)
    due_date: Mapped[str | None] = mapped_column(Date)

    status: Mapped[InvoiceStatus] = mapped_column(SAEnum(InvoiceStatus), default=InvoiceStatus.DRAFT)

    # Amounts
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    # GST breakdown
    cgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)   # Central GST
    sgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)   # State GST
    igst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)   # Interstate GST
    total_tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    amount_due: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    payment_method: Mapped[PaymentMethod | None] = mapped_column(SAEnum(PaymentMethod))
    payment_reference: Mapped[str | None] = mapped_column(String(100))  # UPI txn ID, cheque no, etc.
    notes: Mapped[str | None] = mapped_column(Text)

    patient: Mapped["Patient"] = relationship("Patient")
    doctor: Mapped["User"] = relationship("User")
    items: Mapped[list["InvoiceItem"]] = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    treatment_record_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_records.id", ondelete="SET NULL"), nullable=True
    )

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    hsn_sac_code: Mapped[str | None] = mapped_column(String(10))  # GST HSN/SAC code
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # GST per line (rates in %, amounts in ₹)
    cgst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    sgst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    igst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    cgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    sgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    igst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")
    treatment_record: Mapped["TreatmentRecord | None"] = relationship("TreatmentRecord")
