"""
Single source of truth for role → permission defaults.
Update this file to change defaults — no migration required.
"""

# All permission strings in the system
PERMISSIONS: list[str] = [
    # Patient Management
    "patient.view",
    "patient.edit",
    "patient.delete",
    # Appointments
    "appointment.view",
    "appointment.manage",
    # Clinical Records
    "clinical.notes.write",
    "clinical.chart",
    "clinical.xray",
    # Billing & Prescriptions
    "prescription.create",
    "billing.view",
    "billing.edit",
    # Reporting & Admin
    "report.own",
    "report.clinic",
    "admin.staff",
]

# Permissions ON by default per role (everything else is OFF)
DEFAULT_PERMISSIONS: dict[str, list[str]] = {
    "doctor": [
        "patient.view",
        "patient.edit",
        "appointment.view",
        "clinical.notes.write",
        "clinical.chart",
        "prescription.create",
    ],
    "receptionist": [
        "patient.view",
        "patient.edit",
        "appointment.view",
        "appointment.manage",
        "billing.view",
    ],
    "nurse": [
        "patient.view",
        "appointment.view",
        "clinical.notes.write",
    ],
    "compounder": [
        "billing.view",
    ],
}

# Permissions that can NEVER be toggled OFF for specific roles
LOCKED_ON: dict[str, set[str]] = {
    "doctor": {"patient.view"},
    "nurse":  {"patient.view"},
}

# Permissions that require clinic_owner or superadmin to GRANT
OWNER_ONLY_GRANT: set[str] = {"admin.staff"}
