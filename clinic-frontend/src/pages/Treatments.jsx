import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { X, Plus, Printer, ChevronDown, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { treatmentPlansApi, patientsApi } from '../services/api'

// ── Constants ──────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',       label: 'All Plans' },
  { key: 'draft',     label: 'Draft' },
  { key: 'active',    label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'on_hold',   label: 'On Hold' },
]

const PLAN_STATUS = {
  draft:     'DRAFT',
  active:    'ACTIVE',
  completed: 'COMPLETED',
  on_hold:   'ON HOLD',
  cancelled: 'CANCELLED',
}

const PROCEDURE_STATUS = {
  pending:    'PENDING',
  scheduled:  'SCHEDULED',
  completed:  'COMPLETED',
  skipped:    'SKIPPED',
}

// Common CDT codes used in Indian dental practice
const CDT_CODES = [
  { code: 'D0120', label: 'Periodic Oral Evaluation',        fee: 500 },
  { code: 'D0150', label: 'Comprehensive Oral Evaluation',   fee: 800 },
  { code: 'D0210', label: 'Full Mouth X-Ray Series',         fee: 1200 },
  { code: 'D0330', label: 'Panoramic Radiographic Image',    fee: 900 },
  { code: 'D1110', label: 'Prophylaxis – Adult',             fee: 1500 },
  { code: 'D2140', label: 'Amalgam – 1 Surface',             fee: 1200 },
  { code: 'D2150', label: 'Amalgam – 2 Surfaces',            fee: 1800 },
  { code: 'D2330', label: 'Composite – 1 Surface Anterior',  fee: 1500 },
  { code: 'D2393', label: 'Composite – 3 Surfaces Posterior',fee: 3500 },
  { code: 'D2740', label: 'Crown – Porcelain/Ceramic',       fee: 8000 },
  { code: 'D2750', label: 'Crown – PFM',                     fee: 6000 },
  { code: 'D3310', label: 'RCT – Anterior',                  fee: 4000 },
  { code: 'D3330', label: 'RCT – Molar',                     fee: 6000 },
  { code: 'D4341', label: 'Scaling & Root Planing',          fee: 3000 },
  { code: 'D5110', label: 'Complete Denture – Maxillary',    fee: 15000 },
  { code: 'D5120', label: 'Complete Denture – Mandibular',   fee: 15000 },
  { code: 'D6010', label: 'Implant – Surgical Placement',    fee: 35000 },
  { code: 'D6065', label: 'Implant Crown – PFM',             fee: 12000 },
  { code: 'D7110', label: 'Extraction – Erupted Tooth',      fee: 800 },
  { code: 'D7240', label: 'Extraction – Impacted Wisdom',    fee: 3500 },
  { code: 'D8080', label: 'Orthodontics – Adolescent',       fee: 40000 },
  { code: 'D9930', label: 'Treatment of Complications',      fee: 2000 },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(str) {
  if (!str) return '—'
  try { return format(parseISO(str), 'd MMM yyyy') } catch { return str }
}

function fmtINR(n) {
  if (n == null || n === '') return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}

function planTotal(plan) {
  if (!plan?.phases) return 0
  return plan.phases.reduce((sum, ph) =>
    sum + (ph.procedures ?? []).reduce((s, pr) => s + (Number(pr.fee) || 0), 0), 0)
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status, small }) {
  const label = PLAN_STATUS[status] ?? status?.toUpperCase().replace(/_/g, ' ') ?? '—'
  return (
    <span className={`inline-block border border-black text-black font-medium tracking-wider leading-none
      ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'}`}>
      {label}
    </span>
  )
}

// ── Skeleton row ───────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-5 py-4"><div className="h-3 bg-gray-100 w-40 animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-3 bg-gray-100 w-28 animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-3 bg-gray-100 w-16 animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-3 bg-gray-100 w-20 animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-4 bg-gray-100 w-16 animate-pulse" /></td>
    </tr>
  )
}

// ── Plan Detail Panel ──────────────────────────────────────────────────────

function PlanDetailPanel({ planId, onNewPlan }) {
  const [openPhases, setOpenPhases] = useState({})

  const { data: plan, isLoading } = useQuery({
    queryKey: ['treatment-plan', planId],
    queryFn:  () => treatmentPlansApi.get(planId),
    select:   (res) => res.data,
    enabled:  !!planId,
  })

  const togglePhase = (idx) =>
    setOpenPhases((prev) => ({ ...prev, [idx]: !prev[idx] }))

  const total     = planTotal(plan)
  const insEst    = plan?.insurance_coverage_estimate ?? null
  const patientOwe = insEst != null ? total - insEst : total

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <p className="text-sm font-bold text-black">Treatment Plan Detail</p>
        <button
          onClick={onNewPlan}
          className="flex items-center gap-1 text-[9px] uppercase tracking-wider border border-black text-black px-2.5 py-1 hover:bg-black hover:text-white transition-colors"
        >
          <Plus className="h-2.5 w-2.5" /> New Plan
        </button>
      </div>

      {!planId ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-gray-300">Select a plan</p>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
        </div>
      ) : plan ? (
        <div className="flex-1 overflow-y-auto">

          {/* Patient + meta */}
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Patient</p>
            <p className="text-sm font-bold text-black">{plan.patient_name ?? `Patient #${plan.patient_id}`}</p>
            {plan.patient_id && (
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                PA-{String(plan.patient_id).padStart(4, '0')}
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Plan Version</p>
              <p className="text-sm font-bold text-black">v{plan.version ?? 1}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Status</p>
              <StatusBadge status={plan.status} />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Created</p>
              <p className="text-sm text-black">{fmtDate(plan.created_at)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Doctor</p>
              <p className="text-sm text-black">{plan.doctor_name ?? '—'}</p>
            </div>
            {plan.start_date && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Start Date</p>
                <p className="text-sm text-black">{fmtDate(plan.start_date)}</p>
              </div>
            )}
            {plan.end_date && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Est. Completion</p>
                <p className="text-sm text-black">{fmtDate(plan.end_date)}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {plan.notes && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Clinical Notes</p>
              <p className="text-sm text-black leading-relaxed">{plan.notes}</p>
            </div>
          )}

          {/* Phases */}
          <div className="border-b border-gray-100">
            <div className="px-6 py-3">
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400">Treatment Phases</p>
            </div>
            {(plan.phases ?? []).map((phase, idx) => (
              <div key={idx} className="border-t border-gray-100">
                {/* Phase header — collapsible */}
                <button
                  onClick={() => togglePhase(idx)}
                  className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {openPhases[idx]
                      ? <ChevronDown className="h-3 w-3 text-gray-400" />
                      : <ChevronRight className="h-3 w-3 text-gray-400" />
                    }
                    <span className="text-[10px] font-bold uppercase tracking-wider text-black">
                      Phase {idx + 1}: {phase.name ?? `Phase ${idx + 1}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {(phase.procedures ?? []).length} procedure{(phase.procedures ?? []).length !== 1 ? 's' : ''}
                    {' · '}{fmtINR((phase.procedures ?? []).reduce((s, p) => s + (Number(p.fee) || 0), 0))}
                  </span>
                </button>

                {/* Procedures */}
                {openPhases[idx] && (
                  <div className="border-t border-gray-100">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="px-6 py-2 text-left text-[9px] uppercase tracking-wider text-gray-400">CDT Code</th>
                          <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-gray-400">Procedure</th>
                          <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-gray-400">Tooth</th>
                          <th className="px-3 py-2 text-right text-[9px] uppercase tracking-wider text-gray-400">Fee</th>
                          <th className="px-6 py-2 text-left text-[9px] uppercase tracking-wider text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(phase.procedures ?? []).map((pr, pi) => (
                          <tr key={pi} className="border-b border-gray-100">
                            <td className="px-6 py-2.5 font-mono text-[10px] text-gray-500">{pr.cdt_code ?? '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-black">{pr.name ?? pr.description ?? '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600">{pr.tooth ?? '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-black text-right font-medium">{fmtINR(pr.fee)}</td>
                            <td className="px-6 py-2.5">
                              <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 border leading-none ${
                                pr.status === 'completed'
                                  ? 'border-black bg-black text-white'
                                  : 'border-gray-300 text-gray-500'
                              }`}>
                                {PROCEDURE_STATUS[pr.status] ?? pr.status?.toUpperCase() ?? 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Cost summary */}
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-3">Fee Estimate</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Procedures</span>
                <span className="font-bold text-black">{fmtINR(total)}</span>
              </div>
              {insEst != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Insurance Coverage (est.)</span>
                  <span className="text-black">− {fmtINR(insEst)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-1">
                <span className="font-bold text-black">Patient Responsibility</span>
                <span className="font-bold text-black">{fmtINR(patientOwe)}</span>
              </div>
            </div>
          </div>

          {/* Consent */}
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-2">Informed Consent</p>
            {plan.consent_signed_at ? (
              <div className="flex items-center gap-2">
                <span className="inline-block border border-black bg-black text-white text-[9px] px-2 py-0.5 tracking-wider">SIGNED</span>
                <span className="text-[10px] text-gray-500">{fmtDate(plan.consent_signed_at)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="inline-block border border-gray-300 text-gray-400 text-[9px] px-2 py-0.5 tracking-wider">PENDING</span>
                <button className="text-[9px] uppercase tracking-wider text-gray-500 underline hover:text-black transition-colors">
                  Send to Patient
                </button>
              </div>
            )}
          </div>

          {/* Print */}
          <div className="px-6 py-4">
            <a
              href={treatmentPlansApi.pdfUrl(plan.id)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500 hover:text-black transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Export PDF
            </a>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── New Plan Modal ─────────────────────────────────────────────────────────

function NewPlanModal({ onClose }) {
  const queryClient = useQueryClient()
  const [phaseCount, setPhaseCount] = useState(1)

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      phases: [{ name: 'Phase 1', procedures: [{ cdt_code: '', name: '', tooth: '', fee: '', status: 'pending' }] }],
    },
  })

  const { fields: phaseFields, append: appendPhase, remove: removePhase } = useFieldArray({
    control,
    name: 'phases',
  })

  const mutation = useMutation({
    mutationFn: (data) => treatmentPlansApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] })
      onClose()
    },
  })

  const onSubmit = (data) => {
    // Clean empty fees to null
    const cleaned = {
      ...data,
      phases: data.phases.map((ph) => ({
        ...ph,
        procedures: ph.procedures.map((pr) => ({
          ...pr,
          fee: pr.fee === '' ? null : Number(pr.fee),
        })),
      })),
    }
    mutation.mutate(cleaned)
  }

  const grandTotal = watch('phases')?.reduce((sum, ph) =>
    sum + (ph.procedures ?? []).reduce((s, pr) => s + (Number(pr.fee) || 0), 0), 0) ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">New Treatment Plan</p>
          <button onClick={onClose} className="text-gray-400 hover:text-black transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Patient + doctor row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Patient ID *</label>
                <input className="input" placeholder="e.g. 42 or search name" {...register('patient_id', { required: 'Required' })} />
                {errors.patient_id && <p className="mt-1 text-[10px] text-red-500">{errors.patient_id.message}</p>}
              </div>
              <div>
                <label className="label">Assigned Doctor</label>
                <input className="input" placeholder="Doctor name or ID" {...register('doctor_id')} />
              </div>
            </div>

            {/* Title + status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Plan Title</label>
                <input className="input" placeholder="e.g. Orthodontic Realignment Phase 2" {...register('title')} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" {...register('status')}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input" {...register('start_date')} />
              </div>
              <div>
                <label className="label">Est. Completion</label>
                <input type="date" className="input" {...register('end_date')} />
              </div>
            </div>

            {/* Insurance */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Insurance Coverage Estimate (₹)</label>
                <input type="number" className="input" placeholder="0" {...register('insurance_coverage_estimate')} />
              </div>
              <div>
                <label className="label">Insurance Provider</label>
                <input className="input" placeholder="e.g. Star Health, HDFC ERGO" {...register('insurance_provider')} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Clinical Notes</label>
              <textarea className="input resize-none" rows={2} placeholder="Treatment rationale, patient preferences..." {...register('notes')} />
            </div>

            {/* ── Phases ── */}
            <div className="border-t border-gray-200 pt-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400">Treatment Phases & Procedures</p>
                <button
                  type="button"
                  onClick={() => appendPhase({ name: `Phase ${phaseFields.length + 1}`, procedures: [{ cdt_code: '', name: '', tooth: '', fee: '', status: 'pending' }] })}
                  className="text-[9px] uppercase tracking-wider border border-gray-300 text-gray-500 px-2 py-1 hover:border-black hover:text-black transition-colors"
                >
                  + Add Phase
                </button>
              </div>

              <div className="space-y-6">
                {phaseFields.map((phase, phIdx) => (
                  <PhaseBuilder
                    key={phase.id}
                    phIdx={phIdx}
                    control={control}
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    canRemove={phaseFields.length > 1}
                    onRemove={() => removePhase(phIdx)}
                  />
                ))}
              </div>
            </div>

            {/* Grand total */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Estimated Total</p>
                <p className="text-lg font-black text-black">{fmtINR(grandTotal)}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200">
            {mutation.isError && (
              <p className="text-[10px] text-red-500">
                {mutation.error?.response?.data?.detail ?? 'Failed to create plan'}
              </p>
            )}
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={onClose} className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black hover:text-black transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={mutation.isPending} className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
                {mutation.isPending ? 'Saving...' : 'Create Plan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── PhaseBuilder sub-component ─────────────────────────────────────────────

function PhaseBuilder({ phIdx, control, register, watch, setValue, canRemove, onRemove }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `phases.${phIdx}.procedures`,
  })

  const procedures = watch(`phases.${phIdx}.procedures`) ?? []
  const phaseTotal = procedures.reduce((s, p) => s + (Number(p?.fee) || 0), 0)

  const applyCode = (prIdx, code) => {
    const entry = CDT_CODES.find((c) => c.code === code)
    if (entry) {
      setValue(`phases.${phIdx}.procedures.${prIdx}.name`, entry.label)
      setValue(`phases.${phIdx}.procedures.${prIdx}.fee`, entry.fee)
    }
  }

  return (
    <div className="border border-gray-200">
      {/* Phase header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <input
          className="text-[10px] font-bold uppercase tracking-wider text-black bg-transparent border-none outline-none w-48"
          placeholder={`Phase ${phIdx + 1}`}
          {...register(`phases.${phIdx}.name`)}
        />
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500">{fmtINR(phaseTotal)}</span>
          {canRemove && (
            <button type="button" onClick={onRemove} className="text-gray-400 hover:text-black transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Procedure rows */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-gray-400 w-32">CDT Code</th>
            <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-gray-400">Procedure Name</th>
            <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-gray-400 w-20">Tooth #</th>
            <th className="px-3 py-2 text-right text-[9px] uppercase tracking-wider text-gray-400 w-24">Fee (₹)</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {fields.map((field, prIdx) => (
            <tr key={field.id} className="border-b border-gray-100">
              {/* CDT code selector */}
              <td className="px-3 py-2">
                <select
                  className="w-full text-xs font-mono border-none outline-none bg-transparent text-gray-700"
                  {...register(`phases.${phIdx}.procedures.${prIdx}.cdt_code`)}
                  onChange={(e) => {
                    register(`phases.${phIdx}.procedures.${prIdx}.cdt_code`).onChange(e)
                    applyCode(prIdx, e.target.value)
                  }}
                >
                  <option value="">Select</option>
                  {CDT_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </td>
              {/* Procedure name */}
              <td className="px-3 py-2">
                <input
                  className="w-full text-xs text-black border-none outline-none bg-transparent"
                  placeholder="Procedure description"
                  {...register(`phases.${phIdx}.procedures.${prIdx}.name`)}
                />
              </td>
              {/* Tooth */}
              <td className="px-3 py-2">
                <input
                  className="w-full text-xs text-gray-600 border-none outline-none bg-transparent"
                  placeholder="e.g. 16"
                  {...register(`phases.${phIdx}.procedures.${prIdx}.tooth`)}
                />
              </td>
              {/* Fee */}
              <td className="px-3 py-2">
                <input
                  type="number"
                  className="w-full text-xs text-black text-right border-none outline-none bg-transparent"
                  placeholder="0"
                  {...register(`phases.${phIdx}.procedures.${prIdx}.fee`)}
                />
              </td>
              {/* Remove */}
              <td className="px-3 py-2">
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(prIdx)} className="text-gray-300 hover:text-black transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add procedure */}
      <div className="px-3 py-2 border-t border-gray-100">
        <button
          type="button"
          onClick={() => append({ cdt_code: '', name: '', tooth: '', fee: '', status: 'pending' })}
          className="text-[9px] uppercase tracking-wider text-gray-400 hover:text-black transition-colors"
        >
          + Add Procedure
        </button>
      </div>
    </div>
  )
}

// ── Treatments page ────────────────────────────────────────────────────────

export default function Treatments() {
  const [filter,      setFilter]      = useState('all')
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)
  const [selectedId,  setSelectedId]  = useState(null)
  const [showNewPlan, setShowNewPlan] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['treatment-plans', { filter, search, page }],
    queryFn:  () => treatmentPlansApi.list({
      search:    search || undefined,
      status:    filter !== 'all' ? filter : undefined,
      page,
      page_size: 30,
    }),
    select: (res) => res.data,
  })

  const plans      = data?.items ?? []
  const total      = data?.total ?? 0
  const totalPages = Math.ceil(total / 30)

  return (
    <>
      <div className="flex h-full overflow-hidden">

        {/* ── LEFT 65% ─────────────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden border-r border-gray-200" style={{ width: '65%' }}>

          {/* Filter bar */}
          <div className="flex-shrink-0 flex items-center gap-6 px-6 py-3 border-b border-gray-200">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black whitespace-nowrap">Filter By</span>
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
              placeholder="Search by patient name, plan title..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="flex-1 bg-transparent border-none outline-none text-sm text-black placeholder-gray-300"
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1) }} className="text-gray-400 hover:text-black transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Section heading */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-black">Treatment Plan Registry</p>
              <button
                onClick={() => setShowNewPlan(true)}
                className="text-[9px] uppercase tracking-wider text-gray-400 border border-gray-300 px-2 py-1 hover:border-black hover:text-black transition-colors"
              >
                + New
              </button>
            </div>
            <span className="text-[10px] text-gray-400">{total} plans</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Patient</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Plan Title</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Phases</th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-gray-400">Est. Total</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  : plans.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-[10px] uppercase tracking-widest text-gray-300">
                        No treatment plans found
                      </td>
                    </tr>
                  )
                  : plans.map((plan) => (
                    <tr
                      key={plan.id}
                      onClick={() => setSelectedId((prev) => prev === plan.id ? null : plan.id)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        selectedId === plan.id ? 'bg-gray-50' : 'hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-black leading-tight">
                          {plan.patient_name ?? `Patient #${plan.patient_id}`}
                        </p>
                        {plan.patient_id && (
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                            PA-{String(plan.patient_id).padStart(4, '0')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {plan.title ?? `Plan v${plan.version ?? 1}`}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 text-center">
                        {plan.phases?.length ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-black font-medium text-right">
                        {fmtINR(planTotal(plan))}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={plan.status} small />
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
              <span className="text-[10px] text-gray-400">Page {page} of {totalPages} · {total} plans</span>
              <div className="flex items-center gap-5">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-black disabled:opacity-25 transition-colors">← Prev</button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-black disabled:opacity-25 transition-colors">Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT 35% ─────────────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden" style={{ width: '35%' }}>
          <PlanDetailPanel
            planId={selectedId}
            onNewPlan={() => setShowNewPlan(true)}
          />
        </div>
      </div>

      {showNewPlan && <NewPlanModal onClose={() => setShowNewPlan(false)} />}
    </>
  )
}
