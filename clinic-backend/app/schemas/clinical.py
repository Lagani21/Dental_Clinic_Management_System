import uuid
from datetime import date, datetime
from pydantic import BaseModel, field_validator
from app.models.clinical_records import NotationSystem


# ── Dental Chart ───────────────────────────────────────────────────────────────

class ChartPatch(BaseModel):
    """Partial update: send only the tooth/surface you're changing."""
    tooth_number: str                    # e.g. "16"
    surface: str                         # mesial | distal | buccal | lingual | occlusal | incisal | whole
    condition: str | None                # None = clear the annotation
    tooth_status: str | None = None      # missing | implant | unerupted — applied to whole tooth


class DentalChartOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    notation_system: NotationSystem
    chart_data: dict        # { "16": { "mesial": "caries", ... } }
    tooth_status: dict      # { "46": "missing" }
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Clinical Notes ─────────────────────────────────────────────────────────────

class ClinicalNoteCreate(BaseModel):
    visit_date: date
    appointment_id: uuid.UUID | None = None
    chief_complaint: str | None = None
    examination:     str | None = None
    assessment:      str | None = None
    plan:            str | None = None
    procedures_done: str | None = None


class ClinicalNoteUpdate(BaseModel):
    chief_complaint: str | None = None
    examination:     str | None = None
    assessment:      str | None = None
    plan:            str | None = None
    procedures_done: str | None = None
    # Required when note is locked (amendment path)
    amend_reason: str | None = None


class AmendOut(BaseModel):
    id: uuid.UUID
    amended_by_id: uuid.UUID
    amended_by_name: str | None = None
    reason: str
    snapshot: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class ClinicalNoteOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    doctor_name: str | None = None
    appointment_id: uuid.UUID | None
    visit_date: date
    chief_complaint: str | None
    examination:     str | None
    assessment:      str | None
    plan:            str | None
    procedures_done: str | None
    is_locked: bool
    created_at: datetime
    amendments: list[AmendOut] = []

    model_config = {"from_attributes": True}


# ── Periodontal Charting ───────────────────────────────────────────────────────

class PerioMeasurementIn(BaseModel):
    tooth_number: int
    db: int | None = None
    b:  int | None = None
    mb: int | None = None
    dl: int | None = None
    l:  int | None = None
    ml: int | None = None
    bleeding:  dict = {}    # { "db": true, "b": false, ... }
    furcation: dict = {}    # { "db": 1, "b": 0, ... }


class PerioExamCreate(BaseModel):
    exam_date: date
    appointment_id: uuid.UUID | None = None
    notes: str | None = None
    measurements: list[PerioMeasurementIn] = []


class PerioMeasurementOut(BaseModel):
    id: uuid.UUID
    tooth_number: int
    db: int | None
    b:  int | None
    mb: int | None
    dl: int | None
    l:  int | None
    ml: int | None
    bleeding:  dict
    furcation: dict

    model_config = {"from_attributes": True}


class PerioExamOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    doctor_name: str | None = None
    exam_date: date
    notes: str | None
    measurements: list[PerioMeasurementOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}
