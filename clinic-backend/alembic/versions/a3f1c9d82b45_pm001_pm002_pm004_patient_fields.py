"""PM-001/002/004: patient registration, medical history versioning, search fields

Revision ID: a3f1c9d82b45
Revises: 807685c218cd
Create Date: 2026-04-08

Changes:
- patients: add insurance_id, patient_number, photo_url, medications
- patients: unique constraint on (clinic_id, patient_number)
- patients: index on patient_number
- Create medical_history_versions table
- PostgreSQL: create pg_trgm extension + GIN indexes for fuzzy search (PM-004)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a3f1c9d82b45"
down_revision: Union[str, None] = "807685c218cd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── patients: new columns ──────────────────────────────────────────────────
    op.add_column("patients", sa.Column("insurance_id", sa.String(length=100), nullable=True))
    op.add_column("patients", sa.Column("medications", sa.Text(), nullable=True))
    op.add_column("patients", sa.Column("patient_number", sa.Integer(), nullable=True))
    op.add_column("patients", sa.Column("photo_url", sa.String(length=500), nullable=True))

    op.create_index("ix_patients_patient_number", "patients", ["patient_number"])
    op.create_unique_constraint(
        "uq_patient_clinic_number", "patients", ["clinic_id", "patient_number"]
    )

    # ── medical_history_versions ───────────────────────────────────────────────
    op.create_table(
        "medical_history_versions",
        sa.Column("clinic_id", sa.UUID(), nullable=False),
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("changed_by_id", sa.UUID(), nullable=True),
        sa.Column("allergies", sa.Text(), nullable=True),
        sa.Column("medications", sa.Text(), nullable=True),
        sa.Column("prior_conditions", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["changed_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_medical_history_versions_clinic_id", "medical_history_versions", ["clinic_id"])
    op.create_index("ix_medical_history_versions_patient_id", "medical_history_versions", ["patient_id"])

    # ── PostgreSQL only: pg_trgm for sub-second fuzzy search on 100k records ──
    # These statements are no-ops on SQLite (dev), but critical for production.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        bind.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_patients_name_trgm "
            "ON patients USING GIN ((first_name || ' ' || last_name) gin_trgm_ops)"
        ))
        bind.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_patients_phone_trgm "
            "ON patients USING GIN (phone gin_trgm_ops)"
        ))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text("DROP INDEX IF EXISTS ix_patients_phone_trgm"))
        bind.execute(sa.text("DROP INDEX IF EXISTS ix_patients_name_trgm"))

    op.drop_index("ix_medical_history_versions_patient_id", table_name="medical_history_versions")
    op.drop_index("ix_medical_history_versions_clinic_id", table_name="medical_history_versions")
    op.drop_table("medical_history_versions")

    op.drop_constraint("uq_patient_clinic_number", "patients", type_="unique")
    op.drop_index("ix_patients_patient_number", table_name="patients")
    op.drop_column("patients", "photo_url")
    op.drop_column("patients", "patient_number")
    op.drop_column("patients", "medications")
    op.drop_column("patients", "insurance_id")
