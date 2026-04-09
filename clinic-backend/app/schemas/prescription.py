import uuid
from datetime import date, datetime
from pydantic import BaseModel


class PrescriptionItemIn(BaseModel):
    medicine_name: str
    dosage: str           # e.g. "500mg"
    frequency: str        # e.g. "Twice daily"
    duration: str         # e.g. "5 days"
    instructions: str | None = None
    quantity: int = 1


class PrescriptionItemOut(PrescriptionItemIn):
    id: uuid.UUID
    model_config = {"from_attributes": True}


class PrescriptionCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    prescription_date: date
    diagnosis: str | None = None
    notes: str | None = None
    appointment_id: uuid.UUID | None = None
    items: list[PrescriptionItemIn]


class PrescriptionUpdate(BaseModel):
    diagnosis: str | None = None
    notes: str | None = None
    items: list[PrescriptionItemIn] | None = None


class PrescriptionOut(BaseModel):
    id: uuid.UUID
    prescription_date: date
    diagnosis: str | None
    notes: str | None
    patient_id: uuid.UUID
    patient_name: str | None = None
    patient_phone: str | None = None
    patient_allergies: str | None = None
    doctor_id: uuid.UUID
    doctor_name: str | None = None
    appointment_id: uuid.UUID | None
    items: list[PrescriptionItemOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
