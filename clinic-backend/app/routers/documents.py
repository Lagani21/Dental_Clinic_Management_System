import uuid
import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.document import Document, DocumentType
from app.models.patient import Patient
from app.auth.rbac import CurrentUser, require_any_staff, clinic_scope
from app.config import settings
from app.schemas.document import DocumentOut

router = APIRouter(prefix="/patients/{patient_id}/documents", tags=["documents"])


def _upload_dir(clinic_id: uuid.UUID, patient_id: uuid.UUID) -> Path:
    path = Path(settings.UPLOAD_DIR) / str(clinic_id) / str(patient_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _local_url(request: Request, relative_key: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/uploads/{relative_key}"


async def _get_patient_or_404(
    patient_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession,
) -> Patient:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    clinic_scope(current_user, patient.clinic_id)
    return patient


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    patient_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    await _get_patient_or_404(patient_id, current_user, db)
    result = await db.execute(
        select(Document)
        .where(Document.patient_id == patient_id)
        .order_by(Document.created_at.desc())
    )
    return [DocumentOut.model_validate(d) for d in result.scalars().all()]


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    patient_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    document_type: DocumentType = Form(DocumentType.OTHER),
    title: str = Form(...),
    description: str | None = Form(None),
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    patient = await _get_patient_or_404(patient_id, current_user, db)

    # Generate a unique filename to prevent collisions
    ext = Path(file.filename).suffix if file.filename else ""
    unique_name = f"{uuid.uuid4()}{ext}"
    relative_key = f"{patient.clinic_id}/{patient_id}/{unique_name}"

    dest = _upload_dir(patient.clinic_id, patient_id) / unique_name
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = dest.stat().st_size

    doc = Document(
        clinic_id=patient.clinic_id,
        patient_id=patient_id,
        uploaded_by_id=current_user.id,
        document_type=document_type,
        title=title,
        description=description,
        s3_key=relative_key,
        s3_url=_local_url(request, relative_key),
        file_name=file.filename or unique_name,
        file_size_bytes=file_size,
        mime_type=file.content_type,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    patient_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_any_staff),
    db: AsyncSession = Depends(get_db),
):
    await _get_patient_or_404(patient_id, current_user, db)

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.patient_id == patient_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Remove physical file
    file_path = Path(settings.UPLOAD_DIR) / doc.s3_key
    if file_path.exists():
        file_path.unlink()

    await db.delete(doc)
