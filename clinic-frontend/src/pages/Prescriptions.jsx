/**
 * Prescriptions module.
 * Two entry points:
 *   1. /prescriptions              → list + new (pick patient)
 *   2. /prescriptions/new?patient= → new with patient pre-filled (from PatientDetail)
 */
import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, X, Printer, FileText } from 'lucide-react'
import { prescriptionsApi, patientsApi, appointmentsApi } from '../services/api'

// ── Common helpers ─────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  'Once daily', 'Twice daily', 'Three times daily', 'Four times daily',
  'Every 4 hours', 'Every 6 hours', 'Every 8 hours',
  'At bedtime', 'As needed (SOS)', 'With meals',
]

const DURATION_OPTIONS = [
  '1 day', '3 days', '5 days', '7 days', '10 days', '14 days', '1 month', 'Until finished',
]

function fmtDate(d) {
  if (!d) return '—'
  try { return format(parseISO(String(d)), 'dd MMM yyyy') } catch { return String(d) }
}

// ── RxDetail — read-only right panel ──────────────────────────────────────────

function RxDetail({ rxId, onDeleted }) {
  const queryClient = useQueryClient()

  const { data: rx, isLoading } = useQuery({
    queryKey: ['rx', rxId],
    queryFn:  () => prescriptionsApi.get(rxId).then((r) => r.data),
    enabled:  !!rxId,
  })

  const deleteMutation = useMutation({
    mutationFn: () => prescriptionsApi.delete(rxId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] })
      onDeleted()
    },
  })

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=600,height=800')
    if (!win || !rx) return
    win.document.write(buildPrintHtml(rx))
    win.document.close()
    win.focus()
    win.print()
  }

  if (!rxId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[9px] uppercase tracking-[0.2em] text-gray-300">Select a prescription</p>
      </div>
    )
  }

  if (isLoading || !rx) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-black">{rx.patient_name ?? '—'}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(rx.prescription_date)} · Dr. {rx.doctor_name ?? '—'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500 border border-gray-200 px-3 py-1.5 hover:border-black hover:text-black transition-colors"
          >
            <Printer className="h-3 w-3" /> Print
          </button>
          <button
            onClick={() => { if (window.confirm('Delete this prescription?')) deleteMutation.mutate() }}
            disabled={deleteMutation.isPending}
            className="text-[10px] uppercase tracking-wider text-red-400 border border-red-200 px-3 py-1.5 hover:border-red-500 hover:text-red-600 transition-colors disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Allergy alert */}
        {rx.patient_allergies && (
          <div className="border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-[9px] uppercase tracking-wider text-red-500 font-bold mb-0.5">Allergy Alert</p>
            <p className="text-xs text-red-700">{rx.patient_allergies}</p>
          </div>
        )}

        {/* Diagnosis */}
        {rx.diagnosis && (
          <div>
            <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Diagnosis</p>
            <p className="text-sm text-black">{rx.diagnosis}</p>
          </div>
        )}

        {/* Medicines */}
        <div>
          <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-3">
            Medicines <span className="ml-1 font-mono">({rx.items?.length ?? 0})</span>
          </p>
          <div className="space-y-3">
            {(rx.items ?? []).map((item, i) => (
              <div key={item.id} className="border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-black">{item.medicine_name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {item.dosage} · {item.frequency} · {item.duration}
                    </p>
                    {item.instructions && (
                      <p className="text-[10px] text-gray-400 mt-1 italic">{item.instructions}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono flex-shrink-0 ml-4">
                    Qty: {item.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {rx.notes && (
          <div>
            <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-600 italic">{rx.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Print template ─────────────────────────────────────────────────────────────

function buildPrintHtml(rx) {
  const meds = (rx.items ?? []).map((item, i) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;vertical-align:top">
        <b>${i + 1}. ${item.medicine_name}</b><br/>
        <span style="font-size:12px;color:#555">${item.dosage} — ${item.frequency} — ${item.duration}</span>
        ${item.instructions ? `<br/><span style="font-size:11px;color:#888;font-style:italic">${item.instructions}</span>` : ''}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;vertical-align:top;white-space:nowrap;font-size:12px;color:#555">
        Qty: ${item.quantity}
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html><html><head>
    <title>Prescription — ${rx.patient_name}</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 600px; margin: 30px auto; color: #111; font-size: 14px; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
      .header h1 { margin: 0; font-size: 20px; letter-spacing: 4px; text-transform: uppercase; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 12px; }
      .meta-label { color: #888; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; }
      .allergy { background: #fff0f0; border: 1px solid #fca5a5; padding: 8px 12px; margin-bottom: 16px; font-size: 12px; color: #b91c1c; }
      .diagnosis { margin-bottom: 16px; }
      .diagnosis-label { color: #888; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px; }
      .notes { margin-top: 16px; font-size: 12px; color: #666; font-style: italic; }
      .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #888; }
      @media print { body { margin: 10mm; } }
    </style>
  </head><body>
    <div class="header">
      <h1>Dental Archive</h1>
      <p style="margin:4px 0;font-size:12px;color:#666">Prescription</p>
    </div>
    <div class="meta">
      <div><div class="meta-label">Patient</div><b>${rx.patient_name ?? '—'}</b>${rx.patient_phone ? '<br/>' + rx.patient_phone : ''}</div>
      <div><div class="meta-label">Date</div>${fmtDate(rx.prescription_date)}</div>
      <div><div class="meta-label">Doctor</div>${rx.doctor_name ?? '—'}</div>
      <div><div class="meta-label">Rx ID</div><span style="font-family:monospace">${String(rx.id).slice(0, 8).toUpperCase()}</span></div>
    </div>
    ${rx.patient_allergies ? `<div class="allergy"><b>⚠ Allergy:</b> ${rx.patient_allergies}</div>` : ''}
    ${rx.diagnosis ? `<div class="diagnosis"><div class="diagnosis-label">Diagnosis</div>${rx.diagnosis}</div>` : ''}
    <table>${meds}</table>
    ${rx.notes ? `<div class="notes">Notes: ${rx.notes}</div>` : ''}
    <div class="footer">
      <span>Dental Archive · dentflow.in</span>
      <span>Doctor's Signature: ___________________</span>
    </div>
  </body></html>`
}

// ── NewRxModal ─────────────────────────────────────────────────────────────────

function NewRxModal({ prefillPatientId, onClose, onCreated }) {
  const queryClient = useQueryClient()

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      patient_id:        prefillPatientId ?? '',
      doctor_id:         '',
      prescription_date: format(new Date(), 'yyyy-MM-dd'),
      diagnosis:         '',
      notes:             '',
      items: [{ medicine_name: '', dosage: '', frequency: 'Twice daily', duration: '5 days', instructions: '', quantity: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-list'],
    queryFn:  () => patientsApi.list({ page_size: 200 }).then((r) => r.data?.items ?? []),
    enabled:  !prefillPatientId,
  })

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors-list'],
    queryFn:  () => appointmentsApi.doctors().then((r) => r.data ?? []),
  })

  // When prefillPatientId provided, load patient info for allergy display
  const { data: prefillPatient } = useQuery({
    queryKey: ['patient', prefillPatientId],
    queryFn:  () => patientsApi.get(prefillPatientId).then((r) => r.data),
    enabled:  !!prefillPatientId,
  })

  const mutation = useMutation({
    mutationFn: (data) => prescriptionsApi.create({
      ...data,
      items: data.items.map((i) => ({ ...i, quantity: parseInt(i.quantity) || 1 })),
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] })
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions', prefillPatientId] })
      onCreated(res.data.id)
    },
  })

  const allergyMsg = prefillPatient?.allergies

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] flex flex-col shadow-xl">

        {/* Modal header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-black">
            {prefillPatientId ? 'Write Prescription' : 'New Prescription'}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-black transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Allergy alert if patient pre-filled */}
            {allergyMsg && (
              <div className="border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-[9px] uppercase tracking-wider text-red-500 font-bold mb-0.5">Allergy Alert</p>
                <p className="text-xs text-red-700">{allergyMsg}</p>
              </div>
            )}

            {/* Patient / Doctor / Date */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Patient *</label>
                {prefillPatientId ? (
                  <div className="border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-gray-600">
                    {prefillPatient
                      ? `${prefillPatient.first_name} ${prefillPatient.last_name}`
                      : 'Loading…'}
                    <input type="hidden" {...register('patient_id')} />
                  </div>
                ) : (
                  <select required
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
                    {...register('patient_id', { required: true })}>
                    <option value="">Select patient…</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Doctor *</label>
                <select required
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
                  {...register('doctor_id', { required: true })}>
                  <option value="">Select doctor…</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name ?? d.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Date *</label>
                <input type="date" required
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  {...register('prescription_date', { required: true })} />
              </div>
            </div>

            {/* Diagnosis */}
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Diagnosis</label>
              <input
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                placeholder="e.g. Post-extraction, Pulpitis…"
                {...register('diagnosis')} />
            </div>

            {/* Medicines */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400">Medicines</p>
                <button type="button"
                  onClick={() => append({ medicine_name: '', dosage: '', frequency: 'Twice daily', duration: '5 days', instructions: '', quantity: 1 })}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 border border-gray-200 px-2 py-1 hover:border-black transition-colors">
                  <Plus className="h-3 w-3" /> Add Medicine
                </button>
              </div>

              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={field.id} className="border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                        Medicine {idx + 1}
                      </span>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(idx)}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] uppercase tracking-[0.12em] text-gray-400 block mb-1">Medicine Name *</label>
                        <input
                          className="w-full border border-gray-200 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                          placeholder="e.g. Amoxicillin"
                          {...register(`items.${idx}.medicine_name`, { required: true })} />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-[0.12em] text-gray-400 block mb-1">Dosage *</label>
                        <input
                          className="w-full border border-gray-200 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                          placeholder="e.g. 500mg"
                          {...register(`items.${idx}.dosage`, { required: true })} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] uppercase tracking-[0.12em] text-gray-400 block mb-1">Frequency *</label>
                        <select
                          className="w-full border border-gray-200 px-2 py-1.5 text-sm focus:border-black focus:outline-none bg-white"
                          {...register(`items.${idx}.frequency`, { required: true })}>
                          {FREQUENCY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-[0.12em] text-gray-400 block mb-1">Duration *</label>
                        <select
                          className="w-full border border-gray-200 px-2 py-1.5 text-sm focus:border-black focus:outline-none bg-white"
                          {...register(`items.${idx}.duration`, { required: true })}>
                          {DURATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-[0.12em] text-gray-400 block mb-1">Qty</label>
                        <input type="number" min="1"
                          className="w-full border border-gray-200 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                          {...register(`items.${idx}.quantity`, { min: 1 })} />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] uppercase tracking-[0.12em] text-gray-400 block mb-1">Instructions</label>
                      <input
                        className="w-full border border-gray-200 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        placeholder="e.g. After food, avoid dairy…"
                        {...register(`items.${idx}.instructions`)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Notes</label>
              <textarea rows={2}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
                placeholder="Additional instructions or follow-up notes…"
                {...register('notes')} />
            </div>
          </div>

          {mutation.isError && (
            <div className="px-6 py-2 bg-red-50 border-t border-red-100">
              <p className="text-[10px] text-red-600">{mutation.error?.response?.data?.detail ?? 'Failed to create prescription'}</p>
            </div>
          )}

          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-5 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
              {mutation.isPending ? 'Saving…' : 'Save Prescription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── PrescriptionList ───────────────────────────────────────────────────────────

function PrescriptionList({ selectedId, onSelect, onNew }) {
  const [q, setQ] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['prescriptions'],
    queryFn:  () => prescriptionsApi.list({ page_size: 100 }).then((r) => r.data?.items ?? []),
  })

  const filtered = (data ?? []).filter((rx) => {
    if (!q) return true
    const lq = q.toLowerCase()
    return (
      (rx.patient_name ?? '').toLowerCase().includes(lq) ||
      (rx.diagnosis    ?? '').toLowerCase().includes(lq) ||
      (rx.doctor_name  ?? '').toLowerCase().includes(lq)
    )
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black">Prescriptions</p>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold border border-black text-black px-3 py-2 hover:bg-black hover:text-white transition-colors"
        >
          <Plus className="h-3 w-3" /> New
        </button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-gray-100">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search patient, diagnosis…"
          className="w-full border border-gray-200 px-3 py-1.5 text-xs focus:border-black focus:outline-none"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-[10px] uppercase tracking-widest text-gray-300">No prescriptions</p>
          </div>
        ) : (
          filtered.map((rx) => (
            <div
              key={rx.id}
              onClick={() => onSelect(rx.id)}
              className={`px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedId === rx.id ? 'bg-gray-50 border-l-2 border-l-black' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-black">{rx.patient_name ?? '—'}</p>
                <p className="text-[10px] text-gray-400">{fmtDate(rx.prescription_date)}</p>
              </div>
              {rx.diagnosis && (
                <p className="text-[10px] text-gray-500 mt-0.5 truncate">{rx.diagnosis}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-0.5">
                {rx.items?.length ?? 0} medicine{(rx.items?.length ?? 0) !== 1 ? 's' : ''} · Dr. {rx.doctor_name ?? '—'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Prescriptions (main page) ─────────────────────────────────────────────────

export default function Prescriptions() {
  const [selectedId, setSelectedId] = useState(null)
  const [showModal, setShowModal]   = useState(false)
  const [searchParams]              = useSearchParams()

  // Entry point 2: /prescriptions?new=1&patient=<uuid>
  const patientParam = searchParams.get('patient')
  const newParam     = searchParams.get('new')

  useEffect(() => {
    if (newParam === '1') setShowModal(true)
  }, [newParam])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: list */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden border-r border-gray-200" style={{ width: '38%' }}>
        <PrescriptionList
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNew={() => setShowModal(true)}
        />
      </div>

      {/* Right: detail */}
      <div className="flex flex-col overflow-hidden" style={{ width: '62%' }}>
        <RxDetail
          rxId={selectedId}
          onDeleted={() => setSelectedId(null)}
        />
      </div>

      {showModal && (
        <NewRxModal
          prefillPatientId={patientParam || null}
          onClose={() => setShowModal(false)}
          onCreated={(id) => { setShowModal(false); setSelectedId(id) }}
        />
      )}
    </div>
  )
}
