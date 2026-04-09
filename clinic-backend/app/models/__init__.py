# Import all models here so Alembic can detect them
from app.models.clinic import Clinic
from app.models.user import User, UserRole
from app.models.patient import Patient, BloodGroup, Gender, MedicalHistoryVersion
from app.models.appointment import Appointment, AppointmentStatus
from app.models.clinical import TreatmentPlan, TreatmentRecord, TreatmentPlanStatus
from app.models.billing import Invoice, InvoiceItem, InvoiceStatus, PaymentMethod
from app.models.prescription import Prescription, PrescriptionItem
from app.models.document import Document, DocumentType
from app.models.inventory import InventoryItem, InventoryCategory
from app.models.audit import AuditLog
from app.models.clinical_records import (
    DentalChart, ClinicalNote, ClinicalNoteAmend, PerioExam, PerioMeasurement, NotationSystem
)

__all__ = [
    "Clinic",
    "User", "UserRole",
    "Patient", "BloodGroup", "Gender", "MedicalHistoryVersion",
    "Appointment", "AppointmentStatus",
    "TreatmentPlan", "TreatmentRecord", "TreatmentPlanStatus",
    "Invoice", "InvoiceItem", "InvoiceStatus", "PaymentMethod",
    "Prescription", "PrescriptionItem",
    "Document", "DocumentType",
    "InventoryItem", "InventoryCategory",
    "AuditLog",
    "DentalChart", "ClinicalNote", "ClinicalNoteAmend",
    "PerioExam", "PerioMeasurement", "NotationSystem",
]
