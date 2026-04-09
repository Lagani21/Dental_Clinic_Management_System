import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: UserRole
    phone: str | None = None
    specialization: str | None = None
    mci_number: str | None = None
    clinic_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    specialization: str | None = None
    mci_number: str | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    first_name: str
    last_name: str
    full_name: str
    phone: str | None
    specialization: str | None
    mci_number: str | None
    clinic_id: uuid.UUID | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
