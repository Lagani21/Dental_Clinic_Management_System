import uuid
from datetime import date, time, datetime
from pydantic import BaseModel
from app.models.appointment import AppointmentStatus

PROCEDURE_TYPES = [
    "consultation", "checkup", "cleaning", "filling",
    "root_canal", "extraction", "crown", "bridge",
    "implant", "whitening", "orthodontics", "x_ray", "other",
]


class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    appointment_date: date
    start_time: time
    duration_minutes: int = 30
    procedure_type: str | None = None   # drives auto-duration
    reason: str | None = None
    notes: str | None = None
    chair: str | None = None


class AppointmentUpdate(BaseModel):
    appointment_date: date | None = None
    start_time: time | None = None
    duration_minutes: int | None = None
    status: AppointmentStatus | None = None
    reason: str | None = None
    notes: str | None = None
    cancellation_reason: str | None = None
    cancellation_type: str | None = None
    chair: str | None = None


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus
    notes: str | None = None
    cancellation_reason: str | None = None
    cancellation_type: str | None = None   # patient_request | clinic_initiated | no_show


class AppointmentReschedule(BaseModel):
    appointment_date: date
    start_time: time
    reason: str                           # required by AP-004
    chair: str | None = None


class AppointmentOut(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    booked_by_id: uuid.UUID | None
    appointment_date: date
    start_time: time
    duration_minutes: int
    status: AppointmentStatus
    procedure_type: str | None
    reason: str | None
    notes: str | None
    cancellation_reason: str | None
    cancellation_type: str | None
    chair: str | None
    created_at: datetime

    # Enriched — populated by router, not from DB directly
    patient_name: str | None = None
    patient_id_label: str | None = None   # e.g. "PA-0001"
    doctor_name: str | None = None
    allergies: str | None = None
    last_visit: date | None = None

    model_config = {"from_attributes": True}


class AvailabilitySlot(BaseModel):
    start_time: str      # "09:00"
    available: bool
