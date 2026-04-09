"""
Role-Based Access Control (RBAC) for DentFlow.

Role hierarchy (highest to lowest):
  superadmin    → full platform access
  clinic_owner  → full access within their clinic
  doctor        → clinical data + own appointments
  receptionist  → scheduling, patient intake, billing view
"""
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.jwt import decode_token
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer()


class CurrentUser:
    """Resolved from JWT — attached to every authenticated request."""
    def __init__(self, user: User):
        self.id = user.id
        self.email = user.email
        self.role = user.role
        self.clinic_id = user.clinic_id
        self.full_name = user.full_name
        self._user = user

    @property
    def is_superadmin(self) -> bool:
        return self.role == UserRole.SUPERADMIN

    @property
    def is_clinic_owner(self) -> bool:
        return self.role == UserRole.CLINIC_OWNER

    @property
    def is_doctor(self) -> bool:
        return self.role == UserRole.DOCTOR

    @property
    def is_receptionist(self) -> bool:
        return self.role == UserRole.RECEPTIONIST


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except ValueError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id), User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise credentials_exception

    return CurrentUser(user)


def require_roles(*roles: UserRole):
    """Dependency factory — restricts endpoint to specified roles."""
    async def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in roles]}",
            )
        return current_user
    return _check


def clinic_scope(current_user: CurrentUser, clinic_id: uuid.UUID) -> None:
    """Raises 403 if the user doesn't belong to the given clinic (unless superadmin)."""
    if current_user.is_superadmin:
        return
    if current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this clinic")


# Pre-built role sets for common use
require_doctor_or_above = require_roles(UserRole.DOCTOR, UserRole.CLINIC_OWNER, UserRole.SUPERADMIN)
require_owner_or_above = require_roles(UserRole.CLINIC_OWNER, UserRole.SUPERADMIN)
require_any_staff = require_roles(
    UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.CLINIC_OWNER, UserRole.SUPERADMIN
)
