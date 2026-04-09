import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.patient import Patient, MedicalHistoryVersion
from app.models.appointment import Appointment, AppointmentStatus
from app.models.audit import AuditLog
from app.auth.rbac import get_current_user, CurrentUser, require_any_staff, require_doctor_or_above, clinic_scope
from app.schemas.patient import PatientCreate, PatientUpdate, PatientOut, MedicalHistoryVersionOut

router = APIRouter(prefix="/patients", tags=["patients"])

# ── Helpers ────────────────────────────────────────────────────────────────────

MEDICAL_FIELDS = {"allergies", "medications", "medical_history"}


async def _next_patient_number(db: AsyncSession, clinic_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.max(Patient.patient_number)).where(Patient.clinic_id == clinic_id)
    )
    max_num = result.scalar() or 0
    return max_num + 1


def _last_visit_subq():
    """Correlated subquery returning the most recent completed appointment date for a patient."""
    return (
        select(func.max(Appointment.appointment_date))
        .where(
            Appointment.patient_id == Patient.id,
            Appointment.status == AppointmentStatus.COMPLETED,
        )
        .correlate(Patient)
        .scalar_subquery()
    ).label("last_visit")


def _build_patient_out(patient: Patient, last_visit: date | None) -> PatientOut:
    out = PatientOut.model_validate(patient)
    out.last_visit = last_visit
    return out


async def _write_audit(
    db: AsyncSession,
    *,
    user: CurrentUser,
    action: str,
    resource_id: str,
    changes: dict | None = None,
    request: Request | None = None,
):
    log = AuditLog(
        clinic_id=user.clinic_id,
        user_id=user.id,
        action=action,
        resource_type="patient",
        resource_id=resource_id,
        changes=changes,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    db.add(log)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=dict)
async def list_patients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    last_visit_col = _last_visit_subq()
    base = (
        select(Patient, last_visit_col)
        .where(Patient.clinic_id == current_user.clinic_id, Patient.is_active == True)
    )

    if search:
        search = search.strip()
        # Try to match against human-readable patient ID (PA-0001 or bare number)
        patient_num = _parse_patient_number(search)
        if patient_num is not None:
            base = base.where(Patient.patient_number == patient_num)
        else:
            term = f"%{search}%"
            base = base.where(
                Patient.first_name.ilike(term)
                | Patient.last_name.ilike(term)
                | Patient.phone.ilike(term)
            )

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar()

    base = base.order_by(Patient.patient_number.asc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(base)
    rows = result.all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_build_patient_out(patient, last_visit) for patient, last_visit in rows],
    }


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate,
    request: Request,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    # PM-001: Duplicate detection by name + DOB
    if payload.date_of_birth:
        dup = await db.execute(
            select(Patient).where(
                Patient.clinic_id == current_user.clinic_id,
                func.lower(Patient.first_name) == payload.first_name.lower(),
                func.lower(Patient.last_name) == payload.last_name.lower(),
                Patient.date_of_birth == payload.date_of_birth,
                Patient.is_active == True,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A patient with the same name and date of birth already exists.",
            )

    patient_number = await _next_patient_number(db, current_user.clinic_id)
    patient = Patient(
        **payload.model_dump(),
        clinic_id=current_user.clinic_id,
        patient_number=patient_number,
    )
    db.add(patient)
    await db.flush()
    await db.refresh(patient)

    await _write_audit(db, user=current_user, action="create", resource_id=str(patient.id), request=request)

    return _build_patient_out(patient, None)


@router.get("/{patient_id}/medical-history", response_model=list[MedicalHistoryVersionOut])
async def get_medical_history(
    patient_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    """Returns the versioned medical history for a patient, newest first."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    clinic_scope(current_user, patient.clinic_id)

    versions_result = await db.execute(
        select(MedicalHistoryVersion)
        .where(MedicalHistoryVersion.patient_id == patient_id)
        .order_by(MedicalHistoryVersion.created_at.desc())
    )
    versions = versions_result.scalars().all()

    out = []
    for v in versions:
        item = MedicalHistoryVersionOut.model_validate(v)
        if v.changed_by:
            item.changed_by_name = v.changed_by.full_name
        out.append(item)
    return out


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    last_visit_col = _last_visit_subq()
    result = await db.execute(
        select(Patient, last_visit_col).where(Patient.id == patient_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    patient, last_visit = row
    clinic_scope(current_user, patient.clinic_id)
    return _build_patient_out(patient, last_visit)


@router.patch("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: uuid.UUID,
    payload: PatientUpdate,
    request: Request,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    clinic_scope(current_user, patient.clinic_id)

    updates = payload.model_dump(exclude_unset=True)
    medical_changed = {k for k in updates if k in MEDICAL_FIELDS}

    # Track old vs new for audit log
    changes = {
        field: {"old": getattr(patient, field), "new": updates[field]}
        for field in updates
        if getattr(patient, field) != updates[field]
    }

    for field, value in updates.items():
        setattr(patient, field, value)

    # PM-002: If any medical field changed, snapshot the new state as a version
    if medical_changed:
        version = MedicalHistoryVersion(
            clinic_id=patient.clinic_id,
            patient_id=patient.id,
            changed_by_id=current_user.id,
            allergies=patient.allergies,
            medications=patient.medications,
            prior_conditions=patient.medical_history,
        )
        db.add(version)

    if changes:
        await _write_audit(
            db, user=current_user, action="update",
            resource_id=str(patient.id), changes=changes, request=request,
        )

    await db.flush()
    await db.refresh(patient)

    last_visit_col = _last_visit_subq()
    lv_result = await db.execute(select(Patient, last_visit_col).where(Patient.id == patient_id))
    row = lv_result.one_or_none()
    last_visit = row[1] if row else None

    return _build_patient_out(patient, last_visit)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_patient(
    patient_id: uuid.UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    clinic_scope(current_user, patient.clinic_id)
    patient.is_active = False
    await _write_audit(db, user=current_user, action="delete", resource_id=str(patient.id), request=request)


# ── Private helpers ────────────────────────────────────────────────────────────

def _parse_patient_number(search: str) -> int | None:
    """Parse 'PA-0023' or '23' into 23; return None if not a patient number."""
    s = search.upper()
    if s.startswith("PA-"):
        s = s[3:]
    try:
        return int(s)
    except ValueError:
        return None
