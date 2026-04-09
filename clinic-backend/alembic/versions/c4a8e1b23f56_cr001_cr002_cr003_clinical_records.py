"""CR-001/002/003: dental chart, clinical notes, periodontal charting tables

Revision ID: c4a8e1b23f56
Revises: b7e2d4f91a03
Create Date: 2026-04-08
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "c4a8e1b23f56"
down_revision: Union[str, None] = "b7e2d4f91a03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── dental_charts ──────────────────────────────────────────────────────────
    op.create_table(
        "dental_charts",
        sa.Column("clinic_id", sa.UUID(), nullable=False),
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("notation_system",
                  sa.Enum("fdi", "universal", name="notationsystem"), nullable=False,
                  server_default="fdi"),
        sa.Column("chart_data",    postgresql.JSONB(), nullable=True),
        sa.Column("tooth_status",  postgresql.JSONB(), nullable=True),
        sa.Column("last_modified_by_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["last_modified_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("patient_id"),
    )
    op.create_index("ix_dental_charts_clinic_id", "dental_charts", ["clinic_id"])

    # ── clinical_notes ─────────────────────────────────────────────────────────
    op.create_table(
        "clinical_notes",
        sa.Column("clinic_id",       sa.UUID(), nullable=False),
        sa.Column("patient_id",      sa.UUID(), nullable=False),
        sa.Column("doctor_id",       sa.UUID(), nullable=False),
        sa.Column("appointment_id",  sa.UUID(), nullable=True),
        sa.Column("visit_date",      sa.Date(), nullable=False),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("examination",     sa.Text(), nullable=True),
        sa.Column("assessment",      sa.Text(), nullable=True),
        sa.Column("plan",            sa.Text(), nullable=True),
        sa.Column("procedures_done", sa.Text(), nullable=True),
        sa.Column("is_locked",       sa.Boolean(), server_default="false", nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["clinic_id"],      ["clinics.id"],       ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["patient_id"],     ["patients.id"],      ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["doctor_id"],      ["users.id"],         ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"],  ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_clinical_notes_clinic_id",   "clinical_notes", ["clinic_id"])
    op.create_index("ix_clinical_notes_patient_id",  "clinical_notes", ["patient_id"])

    # ── clinical_note_amends ───────────────────────────────────────────────────
    op.create_table(
        "clinical_note_amends",
        sa.Column("note_id",        sa.UUID(), nullable=False),
        sa.Column("amended_by_id",  sa.UUID(), nullable=False),
        sa.Column("reason",         sa.Text(), nullable=False),
        sa.Column("snapshot",       postgresql.JSONB(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["note_id"],       ["clinical_notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["amended_by_id"], ["users.id"],          ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_clinical_note_amends_note_id", "clinical_note_amends", ["note_id"])

    # ── perio_exams ────────────────────────────────────────────────────────────
    op.create_table(
        "perio_exams",
        sa.Column("clinic_id",  sa.UUID(), nullable=False),
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("doctor_id",  sa.UUID(), nullable=False),
        sa.Column("exam_date",  sa.Date(), nullable=False),
        sa.Column("notes",      sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["clinic_id"],  ["clinics.id"],  ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["doctor_id"],  ["users.id"],    ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_perio_exams_clinic_id",  "perio_exams", ["clinic_id"])
    op.create_index("ix_perio_exams_patient_id", "perio_exams", ["patient_id"])

    # ── perio_measurements ─────────────────────────────────────────────────────
    op.create_table(
        "perio_measurements",
        sa.Column("exam_id",      sa.UUID(), nullable=False),
        sa.Column("tooth_number", sa.Integer(), nullable=False),
        sa.Column("db", sa.Integer(), nullable=True),
        sa.Column("b",  sa.Integer(), nullable=True),
        sa.Column("mb", sa.Integer(), nullable=True),
        sa.Column("dl", sa.Integer(), nullable=True),
        sa.Column("l",  sa.Integer(), nullable=True),
        sa.Column("ml", sa.Integer(), nullable=True),
        sa.Column("bleeding",  postgresql.JSONB(), nullable=True),
        sa.Column("furcation", postgresql.JSONB(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["exam_id"], ["perio_exams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_perio_measurements_exam_id", "perio_measurements", ["exam_id"])


def downgrade() -> None:
    op.drop_table("perio_measurements")
    op.drop_table("perio_exams")
    op.drop_table("clinical_note_amends")
    op.drop_table("clinical_notes")
    op.drop_table("dental_charts")
    op.execute("DROP TYPE IF EXISTS notationsystem")
