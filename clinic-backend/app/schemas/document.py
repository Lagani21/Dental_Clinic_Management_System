import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.document import DocumentType


class DocumentOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    uploaded_by_id: uuid.UUID
    document_type: DocumentType
    title: str
    description: str | None
    s3_url: str
    file_name: str
    file_size_bytes: int | None
    mime_type: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
