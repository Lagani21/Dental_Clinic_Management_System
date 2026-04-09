import uuid
from datetime import date, datetime
from pydantic import BaseModel, field_validator
from typing import Any
from app.models.billing import InvoiceStatus, PaymentMethod


class InvoiceItemIn(BaseModel):
    description: str
    hsn_sac_code: str | None = None
    quantity: int = 1
    unit_price: float
    cgst_rate: float = 0
    sgst_rate: float = 0
    igst_rate: float = 0


class InvoiceItemOut(InvoiceItemIn):
    id: uuid.UUID
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    line_total: float

    model_config = {"from_attributes": True}


class InvoiceCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    invoice_date: date
    due_date: date | None = None
    items: list[InvoiceItemIn]
    discount_amount: float = 0
    discount_percent: float = 0
    payment_method: PaymentMethod | None = None
    payment_reference: str | None = None
    notes: str | None = None


class InvoiceUpdate(BaseModel):
    invoice_date: date | None = None
    due_date: date | None = None
    items: list[InvoiceItemIn] | None = None
    discount_amount: float | None = None
    discount_percent: float | None = None
    payment_method: PaymentMethod | None = None
    payment_reference: str | None = None
    notes: str | None = None


class PaymentIn(BaseModel):
    amount_paid: float
    payment_method: PaymentMethod
    payment_reference: str | None = None


class SendInvoiceIn(BaseModel):
    channel: str  # "email" | "sms" | "both"
    email: str | None = None
    phone: str | None = None


class InvoiceOut(BaseModel):
    id: uuid.UUID
    invoice_number: str
    invoice_date: date
    due_date: date | None
    status: InvoiceStatus
    patient_id: uuid.UUID
    patient_name: str | None = None
    patient_phone: str | None = None
    patient_email: str | None = None
    doctor_id: uuid.UUID
    doctor_name: str | None = None
    items: list[InvoiceItemOut] = []
    subtotal: float
    discount_amount: float
    discount_percent: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    total_tax_amount: float
    total_amount: float
    amount_paid: float
    amount_due: float
    payment_method: PaymentMethod | None
    payment_reference: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
