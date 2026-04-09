"""
AM-001: Admin Account Management
- CRUD for staff accounts (doctor | receptionist | nurse | compounder)
- Per-account permission overrides seeded from DEFAULT_PERMISSIONS
- Permission audit log with immutable records
"""
import secrets
import string
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import hash_password
from app.auth.rbac import CurrentUser, require_owner_or_above
from app.database import get_db
from app.models.account_permissions import AccountPermission, PermissionAuditLog
from app.models.user import User, UserRole
from app.permissions import DEFAULT_PERMISSIONS, LOCKED_ON, OWNER_ONLY_GRANT, PERMISSIONS
from app.schemas.admin import (
    AccountCreate,
    AccountOut,
    AccountUpdate,
    AuditLogOut,
    PermissionOut,
    PermissionToggle,
)

router = APIRouter(prefix="/admin/accounts", tags=["admin-accounts"])

_PROTECTED_ROLES = {UserRole.SUPERADMIN, UserRole.CLINIC_OWNER}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _gen_password(length: int = 12) -> str:
    alpha = string.ascii_letters + string.digits
    return "".join(secrets.choice(alpha) for _ in range(length))


def _split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""


def _perm_out(perm: AccountPermission, role: UserRole) -> PermissionOut:
    role_key = role.value
    defaults = set(DEFAULT_PERMISSIONS.get(role_key, []))
    locked   = LOCKED_ON.get(role_key, set())
    return PermissionOut(
        permission=perm.permission,
        granted=perm.granted,
        is_default=(perm.permission in defaults),
        is_locked=(perm.permission in locked),
    )


def _build_out(user: User, perms: list[AccountPermission]) -> AccountOut:
    role_key = user.role.value
    defaults = set(DEFAULT_PERMISSIONS.get(role_key, []))
    locked   = LOCKED_ON.get(role_key, set())
    perm_outs = [
        PermissionOut(
            permission=p.permission,
            granted=p.granted,
            is_default=(p.permission in defaults),
            is_locked=(p.permission in locked),
        )
        for p in sorted(perms, key=lambda x: x.permission)
    ]
    return AccountOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        permissions=perm_outs,
        permission_count=sum(1 for p in perms if p.granted),
    )


async def _get_staff_user(
    account_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession,
) -> User:
    result = await db.execute(select(User).where(User.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    if account.role in _PROTECTED_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot manage this account type")
    if not user.is_superadmin and account.clinic_id != user.clinic_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    return account


async def _load_perms(account_id: uuid.UUID, db: AsyncSession) -> list[AccountPermission]:
    result = await db.execute(
        select(AccountPermission).where(AccountPermission.account_id == account_id)
    )
    return result.scalars().all()


# ── POST /admin/accounts ───────────────────────────────────────────────────────

@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(
    body: AccountCreate,
    db:   AsyncSession = Depends(get_db),
    user: CurrentUser  = Depends(require_owner_or_above),
):
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    first, last = _split_name(body.full_name)
    raw_pw = body.password or _gen_password()

    account = User(
        clinic_id=user.clinic_id,
        email=body.email,
        hashed_password=hash_password(raw_pw),
        role=body.role,
        first_name=first,
        last_name=last,
        phone=body.phone,
        is_active=True,
    )
    db.add(account)
    await db.flush()  # get account.id

    # Seed permissions from role defaults
    role_key = body.role.value
    defaults = set(DEFAULT_PERMISSIONS.get(role_key, []))
    for p in PERMISSIONS:
        db.add(AccountPermission(
            account_id=account.id,
            permission=p,
            granted=(p in defaults),
        ))

    await db.flush()
    await db.refresh(account)
    perms = await _load_perms(account.id, db)
    return _build_out(account, perms)


# ── GET /admin/accounts ────────────────────────────────────────────────────────

@router.get("", response_model=list[AccountOut])
async def list_accounts(
    role: str | None   = Query(None),
    db:   AsyncSession = Depends(get_db),
    user: CurrentUser  = Depends(require_owner_or_above),
):
    # Count of granted permissions per account via subquery
    count_sq = (
        select(
            AccountPermission.account_id,
            func.count().label("cnt"),
        )
        .where(AccountPermission.granted == True)
        .group_by(AccountPermission.account_id)
        .subquery()
    )

    stmt = (
        select(User, count_sq.c.cnt)
        .outerjoin(count_sq, User.id == count_sq.c.account_id)
        .where(
            User.clinic_id == user.clinic_id,
            User.role.notin_([UserRole.SUPERADMIN, UserRole.CLINIC_OWNER]),
        )
        .order_by(User.created_at.desc())
    )

    if role:
        try:
            stmt = stmt.where(User.role == UserRole(role))
        except ValueError:
            pass  # unknown role → return all

    rows = (await db.execute(stmt)).all()

    return [
        AccountOut(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            phone=u.phone,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at,
            permissions=[],
            permission_count=cnt or 0,
        )
        for u, cnt in rows
    ]


# ── GET /admin/accounts/:id ────────────────────────────────────────────────────

@router.get("/{account_id}", response_model=AccountOut)
async def get_account(
    account_id: uuid.UUID,
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_owner_or_above),
):
    account = await _get_staff_user(account_id, user, db)
    perms   = await _load_perms(account_id, db)
    return _build_out(account, perms)


# ── PATCH /admin/accounts/:id ─────────────────────────────────────────────────

@router.patch("/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: uuid.UUID,
    body:       AccountUpdate,
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_owner_or_above),
):
    account = await _get_staff_user(account_id, user, db)

    if body.full_name is not None:
        account.first_name, account.last_name = _split_name(body.full_name)
    if body.phone is not None:
        account.phone = body.phone
    if body.is_active is not None:
        account.is_active = body.is_active

    await db.flush()
    await db.refresh(account)
    perms = await _load_perms(account_id, db)
    return _build_out(account, perms)


# ── PATCH /admin/accounts/:id/permissions ─────────────────────────────────────

@router.patch("/{account_id}/permissions", response_model=list[PermissionOut])
async def update_permissions(
    account_id: uuid.UUID,
    toggles:    list[PermissionToggle],
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_owner_or_above),
):
    account  = await _get_staff_user(account_id, user, db)
    role_key = account.role.value
    locked   = LOCKED_ON.get(role_key, set())

    for toggle in toggles:
        perm = toggle.permission

        # Rule 2: locked-on permissions cannot be turned off
        if perm in locked and not toggle.granted:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"'{perm}' is locked ON for role '{role_key}' and cannot be disabled",
            )

        # Rule 3: admin.staff can only be granted by clinic_owner or superadmin
        if perm in OWNER_ONLY_GRANT and toggle.granted:
            if not (user.is_clinic_owner or user.is_superadmin):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    f"Only clinic_owner or superadmin can grant '{perm}'",
                )

        # Load current value for audit
        existing_row = (await db.execute(
            select(AccountPermission).where(
                and_(
                    AccountPermission.account_id == account_id,
                    AccountPermission.permission == perm,
                )
            )
        )).scalar_one_or_none()

        old_value = existing_row.granted if existing_row is not None else None

        # Rule 4: write audit log BEFORE updating
        db.add(PermissionAuditLog(
            id=uuid.uuid4(),
            account_id=account_id,
            permission=perm,
            old_value=old_value,
            new_value=toggle.granted,
            changed_by=user.id,
        ))

        if existing_row is not None:
            existing_row.granted = toggle.granted
        else:
            db.add(AccountPermission(
                account_id=account_id,
                permission=perm,
                granted=toggle.granted,
            ))

    await db.flush()
    perms = await _load_perms(account_id, db)
    return [_perm_out(p, account.role) for p in sorted(perms, key=lambda x: x.permission)]


# ── DELETE /admin/accounts/:id — soft delete ───────────────────────────────────

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_account(
    account_id: uuid.UUID,
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_owner_or_above),
):
    account = await _get_staff_user(account_id, user, db)
    account.is_active = False
    await db.flush()


# ── GET /admin/accounts/:id/audit ─────────────────────────────────────────────

@router.get("/{account_id}/audit", response_model=list[AuditLogOut])
async def get_audit_log(
    account_id: uuid.UUID,
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_owner_or_above),
):
    await _get_staff_user(account_id, user, db)  # scope check

    rows = (await db.execute(
        select(PermissionAuditLog, User.first_name, User.last_name)
        .join(User, PermissionAuditLog.changed_by == User.id)
        .where(PermissionAuditLog.account_id == account_id)
        .order_by(PermissionAuditLog.changed_at.desc())
    )).all()

    return [
        AuditLogOut(
            id=log.id,
            permission=log.permission,
            old_value=log.old_value,
            new_value=log.new_value,
            changed_by_name=f"{first} {last}".strip(),
            changed_at=log.changed_at,
            note=log.note,
        )
        for log, first, last in rows
    ]
