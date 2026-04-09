// Single source of truth for permissions on the frontend.
// Must stay in sync with clinic-backend/app/permissions.py

export const PERMISSIONS = [
  'patient.view',
  'patient.edit',
  'patient.delete',
  'appointment.view',
  'appointment.manage',
  'clinical.notes.write',
  'clinical.chart',
  'clinical.xray',
  'prescription.create',
  'billing.view',
  'billing.edit',
  'report.own',
  'report.clinic',
  'admin.staff',
]

export const DEFAULT_PERMISSIONS = {
  doctor: [
    'patient.view', 'patient.edit',
    'appointment.view',
    'clinical.notes.write', 'clinical.chart',
    'prescription.create',
  ],
  receptionist: [
    'patient.view', 'patient.edit',
    'appointment.view', 'appointment.manage',
    'billing.view',
  ],
  nurse: [
    'patient.view',
    'appointment.view',
    'clinical.notes.write',
  ],
  compounder: [
    'billing.view',
  ],
}

// Permissions that cannot be toggled OFF for certain roles
export const LOCKED_ON = {
  doctor: new Set(['patient.view']),
  nurse:  new Set(['patient.view']),
}

export const PERMISSION_GROUPS = [
  {
    label: 'Patient Management',
    permissions: [
      { key: 'patient.view',   name: 'View Patients',   desc: 'Browse and search patient records' },
      { key: 'patient.edit',   name: 'Edit Patients',   desc: 'Create and modify patient records' },
      { key: 'patient.delete', name: 'Delete Patients', desc: 'Permanently remove patient records' },
    ],
  },
  {
    label: 'Appointments',
    permissions: [
      { key: 'appointment.view',   name: 'View Appointments',   desc: 'See appointment schedule' },
      { key: 'appointment.manage', name: 'Manage Appointments', desc: 'Create, reschedule, and cancel appointments' },
    ],
  },
  {
    label: 'Clinical Records',
    permissions: [
      { key: 'clinical.notes.write', name: 'Write Clinical Notes', desc: 'Add and edit SOAP examination notes' },
      { key: 'clinical.chart',       name: 'Dental Chart',         desc: 'View and update the FDI dental chart' },
      { key: 'clinical.xray',        name: 'X-Ray Access',         desc: 'Upload and view radiograph images' },
      { key: 'prescription.create',  name: 'Create Prescriptions', desc: 'Issue and sign prescriptions' },
    ],
  },
  {
    label: 'Billing & Payments',
    permissions: [
      { key: 'billing.view', name: 'View Billing', desc: 'See invoices and payment history' },
      { key: 'billing.edit', name: 'Edit Billing', desc: 'Create, edit, and send invoices' },
    ],
  },
  {
    label: 'Reporting & Admin',
    permissions: [
      { key: 'report.own',    name: 'Own Reports',     desc: 'Access personal activity reports' },
      { key: 'report.clinic', name: 'Clinic Reports',  desc: 'Access clinic-wide analytics' },
      { key: 'admin.staff',   name: 'Manage Staff',    desc: 'Add and manage staff accounts (admin only)' },
    ],
  },
]

export const ROLE_META = {
  doctor:       { label: 'Doctor',       initials: 'DR', color: 'bg-black text-white' },
  receptionist: { label: 'Receptionist', initials: 'RC', color: 'bg-gray-700 text-white' },
  nurse:        { label: 'Nurse',        initials: 'NU', color: 'bg-gray-500 text-white' },
  compounder:   { label: 'Compounder',   initials: 'CP', color: 'bg-gray-200 text-black' },
}

export function buildDefaultPerms(roleKey) {
  const defaults = new Set(DEFAULT_PERMISSIONS[roleKey] ?? [])
  return Object.fromEntries(PERMISSIONS.map((p) => [p, defaults.has(p)]))
}

export function isCustomized(roleKey, perms) {
  const defaults = new Set(DEFAULT_PERMISSIONS[roleKey] ?? [])
  return PERMISSIONS.some((p) => perms[p] !== defaults.has(p))
}
