import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { AlignJustify, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { patientsApi } from '../../services/api'

// ── Constants ──────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',            label: 'All Patients' },
  { key: 'in_treatment',   label: 'In Treatment' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'emergency',      label: 'Emergency' },
  { key: 'completed',      label: 'Completed' },
]

const STATUS_MAP = {
  routine:        'ROUTINE',
  surgical:       'SURGICAL',
  follow_up:      'FOLLOW-UP',
  emergency:      'EMERGENCY',
  consult:        'CONSULT',
  completed:      'COMPLETED',
  in_treatment:   'IN TREATMENT',
  pending_review: 'PENDING REVIEW',
  active:         'ACTIVE',
  inactive:       'INACTIVE',
  new:            'NEW',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDotDate(str) {
  if (!str) return '—'
  try { return format(parseISO(str), 'yyyy.MM.dd') } catch { return str }
}

function fmtShortDate(str) {
  if (!str) return '—'
  try { return format(parseISO(str), 'MMM d') } catch { return str }
}

// ── StatusBadge ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (!status) return <span className="text-[10px] text-gray-300">—</span>
  const label = STATUS_MAP[status] ?? status.toUpperCase().replace(/_/g, ' ')
  return (
    <span className="inline-block border border-black text-black text-[10px] font-medium tracking-wider px-2 py-0.5 leading-none">
      {label}
    </span>
  )
}

// ── Skeleton row ───────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-5 py-4"><div className="h-3 bg-gray-100 w-36 animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-3 bg-gray-100 w-16 animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-3 bg-gray-100 w-20 animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-3 bg-gray-100 w-20 animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-3 bg-gray-100 w-28 animate-pulse" /></td>
    </tr>
  )
}

// ── Right detail panel — always rendered ───────────────────────────────────

function DetailPanel({ patientId }) {
  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn:  () => patientsApi.get(patientId),
    select:   (res) => res.data,
    enabled:  !!patientId,
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header — always shown */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
        <p className="text-sm font-bold text-black">Patient Profile Detail</p>
      </div>

      {/* Scan area — always shown */}
      <div
        className="flex-shrink-0 border-b border-gray-200 bg-gray-100 flex items-center justify-center"
        style={{ height: 210 }}
      >
        {!patientId ? (
          <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400">
            Select a patient
          </p>
        ) : isLoading ? (
          <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-black animate-spin" />
        ) : patient?.latest_radiograph ? (
          <img
            src={patient.latest_radiograph}
            alt="Radiograph"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400">
            SCAN_PREVIEW_{String(patientId ?? '').padStart(3, '0')}
          </p>
        )}
      </div>

      {/* Fields — scrollable */}
      {patientId && !isLoading && patient && (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          <PanelField label="Full Name"      value={patient.full_name} bold />
          <PanelField label="Treatment Plan" value={patient.treatment_plan ?? '—'} bold />
          <PanelField
            label="Latest Radiograph"
            value={
              patient.latest_radiograph_label ??
              (patient.last_visit
                ? `Panoramic Scan (${fmtShortDate(patient.last_visit)})`
                : '—')
            }
            bold
          />
          <PanelField label="Notes" value={patient.notes ?? '—'} />
          {patient.phone         && <PanelField label="Phone"         value={patient.phone} />}
          {patient.date_of_birth && <PanelField label="Date of Birth" value={fmtDotDate(patient.date_of_birth)} />}
          {patient.blood_group   && <PanelField label="Blood Group"   value={patient.blood_group} />}
          {patient.abha_id       && <PanelField label="ABHA ID"       value={patient.abha_id} mono />}
          {patient.status && (
            <div className="px-6 py-4">
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-2">Status</p>
              <StatusBadge status={patient.status} />
            </div>
          )}
        </div>
      )}

      {/* Loading skeleton for fields */}
      {patientId && isLoading && (
        <div className="flex-1 divide-y divide-gray-100">
          {[140, 100, 120, 80].map((w, i) => (
            <div key={i} className="px-6 py-4">
              <div className="h-2 bg-gray-100 animate-pulse mb-2" style={{ width: 56 }} />
              <div className="h-3.5 bg-gray-100 animate-pulse" style={{ width: w }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PanelField({ label, value, bold, mono }) {
  return (
    <div className="px-6 py-4">
      <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1.5">{label}</p>
      <p className={`text-sm text-black leading-snug ${bold ? 'font-bold' : 'font-normal'} ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  )
}

// ── NewPatientModal ────────────────────────────────────────────────────────

function NewPatientModal({ onClose }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [dupWarning, setDupWarning] = useState(null)

  const mutation = useMutation({
    mutationFn: (data) => patientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      onClose()
    },
    onError: (err) => {
      if (err?.response?.status === 409) {
        setDupWarning(err.response.data?.detail ?? 'Duplicate patient detected.')
      }
    },
  })

  const onSubmit = (data) => {
    setDupWarning(null)
    const cleaned = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])
    )
    mutation.mutate(cleaned)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">New Patient</p>
          <button onClick={onClose} className="text-gray-400 hover:text-black transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input className="input" placeholder="Priya" {...register('first_name', { required: 'Required' })} />
                {errors.first_name && <p className="mt-1 text-[10px] text-red-500">{errors.first_name.message}</p>}
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input className="input" placeholder="Sharma" {...register('last_name', { required: 'Required' })} />
                {errors.last_name && <p className="mt-1 text-[10px] text-red-500">{errors.last_name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Gender *</label>
                <select className="input" {...register('gender', { required: 'Required' })}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.gender && <p className="mt-1 text-[10px] text-red-500">{errors.gender.message}</p>}
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input type="date" className="input" {...register('date_of_birth')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone *</label>
                <input className="input" placeholder="9876543210" {...register('phone', { required: 'Required' })} />
                {errors.phone && <p className="mt-1 text-[10px] text-red-500">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="patient@email.com" {...register('email')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Blood Group</label>
                <select className="input" {...register('blood_group')}>
                  <option value="unknown">Unknown</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">ABHA ID</label>
                <input className="input" placeholder="14-digit ABHA number" {...register('abha_id')} />
              </div>
            </div>

            <div>
              <label className="label">Insurance ID</label>
              <input className="input" placeholder="Policy / TPA ID" {...register('insurance_id')} />
            </div>

            <div>
              <label className="label">Address</label>
              <input className="input" placeholder="Street address" {...register('address')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">City</label>
                <input className="input" placeholder="Mumbai" {...register('city')} />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input className="input" placeholder="400001" {...register('pincode')} />
              </div>
            </div>

            <div>
              <label className="label">Allergies</label>
              <input className="input" placeholder="e.g. Penicillin, Latex" {...register('allergies')} />
            </div>

            <div>
              <label className="label">Current Medications</label>
              <input className="input" placeholder="e.g. Metformin 500mg, Aspirin" {...register('medications')} />
            </div>

            <div>
              <label className="label">Prior Conditions / Medical History</label>
              <textarea className="input resize-none" rows={2} placeholder="Diabetes, hypertension, previous surgeries..." {...register('medical_history')} />
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Name</label>
                  <input className="input" placeholder="Contact name" {...register('emergency_contact_name')} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" placeholder="9876543210" {...register('emergency_contact_phone')} />
                </div>
              </div>
              <div>
                <label className="label">Relation</label>
                <input className="input" placeholder="e.g. Spouse, Parent" {...register('emergency_contact_relation')} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            {(dupWarning || mutation.isError) && (
              <p className="text-[10px] text-red-500">
                {dupWarning ?? mutation.error?.response?.data?.detail ?? 'Failed to create patient'}
              </p>
            )}
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={onClose} className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black hover:text-black transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={mutation.isPending} className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
                {mutation.isPending ? 'Saving...' : 'Create Patient'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Patients page ──────────────────────────────────────────────────────────

export default function Patients() {
  const navigate = useNavigate()
  const [filter,         setFilter]        = useState('all')
  const [search,         setSearch]        = useState('')
  const [page,           setPage]          = useState(1)
  const [selectedId,     setSelectedId]    = useState(null)
  const [showNewPatient, setShowNewPatient] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['patients', { filter, search, page }],
    queryFn:  () => patientsApi.list({
      search:    search || undefined,
      status:    filter !== 'all' ? filter : undefined,
      page,
      page_size: 30,
    }),
    select: (res) => res.data,
  })

  const patients   = data?.items ?? []
  const total      = data?.total ?? 0
  const totalPages = Math.ceil(total / 30)

  return (
    <>
      <div className="flex h-full overflow-hidden">

        {/* ── LEFT 65% ────────────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden border-r border-gray-200" style={{ width: '65%' }}>

          {/* Filter bar */}
          <div className="flex-shrink-0 flex items-center gap-6 px-6 py-3 border-b border-gray-200">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black whitespace-nowrap">
              Filter By
            </span>
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setFilter(key); setPage(1) }}
                className={
                  filter === key
                    ? 'text-[10px] font-bold uppercase tracking-wider text-black underline underline-offset-2 whitespace-nowrap'
                    : 'text-[10px] uppercase tracking-wider text-gray-400 hover:text-black transition-colors whitespace-nowrap'
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-shrink-0 flex items-center border-b border-gray-200 px-6 py-3">
            <input
              type="text"
              placeholder="Search by name, phone, or ID (PA-0001)..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="flex-1 bg-transparent border-none outline-none text-sm text-black placeholder-gray-300"
            />
            {search
              ? <button onClick={() => { setSearch(''); setPage(1) }} className="text-gray-400 hover:text-black transition-colors"><X className="h-3.5 w-3.5" /></button>
              : <AlignJustify className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            }
          </div>

          {/* Section heading */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-black">Active Patient Registry</p>
              <button
                onClick={() => setShowNewPatient(true)}
                className="text-[9px] uppercase tracking-wider text-gray-400 border border-gray-300 px-2 py-1 hover:border-black hover:text-black transition-colors"
              >
                + New
              </button>
            </div>
            <button className="text-[10px] uppercase tracking-wider text-gray-500 underline underline-offset-2 hover:text-black transition-colors">
              Download CSV
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Patient Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">ID Number</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">DOB</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Last Visit</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Dr. Assigned</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                  : patients.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-[10px] uppercase tracking-widest text-gray-300">
                        No patients found
                      </td>
                    </tr>
                  )
                  : patients.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedId((prev) => prev === p.id ? null : p.id)}
                      onDoubleClick={() => navigate(`/patients/${p.id}`)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        selectedId === p.id ? 'bg-gray-50' : 'hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-black leading-tight">{p.full_name}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 font-mono">
                        {p.patient_id ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {fmtDotDate(p.date_of_birth)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {fmtDotDate(p.last_visit)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {typeof p.assigned_doctor === 'object' && p.assigned_doctor !== null
                          ? p.assigned_doctor.full_name
                          : p.assigned_doctor ?? '—'}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex-shrink-0 flex items-center justify-between border-t border-gray-200 px-6 py-3">
              <span className="text-[10px] text-gray-400">Page {page} of {totalPages} · {total} records</span>
              <div className="flex items-center gap-5">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-black disabled:opacity-25 transition-colors">← Prev</button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-black disabled:opacity-25 transition-colors">Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT 35% — always visible ──────────────────────────── */}
        <div className="flex flex-col overflow-hidden" style={{ width: '35%' }}>
          <DetailPanel patientId={selectedId} />
        </div>
      </div>

      {showNewPatient && <NewPatientModal onClose={() => setShowNewPatient(false)} />}
    </>
  )
}
