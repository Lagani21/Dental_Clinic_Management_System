"""AP-001/002/004: appointment chair, cancellation_type, procedure_type columns

Revision ID: b7e2d4f91a03
Revises: a3f1c9d82b45
Create Date: 2026-04-08
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "b7e2d4f91a03"
down_revision: Union[str, None] = "a3f1c9d82b45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("cancellation_type", sa.String(length=50), nullable=True))
    op.add_column("appointments", sa.Column("chair", sa.String(length=50), nullable=True))
    op.add_column("appointments", sa.Column("procedure_type", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("appointments", "procedure_type")
    op.drop_column("appointments", "chair")
    op.drop_column("appointments", "cancellation_type")
