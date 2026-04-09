"""
Clinical Records router:
  /patients/{patient_id}/dental-chart      – CR-001
  /patients/{patient_id}/clinical-notes    – CR-002
  /patients/{patient_id}/perio-exams       – CR-003
"""
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.patient import Patient
from app.models.clinical_records import (
    DentalChart, ClinicalNote, ClinicalNoteAmend, PerioExam, PerioMeasurement
)
from app.auth.rbac import CurrentUser, require_any_staff, require_doctor_or_above, clinic_scope
from app.schemas.clinical import (
    ChartPatch, DentalChartOut,
    ClinicalNoteCreate, ClinicalNoteUpdate, ClinicalNoteOut, AmendOut,
    PerioExamCreate, PerioExamOut, PerioMeasurementOut,
)

router = APIRouter(tags=["clinical"])

LOCK_HOURS = 24


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_patient(patient_id: uuid.UUID, current_user: CurrentUser, db: AsyncSession) -> Patient:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    clinic_scope(current_user, patient.clinic_id)
    return patient


def _is_past_lock_window(note: ClinicalNote) -> bool:
    now = datetime.now(timezone.utc)
    created = note.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return (now - created) > timedelta(hours=LOCK_HOURS)


# ── Dental Chart (CR-001) ──────────────────────────────────────────────────────

@router.get("/patients/{patient_id}/dental-chart", response_model=DentalChartOut)
async def get_dental_chart(
    patient_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    patient = await _get_patient(patient_id, current_user, db)
    result = await db.execute(
        select(DentalChart).where(DentalChart.patient_id == patient_id)
    )
    chart = result.scalar_one_or_none()
    if not chart:
        # Auto-create an empty chart on first access
        chart = DentalChart(
            clinic_id=patient.clinic_id,
            patient_id=patient_id,
            chart_data={},
            tooth_status={},
        )
        db.add(chart)
        await db.flush()
        await db.refresh(chart)
    return DentalChartOut.model_validate(chart)


@router.patch("/patients/{patient_id}/dental-chart", response_model=DentalChartOut)
async def patch_dental_chart(
    patient_id: uuid.UUID,
    payload: ChartPatch,
    current_user: CurrentUser = Depends(require_doctor_or_above),
    db: AsyncSession = Depends(get_db),
):
    patient = await _get_patient(patient_id, current_user, db)
    result = await db.execute(
        select(DentalChart).where(DentalChart.patient_id == patient_id)
    )
    chart = result.scalar_one_or_none()
    if not chart:
        chart = DentalChart(clinic_id=patient.clinic_id, patient_id=patient_id, chart_data={}, tooth_status={})
        db.add(chart)

    # Mutate JSONB — must reassign to trigger SQLAlchemy dirty tracking
    chart_data = dict(chart.chart_data or {})
    tooth_status = dict(chart.tooth_status or {})

    tooth = payload.tooth_number

    if payload.tooth_status:
        if payload.tooth_status == "clear":
            tooth_status.pop(tooth, None)
        else:
            tooth_status[tooth] = payload.tooth_status
    elif payload.surface:
        if tooth not in chart_data:
            chart_data[tooth] = {}
        if payload.condition:
            chart_data[tooth][payload.surface] = payload.condition
        else:
            chart_data[tooth].pop(payload.surface, None)
            if not chart_data[tooth]:
                chart_data.pop(tooth)

    chart.chart_data = chart_data
    chart.tooth_status = tooth_status
    chart.last_modified_by_id = current_user.id

    await db.flush()
    await db.refresh(chart)
    return DentalChartOut.model_validate(chart)


# ── Clinical Notes (CR-002) ────────────────────────────────────────────────────

@router.get("/patients/{patient_id}/clinical-notes", response_model=list[ClinicalNoteOut])
async def list_clinical_notes(
    patient_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    await _get_patient(patient_id, current_user, db)
    result = await db.execute(
        select(ClinicalNote)
        .options(
            selectinload(ClinicalNote.doctor),
            selectinload(ClinicalNote.amendments).selectinload(ClinicalNoteAmend.amended_by),
        )
        .where(ClinicalNote.patient_id == patient_id)
        .order_by(ClinicalNote.visit_date.desc(), ClinicalNote.created_at.desc())
    )
    notes = result.scalars().all()

    # Auto-lock notes past the window
    for note in notes:
        if not note.is_locked and _is_past_lock_window(note):
            note.is_locked = True

    out = []
    for note in notes:
        item = ClinicalNoteOut.model_validate(note)
        item.doctor_name = note.doctor.full_name if note.doctor else None
        item.amendments = [
            AmendOut(
                **{k: v for k, v in AmendOut.model_validate(a).model_dump().items() if k != 'amended_by_name'},
                amended_by_name=a.amended_by.full_name if a.amended_by else None,
            )
            for a in note.amendments
        ]
        out.append(item)
    return out


@router.post("/patients/{patient_id}/clinical-notes", response_model=ClinicalNoteOut, status_code=201)
async def create_clinical_note(
    patient_id: uuid.UUID,
    payload: ClinicalNoteCreate,
    current_user: CurrentUser = Depends(require_doctor_or_above),
    db: AsyncSession = Depends(get_db),
):
    patient = await _get_patient(patient_id, current_user, db)
    note = ClinicalNote(
        clinic_id=patient.clinic_id,
        patient_id=patient_id,
        doctor_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)

    result = await db.execute(
        select(ClinicalNote)
        .options(selectinload(ClinicalNote.doctor), selectinload(ClinicalNote.amendments))
        .where(ClinicalNote.id == note.id)
    )
    note = result.scalar_one()
    item = ClinicalNoteOut.model_validate(note)
    item.doctor_name = note.doctor.full_name if note.doctor else None
    return item


@router.patch("/patients/{patient_id}/clinical-notes/{note_id}", response_model=ClinicalNoteOut)
async def update_clinical_note(
    patient_id: uuid.UUID,
    note_id: uuid.UUID,
    payload: ClinicalNoteUpdate,
    current_user: CurrentUser = Depends(require_doctor_or_above),
    db: AsyncSession = Depends(get_db),
):
    await _get_patient(patient_id, current_user, db)
    result = await db.execute(
        select(ClinicalNote)
        .options(selectinload(ClinicalNote.doctor), selectinload(ClinicalNote.amendments).selectinload(ClinicalNoteAmend.amended_by))
        .where(ClinicalNote.id == note_id, ClinicalNote.patient_id == patient_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Auto-lock check
    if not note.is_locked and _is_past_lock_window(note):
        note.is_locked = True

    if note.is_locked:
        if not payload.amend_reason:
            raise HTTPException(
                status_code=400,
                detail="This note is locked. Provide amend_reason to amend it."
            )
        # Snapshot current state before overwriting
        snapshot = {
            "chief_complaint": note.chief_complaint,
            "examination": note.examination,
            "assessment": note.assessment,
            "plan": note.plan,
            "procedures_done": note.procedures_done,
        }
        amend = ClinicalNoteAmend(
            note_id=note.id,
            amended_by_id=current_user.id,
            reason=payload.amend_reason,
            snapshot=snapshot,
        )
        db.add(amend)

    updates = payload.model_dump(exclude_unset=True, exclude={"amend_reason"})
    for field, value in updates.items():
        setattr(note, field, value)

    await db.flush()
    await db.refresh(note)

    item = ClinicalNoteOut.model_validate(note)
    item.doctor_name = note.doctor.full_name if note.doctor else None
    item.amendments = [
        AmendOut(
            **{k: v for k, v in AmendOut.model_validate(a).model_dump().items() if k != 'amended_by_name'},
            amended_by_name=a.amended_by.full_name if a.amended_by else None,
        )
        for a in note.amendments
    ]
    return item


# ── Periodontal Charting (CR-003) ──────────────────────────────────────────────

@router.get("/patients/{patient_id}/perio-exams", response_model=list[PerioExamOut])
async def list_perio_exams(
    patient_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    await _get_patient(patient_id, current_user, db)
    result = await db.execute(
        select(PerioExam)
        .options(selectinload(PerioExam.doctor), selectinload(PerioExam.measurements))
        .where(PerioExam.patient_id == patient_id)
        .order_by(PerioExam.exam_date.desc())
    )
    exams = result.scalars().all()
    out = []
    for exam in exams:
        item = PerioExamOut.model_validate(exam)
        item.doctor_name = exam.doctor.full_name if exam.doctor else None
        item.measurements = [PerioMeasurementOut.model_validate(m) for m in exam.measurements]
        out.append(item)
    return out


@router.post("/patients/{patient_id}/perio-exams", response_model=PerioExamOut, status_code=201)
async def create_perio_exam(
    patient_id: uuid.UUID,
    payload: PerioExamCreate,
    current_user: CurrentUser = Depends(require_doctor_or_above),
    db: AsyncSession = Depends(get_db),
):
    patient = await _get_patient(patient_id, current_user, db)
    exam = PerioExam(
        clinic_id=patient.clinic_id,
        patient_id=patient_id,
        doctor_id=current_user.id,
        exam_date=payload.exam_date,
        notes=payload.notes,
    )
    db.add(exam)
    await db.flush()

    for m in payload.measurements:
        measurement = PerioMeasurement(exam_id=exam.id, **m.model_dump())
        db.add(measurement)

    await db.flush()
    await db.refresh(exam)

    result = await db.execute(
        select(PerioExam)
        .options(selectinload(PerioExam.doctor), selectinload(PerioExam.measurements))
        .where(PerioExam.id == exam.id)
    )
    exam = result.scalar_one()
    item = PerioExamOut.model_validate(exam)
    item.doctor_name = exam.doctor.full_name if exam.doctor else None
    item.measurements = [PerioMeasurementOut.model_validate(m) for m in exam.measurements]
    return item
