import uuid
from datetime import date, datetime
from pydantic import BaseModel, EmailStr
from app.models.patient import BloodGroup, Gender


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    gender: Gender
    date_of_birth: date | None = None
    phone: str
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    pincode: str | None = None
    blood_group: BloodGroup = BloodGroup.UNKNOWN
    allergies: str | None = None
    medications: str | None = None
    medical_history: str | None = None
    abha_id: str | None = None
    insurance_id: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    assigned_doctor_id: uuid.UUID | None = None
    photo_url: str | None = None


class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    gender: Gender | None = None
    date_of_birth: date | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    pincode: str | None = None
    blood_group: BloodGroup | None = None
    allergies: str | None = None
    medications: str | None = None
    medical_history: str | None = None
    abha_id: str | None = None
    insurance_id: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    assigned_doctor_id: uuid.UUID | None = None
    is_active: bool | None = None
    photo_url: str | None = None


class PatientOut(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    first_name: str
    last_name: str
    full_name: str
    patient_id: str | None           # human-readable, e.g. "PA-0001"
    patient_number: int | None
    gender: Gender
    date_of_birth: date | None
    phone: str
    email: str | None
    address: str | None
    city: str | None
    pincode: str | None
    blood_group: BloodGroup
    allergies: str | None
    medications: str | None
    medical_history: str | None
    abha_id: str | None
    insurance_id: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    emergency_contact_relation: str | None
    assigned_doctor_id: uuid.UUID | None
    photo_url: str | None
    is_active: bool
    created_at: datetime
    # Computed in router — not stored on the model
    last_visit: date | None = None

    model_config = {"from_attributes": True}


class MedicalHistoryVersionOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    changed_by_id: uuid.UUID | None
    changed_by_name: str | None = None   # populated by router
    allergies: str | None
    medications: str | None
    prior_conditions: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
