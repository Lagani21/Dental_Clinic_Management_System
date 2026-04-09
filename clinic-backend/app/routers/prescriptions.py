import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.auth.rbac import CurrentUser, require_any_staff, require_doctor_or_above
from app.models.prescription import Prescription, PrescriptionItem
from app.models.patient import Patient
from app.models.user import User
from app.schemas.prescription import PrescriptionCreate, PrescriptionUpdate, PrescriptionOut

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


# ── Helper ─────────────────────────────────────────────────────────────────────

def _enrich(rx: Prescription) -> PrescriptionOut:
    out = PrescriptionOut.model_validate(rx)
    if rx.patient:
        out.patient_name      = f"{rx.patient.first_name} {rx.patient.last_name}"
        out.patient_phone     = rx.patient.phone
        out.patient_allergies = rx.patient.allergies
    if rx.doctor:
        out.doctor_name = rx.doctor.full_name
    return out


async def _get_or_404(
    rx_id: uuid.UUID, user: CurrentUser, db: AsyncSession
) -> Prescription:
    rx = (await db.execute(
        select(Prescription)
        .options(selectinload(Prescription.items),
                 selectinload(Prescription.patient),
                 selectinload(Prescription.doctor))
        .where(Prescription.id == rx_id, Prescription.clinic_id == user.clinic_id)
    )).scalar_one_or_none()
    if not rx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
    return rx


# ── GET /prescriptions — clinic-wide list ─────────────────────────────────────

@router.get("", response_model=dict)
async def list_prescriptions(
    patient_id: uuid.UUID | None = Query(None),
    doctor_id:  uuid.UUID | None = Query(None),
    date_from:  date | None      = Query(None),
    date_to:    date | None      = Query(None),
    q:          str | None       = Query(None),
    page:       int              = Query(1, ge=1),
    page_size:  int              = Query(25, ge=1, le=200),
    db:         AsyncSession     = Depends(get_db),
    user:       CurrentUser      = Depends(require_any_staff),
):
    stmt = (
        select(Prescription)
        .options(selectinload(Prescription.items),
                 selectinload(Prescription.patient),
                 selectinload(Prescription.doctor))
        .where(Prescription.clinic_id == user.clinic_id)
        .order_by(Prescription.prescription_date.desc(), Prescription.created_at.desc())
    )
    if patient_id:
        stmt = stmt.where(Prescription.patient_id == patient_id)
    if doctor_id:
        stmt = stmt.where(Prescription.doctor_id == doctor_id)
    if date_from:
        stmt = stmt.where(Prescription.prescription_date >= date_from)
    if date_to:
        stmt = stmt.where(Prescription.prescription_date <= date_to)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    rows  = (await db.execute(stmt.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return {"total": total, "page": page, "page_size": page_size, "items": [_enrich(r) for r in rows]}


# ── POST /prescriptions ────────────────────────────────────────────────────────

@router.post("", response_model=PrescriptionOut, status_code=201)
async def create_prescription(
    body: PrescriptionCreate,
    db:   AsyncSession = Depends(get_db),
    user: CurrentUser  = Depends(require_doctor_or_above),
):
    # Validate patient in clinic
    patient = (await db.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.clinic_id == user.clinic_id)
    )).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, "Patient not found")

    rx = Prescription(
        clinic_id=user.clinic_id,
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        appointment_id=body.appointment_id,
        prescription_date=body.prescription_date,
        diagnosis=body.diagnosis,
        notes=body.notes,
    )
    db.add(rx)
    await db.flush()

    for item in body.items:
        db.add(PrescriptionItem(prescription_id=rx.id, **item.model_dump()))

    await db.flush()
    return await _get_or_404(rx.id, user, db)


# ── GET /prescriptions/:id ─────────────────────────────────────────────────────

@router.get("/{rx_id}", response_model=PrescriptionOut)
async def get_prescription(
    rx_id: uuid.UUID,
    db:    AsyncSession = Depends(get_db),
    user:  CurrentUser  = Depends(require_any_staff),
):
    return _enrich(await _get_or_404(rx_id, user, db))


# ── PATCH /prescriptions/:id ───────────────────────────────────────────────────

@router.patch("/{rx_id}", response_model=PrescriptionOut)
async def update_prescription(
    rx_id: uuid.UUID,
    body:  PrescriptionUpdate,
    db:    AsyncSession = Depends(get_db),
    user:  CurrentUser  = Depends(require_doctor_or_above),
):
    rx = await _get_or_404(rx_id, user, db)

    if body.diagnosis is not None:
        rx.diagnosis = body.diagnosis
    if body.notes is not None:
        rx.notes = body.notes

    if body.items is not None:
        for old in list(rx.items):
            await db.delete(old)
        await db.flush()
        for item in body.items:
            db.add(PrescriptionItem(prescription_id=rx.id, **item.model_dump()))
        await db.flush()

    await db.commit()
    return _enrich(await _get_or_404(rx_id, user, db))


# ── DELETE /prescriptions/:id ──────────────────────────────────────────────────

@router.delete("/{rx_id}", status_code=204)
async def delete_prescription(
    rx_id: uuid.UUID,
    db:    AsyncSession = Depends(get_db),
    user:  CurrentUser  = Depends(require_doctor_or_above),
):
    rx = await _get_or_404(rx_id, user, db)
    await db.delete(rx)
    await db.commit()
