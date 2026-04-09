import uuid
from datetime import date, time, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from app.database import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.user import User, UserRole
from app.auth.rbac import get_current_user, CurrentUser, require_any_staff, require_doctor_or_above, clinic_scope
from app.schemas.appointment import (
    AppointmentCreate, AppointmentUpdate, AppointmentStatusUpdate,
    AppointmentOut, AppointmentReschedule, AvailabilitySlot,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])

# ── Procedure → default duration (minutes) ────────────────────────────────────
PROCEDURE_DURATIONS: dict[str, int] = {
    "consultation":       20,
    "checkup":            30,
    "cleaning":           45,
    "filling":            45,
    "root_canal":         90,
    "extraction":         30,
    "crown":              60,
    "bridge":             60,
    "implant":            90,
    "whitening":          60,
    "orthodontics":       30,
    "x_ray":              15,
    "other":              30,
}

CANCELLATION_TYPES = {"patient_request", "clinic_initiated", "no_show"}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _end_minutes(start: time, duration: int) -> int:
    return start.hour * 60 + start.minute + duration


def _times_overlap(s1: time, d1: int, s2: time, d2: int) -> bool:
    """True if two [start, start+duration) intervals overlap."""
    start1 = s1.hour * 60 + s1.minute
    end1   = start1 + d1
    start2 = s2.hour * 60 + s2.minute
    end2   = start2 + d2
    return start1 < end2 and start2 < end1


async def _check_double_booking(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    doctor_id: uuid.UUID,
    appt_date: date,
    start: time,
    duration: int,
    exclude_id: uuid.UUID | None = None,
):
    """Raise 409 if the doctor already has an overlapping active appointment."""
    q = select(Appointment).where(
        Appointment.clinic_id == clinic_id,
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appt_date,
        Appointment.status.not_in([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
    )
    if exclude_id:
        q = q.where(Appointment.id != exclude_id)

    result = await db.execute(q)
    existing = result.scalars().all()

    for existing_appt in existing:
        if _times_overlap(start, duration, existing_appt.start_time, existing_appt.duration_minutes):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Doctor already has an appointment from "
                    f"{existing_appt.start_time.strftime('%H:%M')} "
                    f"({existing_appt.duration_minutes} min) on that date."
                ),
            )


def _enrich(appt: Appointment) -> AppointmentOut:
    out = AppointmentOut.model_validate(appt)
    if appt.patient:
        out.patient_name = appt.patient.full_name
        out.patient_id_label = appt.patient.patient_id
        out.allergies = appt.patient.allergies
        out.last_visit = None  # populated lazily if needed
    if appt.doctor:
        out.doctor_name = appt.doctor.full_name
    return out


# ── Availability ───────────────────────────────────────────────────────────────

@router.get("/availability", response_model=list[AvailabilitySlot])
async def get_availability(
    doctor_id: uuid.UUID = Query(...),
    appt_date: date = Query(...),
    duration: int = Query(30, ge=10, le=240),
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    """Return 30-minute slots from 09:00-18:00, marked free/busy for the given doctor+date."""
    result = await db.execute(
        select(Appointment).where(
            Appointment.clinic_id == current_user.clinic_id,
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == appt_date,
            Appointment.status.not_in([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
        )
    )
    booked = result.scalars().all()

    slots: list[AvailabilitySlot] = []
    for hour in range(9, 18):
        for minute in (0, 30):
            slot_start = time(hour, minute)
            is_free = not any(
                _times_overlap(slot_start, duration, b.start_time, b.duration_minutes)
                for b in booked
            )
            slots.append(AvailabilitySlot(
                start_time=slot_start.strftime("%H:%M"),
                available=is_free,
            ))
    return slots


# ── Doctors list (for booking form) ───────────────────────────────────────────

@router.get("/doctors", response_model=list[dict])
async def list_doctors(
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.clinic_id == current_user.clinic_id,
            User.role == UserRole.DOCTOR,
            User.is_active == True,
        ).order_by(User.first_name)
    )
    return [
        {"id": str(u.id), "full_name": u.full_name, "specialization": u.specialization}
        for u in result.scalars().all()
    ]


# ── CRUD ───────────────────────────────────────────────────────────────────────

@router.get("", response_model=dict)
async def list_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    appointment_date: date | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    doctor_id: uuid.UUID | None = Query(None),
    appt_status: AppointmentStatus | None = Query(None, alias="status"),
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Appointment)
        .where(Appointment.clinic_id == current_user.clinic_id)
        .order_by(Appointment.appointment_date, Appointment.start_time)
    )

    if appointment_date:
        query = query.where(Appointment.appointment_date == appointment_date)
    if date_from:
        query = query.where(Appointment.appointment_date >= date_from)
    if date_to:
        query = query.where(Appointment.appointment_date <= date_to)
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    if appt_status:
        query = query.where(Appointment.status == appt_status)
    if current_user.is_doctor:
        query = query.where(Appointment.doctor_id == current_user.id)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.offset((page - 1) * page_size).limit(page_size)

    # Eager-load patient + doctor for enriched output
    from sqlalchemy.orm import selectinload
    query = query.options(
        selectinload(Appointment.patient),
        selectinload(Appointment.doctor),
    )

    result = await db.execute(query)
    appointments = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_enrich(a) for a in appointments],
    }


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    # Auto-set duration from procedure type if not provided
    duration = payload.duration_minutes
    if payload.procedure_type and duration == 30:
        duration = PROCEDURE_DURATIONS.get(payload.procedure_type, 30)

    await _check_double_booking(
        db, current_user.clinic_id,
        payload.doctor_id, payload.appointment_date,
        payload.start_time, duration,
    )

    appt = Appointment(
        **{**payload.model_dump(), "duration_minutes": duration},
        clinic_id=current_user.clinic_id,
        booked_by_id=current_user.id,
    )
    db.add(appt)
    await db.flush()
    await db.refresh(appt)

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient), selectinload(Appointment.doctor))
        .where(Appointment.id == appt.id)
    )
    return _enrich(result.scalar_one())


@router.get("/{appointment_id}", response_model=AppointmentOut)
async def get_appointment(
    appointment_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient), selectinload(Appointment.doctor))
        .where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    clinic_scope(current_user, appt.clinic_id)
    return _enrich(appt)


@router.patch("/{appointment_id}/reschedule", response_model=AppointmentOut)
async def reschedule_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentReschedule,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    """AP-004: Reschedule with a required reason."""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient), selectinload(Appointment.doctor))
        .where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    clinic_scope(current_user, appt.clinic_id)

    if appt.status in (AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED):
        raise HTTPException(status_code=400, detail="Cannot reschedule a completed or cancelled appointment.")

    await _check_double_booking(
        db, appt.clinic_id,
        appt.doctor_id,
        payload.appointment_date,
        payload.start_time,
        appt.duration_minutes,
        exclude_id=appointment_id,
    )

    appt.appointment_date = payload.appointment_date
    appt.start_time = payload.start_time
    if payload.chair is not None:
        appt.chair = payload.chair
    appt.notes = (appt.notes or "") + f"\n[Rescheduled] {payload.reason}".strip()

    await db.flush()
    await db.refresh(appt)
    return _enrich(appt)


@router.patch("/{appointment_id}/status", response_model=AppointmentOut)
async def update_appointment_status(
    appointment_id: uuid.UUID,
    payload: AppointmentStatusUpdate,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    """AP-004: Cancel / mark no-show with a required cancellation_type."""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient), selectinload(Appointment.doctor))
        .where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    clinic_scope(current_user, appt.clinic_id)

    if payload.status in (AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW):
        if not payload.cancellation_reason:
            raise HTTPException(status_code=400, detail="cancellation_reason is required when cancelling or marking no-show.")
        if payload.cancellation_type and payload.cancellation_type not in CANCELLATION_TYPES:
            raise HTTPException(status_code=400, detail=f"cancellation_type must be one of: {CANCELLATION_TYPES}")
        appt.cancellation_reason = payload.cancellation_reason
        appt.cancellation_type = payload.cancellation_type

    appt.status = payload.status
    if payload.notes:
        appt.notes = payload.notes

    await db.flush()
    await db.refresh(appt)
    return _enrich(appt)


@router.patch("/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentUpdate,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient), selectinload(Appointment.doctor))
        .where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    clinic_scope(current_user, appt.clinic_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(appt, field, value)

    await db.flush()
    await db.refresh(appt)
    return _enrich(appt)
