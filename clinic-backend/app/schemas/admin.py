import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole

_STAFF_ROLES = {UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.NURSE, UserRole.COMPOUNDER}


class AccountCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    role: UserRole
    password: str | None = None  # None = auto-generate

    @field_validator("role")
    @classmethod
    def role_must_be_staff(cls, v: UserRole) -> UserRole:
        if v not in _STAFF_ROLES:
            raise ValueError("Cannot create accounts for this role via admin panel")
        return v


class AccountUpdate(BaseModel):
    full_name: str | None = None  # split on first space when provided
    phone: str | None = None
    is_active: bool | None = None
    # role is intentionally excluded — role cannot change after creation


class PermissionToggle(BaseModel):
    permission: str
    granted: bool


class PermissionOut(BaseModel):
    permission: str
    granted: bool
    is_default: bool
    is_locked: bool

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: uuid.UUID
    permission: str
    old_value: bool | None
    new_value: bool
    changed_by_name: str
    changed_at: datetime
    note: str | None

    model_config = {"from_attributes": True}


class AccountOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    permissions: list[PermissionOut] = []
    permission_count: int = 0

    model_config = {"from_attributes": True}
