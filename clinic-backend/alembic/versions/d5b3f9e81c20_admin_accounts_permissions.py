"""AM-001: nurse/compounder roles, account_permissions, permission_audit_log

Revision ID: d5b3f9e81c20
Revises: c4a8e1b23f56
Create Date: 2026-04-09

Note on ALTER TYPE ADD VALUE:
  PostgreSQL 12+ allows ADD VALUE (without BEFORE/AFTER) inside a transaction.
  IF NOT EXISTS makes the statement idempotent on re-runs.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "d5b3f9e81c20"
down_revision: Union[str, None] = "c4a8e1b23f56"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Extend userrole enum ────────────────────────────────────────────────
    # PostgreSQL 12+ allows ALTER TYPE ADD VALUE inside a transaction when no
    # BEFORE/AFTER ordering is used. IF NOT EXISTS prevents errors on re-runs.
    op.execute(sa.text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'nurse'"))
    op.execute(sa.text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'compounder'"))

    # ── 2. account_permissions ─────────────────────────────────────────────────
    op.create_table(
        "account_permissions",
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("permission", sa.String(100), nullable=False),
        sa.Column("granted", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["account_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("account_id", "permission"),
    )
    op.create_index(
        "ix_account_permissions_account_id",
        "account_permissions",
        ["account_id"],
    )

    # ── 3. permission_audit_log ────────────────────────────────────────────────
    op.create_table(
        "permission_audit_log",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("permission", sa.String(100), nullable=False),
        sa.Column("old_value", sa.Boolean(), nullable=True),
        sa.Column("new_value", sa.Boolean(), nullable=False),
        sa.Column("changed_by", sa.UUID(), nullable=False),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_permission_audit_log_account_id",
        "permission_audit_log",
        ["account_id"],
    )
    op.create_index(
        "ix_permission_audit_log_changed_at",
        "permission_audit_log",
        ["changed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_permission_audit_log_changed_at", table_name="permission_audit_log")
    op.drop_index("ix_permission_audit_log_account_id", table_name="permission_audit_log")
    op.drop_table("permission_audit_log")

    op.drop_index("ix_account_permissions_account_id", table_name="account_permissions")
    op.drop_table("account_permissions")

    # PostgreSQL cannot remove enum values after addition.
    # To fully revert the nurse/compounder values you must recreate the type:
    #   ALTER TYPE userrole RENAME TO userrole_old;
    #   CREATE TYPE userrole AS ENUM ('superadmin','clinic_owner','doctor','receptionist');
    #   ALTER TABLE users ALTER COLUMN role TYPE userrole USING role::text::userrole;
    #   DROP TYPE userrole_old;
