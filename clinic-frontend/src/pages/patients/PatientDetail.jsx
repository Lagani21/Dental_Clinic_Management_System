import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Phone, Mail, MapPin, Droplets, ShieldCheck, TriangleAlert, Pencil, X, Check, Clock, FileText, Trash2, Upload } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { patientsApi, medicalHistoryApi, documentsApi, clinicalApi } from '../../services/api'
import DentalChart from '../../components/clinical/DentalChart'
import ClinicalNotes from '../../components/clinical/ClinicalNotes'
import PerioChart from '../../components/clinical/PerioChart'

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value}</p>
    </div>
  )
}

function fmtDate(str) {
  if (!str) return '—'
  try { return format(parseISO(str), 'dd MMM yyyy') } catch { return str }
}

// ── Allergy Alert Banner ───────────────────────────────────────────────────────

function AllergyAlert({ allergies }) {
  if (!allergies) return null
  return (
    <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-4 py-3">
      <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-red-700">Allergy Alert</p>
        <p className="mt-0.5 text-sm text-red-800">{allergies}</p>
      </div>
    </div>
  )
}

// ── Shared field components ────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none ${className}`}
      {...props}
    />
  )
}

function Select({ children, ...props }) {
  return (
    <select
      className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
      {...props}
    >
      {children}
    </select>
  )
}

// ── Personal info editor ───────────────────────────────────────────────────────

function InfoEditor({ patient }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      first_name: patient.first_name ?? '',
      last_name: patient.last_name ?? '',
      gender: patient.gender ?? '',
      date_of_birth: patient.date_of_birth ?? '',
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      address: patient.address ?? '',
      city: patient.city ?? '',
      pincode: patient.pincode ?? '',
      blood_group: patient.blood_group ?? 'unknown',
      abha_id: patient.abha_id ?? '',
      insurance_id: patient.insurance_id ?? '',
      emergency_contact_name: patient.emergency_contact_name ?? '',
      emergency_contact_phone: patient.emergency_contact_phone ?? '',
      emergency_contact_relation: patient.emergency_contact_relation ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data) => patientsApi.update(patient.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      setEditing(false)
    },
  })

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-700">Personal Info</h2>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
          <InfoRow label="Gender"        value={patient.gender} />
          <InfoRow label="Date of Birth" value={fmtDate(patient.date_of_birth)} />
          <InfoRow label="Phone"         value={patient.phone} />
          <InfoRow label="Email"         value={patient.email} />
          <InfoRow label="Address"       value={[patient.address, patient.city, patient.pincode].filter(Boolean).join(', ')} />
          <InfoRow label="Blood Group"   value={patient.blood_group} />
          <InfoRow label="ABHA ID"       value={patient.abha_id} />
          <InfoRow label="Insurance ID"  value={patient.insurance_id} />
        </div>

        {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-medium text-slate-700">Emergency Contact</h2>
            <InfoRow label="Name"     value={patient.emergency_contact_name} />
            <InfoRow label="Phone"    value={patient.emergency_contact_phone} />
            <InfoRow label="Relation" value={patient.emergency_contact_relation} />
          </div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit((d) => {
      const cleaned = Object.fromEntries(
        Object.entries(d).map(([k, v]) => [k, v === '' ? null : v])
      )
      mutation.mutate(cleaned)
    })} className="space-y-4">

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700">Personal Info</h2>
          <button
            type="button"
            onClick={() => { setEditing(false); reset() }}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name">
            <Input placeholder="First name" {...register('first_name')} />
          </Field>
          <Field label="Last Name">
            <Input placeholder="Last name" {...register('last_name')} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Gender">
            <Select {...register('gender')}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Date of Birth">
            <Input type="date" {...register('date_of_birth')} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <Input placeholder="9876543210" {...register('phone')} />
          </Field>
          <Field label="Email">
            <Input type="email" placeholder="patient@email.com" {...register('email')} />
          </Field>
        </div>

        <Field label="Address">
          <Input placeholder="Street address" {...register('address')} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="City">
            <Input placeholder="Mumbai" {...register('city')} />
          </Field>
          <Field label="Pincode">
            <Input placeholder="400001" {...register('pincode')} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Blood Group">
            <Select {...register('blood_group')}>
              <option value="unknown">Unknown</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
          </Field>
          <Field label="ABHA ID">
            <Input placeholder="14-digit ABHA number" {...register('abha_id')} />
          </Field>
        </div>

        <Field label="Insurance ID">
          <Input placeholder="Policy / TPA ID" {...register('insurance_id')} />
        </Field>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-medium text-slate-700">Emergency Contact</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <Input placeholder="Contact name" {...register('emergency_contact_name')} />
          </Field>
          <Field label="Phone">
            <Input placeholder="9876543210" {...register('emergency_contact_phone')} />
          </Field>
        </div>
        <Field label="Relation">
          <Input placeholder="e.g. Spouse, Parent" {...register('emergency_contact_relation')} />
        </Field>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-500">Failed to save. Please try again.</p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => { setEditing(false); reset() }}
          className="rounded border border-slate-200 px-4 py-1.5 text-xs text-slate-500 hover:border-slate-400 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 rounded bg-slate-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

// ── Inline medical history editor ─────────────────────────────────────────────

function MedicalHistoryEditor({ patient, onSaved }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      allergies: patient.allergies ?? '',
      medications: patient.medications ?? '',
      medical_history: patient.medical_history ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data) => patientsApi.update(patient.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] })
      queryClient.invalidateQueries({ queryKey: ['patient-medical-history', patient.id] })
      setEditing(false)
      onSaved?.()
    },
  })

  if (!editing) {
    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700">Medical Information</h2>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
        <InfoRow label="Allergies" value={patient.allergies} />
        <InfoRow label="Current Medications" value={patient.medications} />
        <InfoRow label="Prior Conditions" value={patient.medical_history} />
        {!patient.allergies && !patient.medications && !patient.medical_history && (
          <p className="text-xs text-slate-400">No medical information recorded.</p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Medical Information</h2>
        <button
          type="button"
          onClick={() => { setEditing(false); reset() }}
          className="text-slate-400 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wide">Allergies</label>
        <input
          className="mt-1 w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
          placeholder="e.g. Penicillin, Latex"
          {...register('allergies')}
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wide">Current Medications</label>
        <input
          className="mt-1 w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
          placeholder="e.g. Metformin 500mg, Aspirin"
          {...register('medications')}
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wide">Prior Conditions</label>
        <textarea
          className="mt-1 w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none resize-none"
          rows={3}
          placeholder="Diabetes, hypertension, previous surgeries..."
          {...register('medical_history')}
        />
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-500">Failed to save. Please try again.</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 rounded bg-slate-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

// ── Medical History Versions ───────────────────────────────────────────────────

function MedicalHistoryVersions({ patientId }) {
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['patient-medical-history', patientId],
    queryFn: () => medicalHistoryApi.list(patientId),
    select: (res) => res.data,
  })

  if (isLoading) return <p className="text-xs text-slate-400">Loading history…</p>
  if (!versions.length) return <p className="text-xs text-slate-400">No history recorded yet.</p>

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <div key={v.id} className="rounded border border-slate-100 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span>{fmtDate(v.created_at)}</span>
            {v.changed_by_name && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-700">{v.changed_by_name}</span>
              </>
            )}
          </div>
          {v.allergies    && <p className="text-xs"><span className="font-medium text-slate-600">Allergies: </span>{v.allergies}</p>}
          {v.medications  && <p className="text-xs"><span className="font-medium text-slate-600">Medications: </span>{v.medications}</p>}
          {v.prior_conditions && <p className="text-xs"><span className="font-medium text-slate-600">Prior conditions: </span>{v.prior_conditions}</p>}
        </div>
      ))}
    </div>
  )
}

// ── Documents tab ─────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS = {
  xray: 'X-Ray', photo: 'Photo', consent_form: 'Consent Form',
  lab_report: 'Lab Report', prescription: 'Prescription',
  invoice: 'Invoice', other: 'Other',
}

function fileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentsTab({ patientId }) {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: () => documentsApi.list(patientId),
    select: (res) => res.data,
  })

  const uploadMutation = useMutation({
    mutationFn: (formData) => documentsApi.upload(patientId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] })
      reset()
      setUploading(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (docId) => documentsApi.delete(patientId, docId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] }),
  })

  const onSubmit = (data) => {
    const fd = new FormData()
    fd.append('file', data.file[0])
    fd.append('title', data.title)
    fd.append('document_type', data.document_type)
    if (data.description) fd.append('description', data.description)
    uploadMutation.mutate(fd)
  }

  return (
    <div className="space-y-5">
      {/* Upload form */}
      {uploading ? (
        <form onSubmit={handleSubmit(onSubmit)} className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-700">Upload Document</h2>
            <button type="button" onClick={() => { setUploading(false); reset() }} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wide">Title *</label>
              <input
                className="mt-1 w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="e.g. OPG Scan Apr 2026"
                {...register('title', { required: true })}
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">Required</p>}
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wide">Type</label>
              <select className="mt-1 w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none" {...register('document_type')}>
                {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide">File *</label>
            <input
              type="file"
              className="mt-1 w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-slate-200"
              {...register('file', { required: true })}
            />
            {errors.file && <p className="mt-1 text-xs text-red-500">Required</p>}
          </div>

          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide">Description</label>
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="Optional notes"
              {...register('description')}
            />
          </div>

          {uploadMutation.isError && (
            <p className="text-xs text-red-500">Upload failed. Please try again.</p>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setUploading(false); reset() }} className="rounded border border-slate-200 px-4 py-1.5 text-xs text-slate-500 hover:border-slate-400 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={uploadMutation.isPending} className="flex items-center gap-1.5 rounded bg-slate-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50">
              <Upload className="h-3.5 w-3.5" />
              {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <button
            onClick={() => setUploading(true)}
            className="flex items-center gap-1.5 rounded bg-slate-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          >
            <Upload className="h-3.5 w-3.5" /> Upload Document
          </button>
        </div>
      )}

      {/* Document list */}
      <div className="card divide-y divide-slate-100">
        {isLoading ? (
          <p className="p-5 text-xs text-slate-400">Loading documents…</p>
        ) : docs.length === 0 ? (
          <p className="p-5 text-xs text-slate-400">No documents uploaded yet.</p>
        ) : docs.map((doc) => (
          <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
            <FileText className="h-5 w-5 flex-shrink-0 text-slate-300" />
            <div className="flex-1 min-w-0">
              <a
                href={doc.s3_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-slate-800 hover:underline truncate block"
              >
                {doc.title}
              </a>
              <p className="text-xs text-slate-400">
                {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                {doc.file_size_bytes ? ` · ${fileSize(doc.file_size_bytes)}` : ''}
                {` · ${fmtDate(doc.created_at)}`}
              </p>
              {doc.description && <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>}
            </div>
            <button
              onClick={() => { if (window.confirm('Delete this document?')) deleteMutation.mutate(doc.id) }}
              className="flex-shrink-0 text-slate-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Clinical tab (CR-001 / CR-002 / CR-003) ───────────────────────────────────

const CLINICAL_SECTIONS = [
  { key: 'chart', label: 'Dental Chart' },
  { key: 'notes', label: 'Clinical Notes' },
  { key: 'perio', label: 'Perio Charting' },
]

function ClinicalTab({ patientId }) {
  const [section, setSection] = useState('chart')

  const { data: chart, isLoading: chartLoading } = useQuery({
    queryKey: ['dental-chart', patientId],
    queryFn: () => clinicalApi.getChart(patientId),
    select: (r) => r.data,
    enabled: section === 'chart',
  })

  return (
    <div className="space-y-4">
      {/* Sub-nav */}
      <div className="flex gap-1 border-b border-slate-100">
        {CLINICAL_SECTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              section === key
                ? 'border-b-2 border-black text-black'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'chart' && (
        chartLoading
          ? <p className="text-xs text-slate-400">Loading chart…</p>
          : <DentalChart
              patientId={patientId}
              chartData={chart?.chart_data ?? {}}
              toothStatus={chart?.tooth_status ?? {}}
            />
      )}

      {section === 'notes' && <ClinicalNotes patientId={patientId} />}

      {section === 'perio' && <PerioChart patientId={patientId} />}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PatientDetail() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('info')

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.get(id),
    select: (res) => res.data,
  })

  if (isLoading) {
    return <div className="py-20 text-center text-slate-400">Loading patient…</div>
  }

  if (!patient) {
    return <div className="py-20 text-center text-slate-400">Patient not found</div>
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="space-y-5 max-w-3xl px-6 py-6">
      {/* Back */}
      <Link to="/patients" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to Patients
      </Link>

      {/* Header card */}
      <div className="card p-5 flex items-start gap-4">
        {patient.photo_url ? (
          <img
            src={patient.photo_url}
            alt={patient.full_name}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600">
            {patient.first_name[0]}{patient.last_name[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-slate-800">{patient.full_name}</h1>
            {patient.patient_id && (
              <span className="font-mono text-xs text-slate-400">{patient.patient_id}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
            {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{patient.phone}</span>}
            {patient.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{patient.email}</span>}
            {patient.city  && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{patient.city}</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="badge-blue flex items-center gap-1">
              <Droplets className="h-3 w-3" />{patient.blood_group}
            </span>
            {patient.abha_id && (
              <span className="badge-green flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />ABHA: {patient.abha_id}
              </span>
            )}
            {patient.insurance_id && (
              <span className="badge-blue flex items-center gap-1">
                Insurance: {patient.insurance_id}
              </span>
            )}
            {patient.last_visit && (
              <span className="text-xs text-slate-400">Last visit: {fmtDate(patient.last_visit)}</span>
            )}
          </div>
        </div>
      </div>

      {/* PM-002: Allergy alert — shown prominently below the header */}
      <AllergyAlert allergies={patient.allergies} />

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200">
        {[['info', 'Info'], ['clinical', 'Clinical'], ['medical', 'Medical History'], ['documents', 'Documents']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-b-2 border-slate-800 text-slate-800'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && <InfoEditor patient={patient} />}

      {activeTab === 'clinical' && <ClinicalTab patientId={id} />}

      {activeTab === 'documents' && <DocumentsTab patientId={id} />}

      {activeTab === 'medical' && (
        <div className="space-y-5">
          {/* Editable medical fields */}
          <MedicalHistoryEditor patient={patient} />

          {/* PM-002: Versioned history log */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-medium text-slate-700">Change History</h2>
            <MedicalHistoryVersions patientId={id} />
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
