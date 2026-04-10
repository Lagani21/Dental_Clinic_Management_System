import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isToday,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Edit2, CalendarClock, XCircle, CheckCircle, Plus, X } from 'lucide-react'
import { appointmentsApi, patientsApi } from '../services/api'

// ── Constants ──────────────────────────────────────────────────────────────

const VIEW_OPTIONS = [
  { key: 'day',    label: 'Day' },
  { key: 'week',   label: 'Weekly' },
  { key: 'month',  label: 'Monthly' },
  { key: 'doctor', label: 'Dr. Assigned' },
]

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 08–19

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_BADGE = {
  scheduled:  'SCHEDULED',
  confirmed:  'CONFIRMED',
  checked_in: 'CHECKED IN',
  in_chair:   'IN CHAIR',
  completed:  'COMPLETED',
  no_show:    'NO SHOW',
  cancelled:  'CANCELLED',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function startHour(timeStr) {
  if (!timeStr) return null
  return parseInt(timeStr.split(':')[0], 10)
}

function fmtTime(timeStr) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  return `${h}:${m}`
}

function calcEndTime(startStr, durationMins) {
  if (!startStr) return '—'
  const [h, m] = startStr.split(':').map(Number)
  const total = h * 60 + m + (durationMins ?? 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function isEmergency(appt) {
  return (
    appt.status === 'emergency' ||
    appt.reason?.toLowerCase().includes('emergency') ||
    appt.procedure_type?.toLowerCase().includes('emergency')
  )
}

function patientLabel(appt) {
  return appt.patient_name ?? `Patient #${appt.patient_id}`
}

function procedureLabel(appt) {
  return (appt.reason ?? appt.procedure_type ?? '').toUpperCase()
}

// ── Shared: AppointmentCard ────────────────────────────────────────────────

function AppointmentCard({ appt, isSelected, onClick, compact = false }) {
  const urgent = isEmergency(appt)
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer select-none transition-colors ${
        compact ? 'p-1' : 'p-2'
      } ${
        urgent
          ? 'bg-black text-white'
          : isSelected
          ? 'border border-black bg-gray-50'
          : 'border border-gray-300 bg-white hover:border-black'
      }`}
    >
      <p className={`font-bold leading-tight truncate ${compact ? 'text-[10px]' : 'text-xs'} ${urgent ? 'text-white' : 'text-black'}`}>
        {patientLabel(appt)}
      </p>
      {!compact && (
        <p className={`text-[9px] uppercase tracking-wider mt-0.5 ${urgent ? 'opacity-70' : 'text-gray-500'}`}>
          {procedureLabel(appt)}
        </p>
      )}
    </div>
  )
}

// ── Shared: AppointmentDetail panel ───────────────────────────────────────

const STATUS_FLOW = ['scheduled', 'confirmed', 'checked_in', 'in_chair', 'completed']
const CANCELLATION_TYPES = [
  { value: 'patient_request',  label: 'Patient Request' },
  { value: 'clinic_initiated', label: 'Clinic Initiated' },
  { value: 'no_show',          label: 'No Show' },
]

function AppointmentDetail({ appt, onUpdated }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'reschedule' | 'cancel'

  // Reset mode when a different appointment is selected
  useEffect(() => { setMode('view') }, [appt?.id])

  // ── Edit form ──────────────────────────────────────────────────────────
  const editForm = useForm({
    values: {
      reason:           appt?.reason ?? '',
      procedure_type:   appt?.procedure_type ?? '',
      duration_minutes: appt?.duration_minutes ?? 60,
      chair:            appt?.chair ?? '',
      notes:            appt?.notes ?? '',
    },
  })

  const editMutation = useMutation({
    mutationFn: (data) => appointmentsApi.update(appt.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setMode('view')
      onUpdated?.()
    },
  })

  // ── Reschedule form ────────────────────────────────────────────────────
  const rescheduleForm = useForm({
    values: {
      appointment_date: appt?.appointment_date ?? format(new Date(), 'yyyy-MM-dd'),
      start_time:       appt?.start_time ?? '09:00',
      reason:           '',
    },
  })

  const rescheduleMutation = useMutation({
    mutationFn: (data) => appointmentsApi.reschedule(appt.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setMode('view')
      onUpdated?.()
    },
  })

  // ── Cancel form ────────────────────────────────────────────────────────
  const cancelForm = useForm({
    defaultValues: { cancellation_type: 'patient_request', cancellation_reason: '' },
  })

  const cancelMutation = useMutation({
    mutationFn: (data) => appointmentsApi.updateStatus(appt.id, {
      status: data.cancellation_type === 'no_show' ? 'no_show' : 'cancelled',
      ...data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setMode('view')
      onUpdated?.()
    },
  })

  // ── Status advance ─────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: (status) => appointmentsApi.updateStatus(appt.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  })

  const currentStatusIdx = STATUS_FLOW.indexOf(appt?.status)
  const nextStatus = currentStatusIdx >= 0 && currentStatusIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentStatusIdx + 1]
    : null

  const isTerminal = appt?.status === 'cancelled' || appt?.status === 'no_show' || appt?.status === 'completed'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 h-14 px-6 border-b border-gray-200 flex items-center justify-between">
        <p className="text-sm font-bold text-black">Appointment Detail</p>
        {appt && mode === 'view' && !isTerminal && (
          <div className="flex items-center gap-3">
            <button onClick={() => setMode('edit')}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 hover:text-black transition-colors">
              <Edit2 className="h-3 w-3" /> Edit
            </button>
            <button onClick={() => setMode('reschedule')}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 hover:text-black transition-colors">
              <CalendarClock className="h-3 w-3" /> Reschedule
            </button>
            <button onClick={() => setMode('cancel')}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-400 hover:text-red-600 transition-colors">
              <XCircle className="h-3 w-3" /> Cancel
            </button>
          </div>
        )}
        {appt && mode !== 'view' && (
          <button onClick={() => setMode('view')}
            className="text-[10px] uppercase tracking-wider text-gray-400 hover:text-black transition-colors">
            ← Back
          </button>
        )}
      </div>

      {!appt ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-gray-300">Select an appointment</p>
        </div>

      ) : mode === 'edit' ? (
        /* ── Edit mode ──────────────────────────────────────────────── */
        <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d))}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Reason / Chief Complaint</label>
            <input className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              {...editForm.register('reason')} />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Procedure Type</label>
            <input className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              {...editForm.register('procedure_type')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Duration (min)</label>
              <input type="number" min={15} step={15}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                {...editForm.register('duration_minutes', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Chair</label>
              <input className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                placeholder="e.g. Chair 1"
                {...editForm.register('chair')} />
            </div>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Notes</label>
            <textarea rows={3}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
              {...editForm.register('notes')} />
          </div>
          {editMutation.isError && (
            <p className="text-[10px] text-red-500">{editMutation.error?.response?.data?.detail ?? 'Update failed'}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setMode('view')}
              className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={editMutation.isPending}
              className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
              {editMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>

      ) : mode === 'reschedule' ? (
        /* ── Reschedule mode ────────────────────────────────────────── */
        <form onSubmit={rescheduleForm.handleSubmit((d) => rescheduleMutation.mutate(d))}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">New Date</label>
            <input type="date"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              {...rescheduleForm.register('appointment_date', { required: true })} />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">New Start Time</label>
            <input type="time"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              {...rescheduleForm.register('start_time', { required: true })} />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Reason for Reschedule</label>
            <textarea rows={3} required
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
              placeholder="Required — why is this appointment being rescheduled?"
              {...rescheduleForm.register('reason', { required: true })} />
          </div>
          {rescheduleMutation.isError && (
            <p className="text-[10px] text-red-500">{rescheduleMutation.error?.response?.data?.detail ?? 'Reschedule failed'}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setMode('view')}
              className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={rescheduleMutation.isPending}
              className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
              {rescheduleMutation.isPending ? 'Saving…' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>

      ) : mode === 'cancel' ? (
        /* ── Cancel / No-show mode ──────────────────────────────────── */
        <form onSubmit={cancelForm.handleSubmit((d) => cancelMutation.mutate(d))}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-medium text-red-700">
              You are about to cancel or mark as no-show:
            </p>
            <p className="text-sm font-bold text-black mt-1">{patientLabel(appt)}</p>
            <p className="text-[10px] text-gray-500">
              {appt.appointment_date ? format(new Date(appt.appointment_date), 'MMMM d, yyyy') : '—'}
              {' at '}{fmtTime(appt.start_time)}
            </p>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Type</label>
            <select className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
              {...cancelForm.register('cancellation_type')}>
              {CANCELLATION_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Reason</label>
            <textarea rows={3} required
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
              placeholder="Required — reason for cancellation"
              {...cancelForm.register('cancellation_reason', { required: true })} />
          </div>
          {cancelMutation.isError && (
            <p className="text-[10px] text-red-500">{cancelMutation.error?.response?.data?.detail ?? 'Action failed'}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setMode('view')}
              className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black transition-colors">
              Go Back
            </button>
            <button type="submit" disabled={cancelMutation.isPending}
              className="text-[10px] uppercase tracking-wider font-bold border border-red-500 text-red-500 px-4 py-2 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40">
              {cancelMutation.isPending ? 'Processing…' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>

      ) : (
        /* ── View mode ──────────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          <DetailRow label="Patient"
            value={`${patientLabel(appt)}${appt.patient_id ? ` (PA-${String(appt.patient_id).padStart(4, '0')})` : ''}`}
            bold />
          <DetailRow label="Time Slot"
            value={`${fmtTime(appt.start_time)} – ${calcEndTime(appt.start_time, appt.duration_minutes)}`}
            bold />
          <DetailRow label="Date"
            value={appt.appointment_date ? format(new Date(appt.appointment_date), 'EEEE, MMMM d, yyyy') : '—'}
            bold />
          <DetailRow label="Primary Doctor"
            value={appt.doctor_name ?? appt.doctor ?? '—'}
            bold />
          <DetailRow label="Treatment Type"
            value={appt.reason ?? appt.procedure_type ?? '—'}
            bold />
          {appt.chair && <DetailRow label="Chair Assignment" value={appt.chair} bold />}
          {appt.notes && <DetailRow label="Notes" value={appt.notes} />}

          {/* Status + advance */}
          <div className="px-6 py-4 space-y-3">
            <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400">Status</p>
            <span className="inline-block border border-black text-black text-[10px] font-medium tracking-wider px-2 py-0.5 leading-none">
              {STATUS_BADGE[appt.status] ?? appt.status?.toUpperCase() ?? '—'}
            </span>

            {nextStatus && (
              <div>
                <button
                  onClick={() => statusMutation.mutate(nextStatus)}
                  disabled={statusMutation.isPending}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold border border-black text-black px-3 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40 w-full justify-center mt-2"
                >
                  <CheckCircle className="h-3 w-3" />
                  Mark as {STATUS_BADGE[nextStatus]}
                </button>
              </div>
            )}
          </div>

          {appt.allergies && (
            <div className="px-6 py-3 bg-red-50 border-t border-red-100">
              <p className="text-[9px] uppercase tracking-[0.15em] text-red-500 mb-1">Allergy Alert</p>
              <p className="text-xs font-medium text-red-700">{appt.allergies}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, bold }) {
  return (
    <div className="px-6 py-4">
      <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1.5">{label}</p>
      <p className={`text-sm text-black leading-snug ${bold ? 'font-bold' : 'font-normal'}`}>{value}</p>
    </div>
  )
}

// ── DayView ────────────────────────────────────────────────────────────────

function DayView({ date, selectedId, onSelect }) {
  const dateStr = format(date, 'yyyy-MM-dd')

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', 'day', dateStr],
    queryFn:  () => appointmentsApi.list({ appointment_date: dateStr, page_size: 100 }),
    select:   (res) => res.data?.items ?? [],
  })

  const appointments = data ?? []

  const doctors = useMemo(() => {
    const seen = new Map()
    appointments.forEach((a) => {
      const key = a.doctor_id ?? a.doctor ?? 'unknown'
      if (!seen.has(key)) seen.set(key, { id: key, name: a.doctor_name ?? a.doctor ?? 'Doctor' })
    })
    return [...seen.values()]
  }, [appointments])

  const grid = useMemo(() => {
    const map = new Map()
    doctors.forEach((d) => map.set(d.id, new Map()))
    appointments.forEach((a) => {
      const key = a.doctor_id ?? a.doctor ?? 'unknown'
      const h = startHour(a.start_time)
      if (h !== null && map.has(key)) map.get(key).set(h, a)
    })
    return map
  }, [appointments, doctors])

  const spanned = useMemo(() => {
    const set = new Set()
    appointments.forEach((a) => {
      const key = a.doctor_id ?? a.doctor ?? 'unknown'
      const h = startHour(a.start_time)
      if (h === null) return
      for (let i = 1; i < Math.ceil((a.duration_minutes ?? 60) / 60); i++) set.add(`${key}-${h + i}`)
    })
    return set
  }, [appointments])

  const selectedAppt = appointments.find((a) => a.id === selectedId) ?? null

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col overflow-hidden border-r border-gray-200" style={{ width: '65%' }}>
        <div className="flex-shrink-0 h-14 flex items-center justify-between px-6 border-b border-gray-200">
          <p className="text-sm font-bold text-black">{format(date, 'EEEE, MMMM d, yyyy')}</p>
          <button className="text-[10px] uppercase tracking-wider text-gray-500 underline underline-offset-2 hover:text-black transition-colors">
            Print Schedule
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-200">
                  <th className="w-16 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black border-r border-gray-200">
                    Time
                  </th>
                  {doctors.length === 0 ? (
                    <th className="px-5 py-3 text-left text-[10px] text-gray-300 uppercase tracking-wider">
                      No appointments today
                    </th>
                  ) : doctors.map((d) => (
                    <th key={d.id} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black border-l border-gray-200">
                      {d.name.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="border-b border-gray-100" style={{ height: 80 }}>
                    <td className="w-16 px-3 align-top pt-2 text-sm text-gray-500 border-r border-gray-200 whitespace-nowrap">
                      {String(hour).padStart(2, '0')}:00
                    </td>
                    {doctors.length === 0 ? <td /> : doctors.map((d) => {
                      if (spanned.has(`${d.id}-${hour}`)) return null
                      const appt = grid.get(d.id)?.get(hour)
                      const span = appt ? Math.max(1, Math.ceil((appt.duration_minutes ?? 60) / 60)) : 1
                      return (
                        <td key={d.id} rowSpan={span} className="px-3 align-top pt-2 border-l border-gray-200">
                          {appt && (
                            <AppointmentCard
                              appt={appt}
                              isSelected={selectedId === appt.id}
                              onClick={() => onSelect(appt.id)}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden" style={{ width: '35%' }}>
        <AppointmentDetail appt={selectedAppt} />
      </div>
    </div>
  )
}

// ── WeekView ───────────────────────────────────────────────────────────────

function WeekView({ date, selectedId, onSelect }) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }) // Mon
  const weekEnd   = endOfWeek(date, { weekStartsOn: 1 })
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', 'week', format(weekStart, 'yyyy-MM-dd')],
    queryFn:  () => appointmentsApi.list({
      appointment_date_after:  format(weekStart, 'yyyy-MM-dd'),
      appointment_date_before: format(weekEnd,   'yyyy-MM-dd'),
      page_size: 200,
    }),
    select: (res) => res.data?.items ?? [],
  })

  const appointments = data ?? []

  // Group appointments by date string
  const byDate = useMemo(() => {
    const map = new Map()
    appointments.forEach((a) => {
      const key = a.appointment_date
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(a)
    })
    return map
  }, [appointments])

  // Get unique doctors
  const doctors = useMemo(() => {
    const seen = new Map()
    appointments.forEach((a) => {
      const key = a.doctor_id ?? a.doctor ?? 'unknown'
      if (!seen.has(key)) seen.set(key, { id: key, name: a.doctor_name ?? a.doctor ?? 'Doctor' })
    })
    return [...seen.values()]
  }, [appointments])

  const selectedAppt = appointments.find((a) => a.id === selectedId) ?? null

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col overflow-hidden border-r border-gray-200" style={{ width: '65%' }}>
        <div className="flex-shrink-0 h-14 flex items-center justify-between px-6 border-b border-gray-200">
          <p className="text-sm font-bold text-black">
            {format(weekStart, 'MMMM d')} – {format(weekEnd, 'd, yyyy')}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400">
            {appointments.length} this week
          </p>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-200">
                  <th className="w-20 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black border-r border-gray-200">
                    Doctor
                  </th>
                  {days.map((d) => (
                    <th key={d.toISOString()} className={`px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider border-l border-gray-200 ${
                      isToday(d) ? 'text-black' : 'text-gray-400'
                    }`}>
                      <span className="block">{format(d, 'EEE').toUpperCase()}</span>
                      <span className={`block text-base mt-0.5 ${isToday(d) ? 'font-black text-black' : 'font-normal text-gray-500'}`}>
                        {format(d, 'd')}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doctors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center text-[10px] uppercase tracking-widest text-gray-300">
                      No appointments this week
                    </td>
                  </tr>
                ) : doctors.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-100" style={{ minHeight: 80 }}>
                    <td className="px-3 py-3 align-top border-r border-gray-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-black leading-tight">
                        {doc.name.split(' ').slice(-1)[0]}
                      </p>
                      <p className="text-[9px] text-gray-400 leading-tight">
                        {doc.name.split(' ').slice(0, -1).join(' ')}
                      </p>
                    </td>
                    {days.map((d) => {
                      const dateStr = format(d, 'yyyy-MM-dd')
                      const dayAppts = (byDate.get(dateStr) ?? []).filter(
                        (a) => (a.doctor_id ?? a.doctor ?? 'unknown') === doc.id
                      )
                      return (
                        <td key={d.toISOString()} className="px-2 py-2 align-top border-l border-gray-200" style={{ minWidth: 80 }}>
                          <div className="space-y-1">
                            {dayAppts.map((a) => (
                              <div key={a.id}>
                                <p className="text-[9px] text-gray-400 mb-0.5">{fmtTime(a.start_time)}</p>
                                <AppointmentCard
                                  appt={a}
                                  compact
                                  isSelected={selectedId === a.id}
                                  onClick={() => onSelect(a.id)}
                                />
                              </div>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col overflow-hidden" style={{ width: '35%' }}>
        <AppointmentDetail appt={selectedAppt} />
      </div>
    </div>
  )
}

// ── MonthView ──────────────────────────────────────────────────────────────

function MonthView({ date, selectedId, onSelect }) {
  const monthStart = startOfMonth(date)
  const monthEnd   = endOfMonth(date)
  // Pad to full weeks (Mon–Sun)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd,     { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', 'month', format(monthStart, 'yyyy-MM')],
    queryFn:  () => appointmentsApi.list({
      appointment_date_after:  format(gridStart, 'yyyy-MM-dd'),
      appointment_date_before: format(gridEnd,   'yyyy-MM-dd'),
      page_size: 500,
    }),
    select: (res) => res.data?.items ?? [],
  })

  const appointments = data ?? []

  const byDate = useMemo(() => {
    const map = new Map()
    appointments.forEach((a) => {
      const key = a.appointment_date
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(a)
    })
    return map
  }, [appointments])

  const selectedAppt = appointments.find((a) => a.id === selectedId) ?? null

  // Split days into weeks
  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col overflow-hidden border-r border-gray-200" style={{ width: '65%' }}>
        <div className="flex-shrink-0 h-14 flex items-center justify-between px-6 border-b border-gray-200">
          <p className="text-sm font-bold text-black">{format(date, 'MMMM yyyy')}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400">
            {appointments.length} this month
          </p>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 border-b border-gray-200 sticky top-0 bg-white z-10">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 border-l border-gray-200 first:border-l-0">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-200" style={{ minHeight: 100 }}>
                {week.map((d) => {
                  const dateStr  = format(d, 'yyyy-MM-dd')
                  const dayAppts = byDate.get(dateStr) ?? []
                  const inMonth  = isSameMonth(d, date)
                  const today    = isToday(d)
                  return (
                    <div
                      key={d.toISOString()}
                      className={`px-2 py-2 border-l border-gray-200 first:border-l-0 ${
                        !inMonth ? 'bg-gray-50' : ''
                      }`}
                    >
                      {/* Day number */}
                      <p className={`text-xs font-bold mb-1 ${
                        today    ? 'text-black underline underline-offset-2'
                        : inMonth ? 'text-gray-800'
                        : 'text-gray-300'
                      }`}>
                        {format(d, 'd')}
                      </p>

                      {/* Up to 3 appointments */}
                      <div className="space-y-0.5">
                        {dayAppts.slice(0, 3).map((a) => {
                          const urgent = isEmergency(a)
                          return (
                            <div
                              key={a.id}
                              onClick={() => onSelect(a.id)}
                              className={`text-[9px] leading-tight px-1 py-0.5 truncate cursor-pointer transition-colors ${
                                urgent
                                  ? 'bg-black text-white'
                                  : selectedId === a.id
                                  ? 'border border-black bg-gray-50 text-black'
                                  : 'border border-gray-200 text-gray-700 hover:border-black'
                              }`}
                            >
                              <span className="font-bold">{fmtTime(a.start_time)}</span>
                              {' '}{patientLabel(a)}
                            </div>
                          )
                        })}
                        {dayAppts.length > 3 && (
                          <p className="text-[9px] text-gray-400 pl-1">+{dayAppts.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col overflow-hidden" style={{ width: '35%' }}>
        <AppointmentDetail appt={selectedAppt} />
      </div>
    </div>
  )
}

// ── DoctorView — all doctors, today only ──────────────────────────────────

function DoctorView({ date, selectedId, onSelect }) {
  const dateStr = format(date, 'yyyy-MM-dd')

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', 'doctor-view', dateStr],
    queryFn:  () => appointmentsApi.list({ appointment_date: dateStr, page_size: 100 }),
    select:   (res) => res.data?.items ?? [],
  })

  const appointments = data ?? []

  const doctors = useMemo(() => {
    const seen = new Map()
    appointments.forEach((a) => {
      const key = a.doctor_id ?? a.doctor ?? 'unknown'
      if (!seen.has(key)) seen.set(key, { id: key, name: a.doctor_name ?? a.doctor ?? 'Doctor', appts: [] })
      seen.get(key).appts.push(a)
    })
    // Sort each doctor's appts by start_time
    seen.forEach((d) => d.appts.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')))
    return [...seen.values()]
  }, [appointments])

  const selectedAppt = appointments.find((a) => a.id === selectedId) ?? null

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col overflow-hidden border-r border-gray-200" style={{ width: '65%' }}>
        <div className="flex-shrink-0 h-14 flex items-center justify-between px-6 border-b border-gray-200">
          <p className="text-sm font-bold text-black">{format(date, 'EEEE, MMMM d, yyyy')}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400">
            {doctors.length} doctors · {appointments.length} appts
          </p>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
          </div>
        ) : doctors.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[10px] uppercase tracking-widest text-gray-300">No appointments today</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
            {doctors.map((doc) => (
              <div key={doc.id}>
                {/* Doctor header */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-black">{doc.name.toUpperCase()}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{doc.appts.length} appointment{doc.appts.length !== 1 ? 's' : ''}</p>
                </div>

                {/* Queue table */}
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-2 text-left text-[9px] font-medium uppercase tracking-wider text-gray-400 w-20">Time</th>
                      <th className="px-4 py-2 text-left text-[9px] font-medium uppercase tracking-wider text-gray-400">Patient</th>
                      <th className="px-4 py-2 text-left text-[9px] font-medium uppercase tracking-wider text-gray-400">Procedure</th>
                      <th className="px-4 py-2 text-left text-[9px] font-medium uppercase tracking-wider text-gray-400">Dur.</th>
                      <th className="px-6 py-2 text-left text-[9px] font-medium uppercase tracking-wider text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.appts.map((a) => {
                      const urgent = isEmergency(a)
                      return (
                        <tr
                          key={a.id}
                          onClick={() => onSelect(a.id)}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${
                            selectedId === a.id ? 'bg-gray-50' : 'hover:bg-[#F9FAFB]'
                          }`}
                        >
                          <td className="px-6 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {fmtTime(a.start_time)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold text-black leading-tight">{patientLabel(a)}</p>
                          </td>
                          <td className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500">
                            {procedureLabel(a)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {a.duration_minutes ? `${a.duration_minutes}m` : '—'}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-block text-[10px] font-medium tracking-wider px-2 py-0.5 leading-none border ${
                              urgent ? 'border-black bg-black text-white' : 'border-black text-black'
                            }`}>
                              {STATUS_BADGE[a.status] ?? a.status?.toUpperCase() ?? '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col overflow-hidden" style={{ width: '35%' }}>
        <AppointmentDetail appt={selectedAppt} />
      </div>
    </div>
  )
}

// ── NewAppointmentModal ────────────────────────────────────────────────────

const PROCEDURE_TYPES = [
  'Consultation', 'Cleaning', 'Filling', 'Root Canal', 'Extraction',
  'Crown', 'Bridge', 'Implant', 'Whitening', 'Orthodontics', 'X-Ray', 'Other',
]

function NewAppointmentModal({ defaultDate, onClose, onCreated }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      patient_id:       '',
      doctor_id:        '',
      appointment_date: format(defaultDate, 'yyyy-MM-dd'),
      appointment_time: '09:00',
      procedure_type:   'Consultation',
      reason:           '',
      duration_minutes: 30,
      chair:            '',
      notes:            '',
    },
  })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-list'],
    queryFn:  () => patientsApi.list({ page_size: 200 }).then((r) => r.data?.items ?? []),
  })

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors-list'],
    queryFn:  () => appointmentsApi.doctors().then((r) => r.data ?? []),
  })

  const mutation = useMutation({
    mutationFn: (data) => appointmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      onCreated()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex-shrink-0 h-14 flex items-center justify-between px-6 border-b border-gray-200">
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-black">New Appointment</p>
          <button onClick={onClose} className="text-gray-400 hover:text-black transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* Patient */}
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Patient *</label>
              <select required
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
                {...register('patient_id', { required: true })}>
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name} · {p.phone}</option>
                ))}
              </select>
              {errors.patient_id && <p className="mt-1 text-[10px] text-red-500">Required</p>}
            </div>

            {/* Doctor */}
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
              {errors.doctor_id && <p className="mt-1 text-[10px] text-red-500">Required</p>}
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Date *</label>
                <input type="date" required
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  {...register('appointment_date', { required: true })} />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Time *</label>
                <input type="time" required
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  {...register('appointment_time', { required: true })} />
              </div>
            </div>

            {/* Procedure + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Procedure</label>
                <select
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
                  {...register('procedure_type')}>
                  {PROCEDURE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Duration (min)</label>
                <select
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
                  {...register('duration_minutes', { valueAsNumber: true })}>
                  {[15, 30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Reason / Chief Complaint</label>
              <input
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                placeholder="e.g. Tooth pain upper right"
                {...register('reason')} />
            </div>

            {/* Chair + Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Chair</label>
                <input
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  placeholder="e.g. Chair 1"
                  {...register('chair')} />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Notes</label>
                <input
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  placeholder="Optional"
                  {...register('notes')} />
              </div>
            </div>

          </div>

          {mutation.isError && (
            <div className="px-6 py-2 bg-red-50 border-t border-red-100">
              <p className="text-[10px] text-red-600">
                {mutation.error?.response?.data?.detail ?? 'Failed to create appointment'}
              </p>
            </div>
          )}

          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-5 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
              {mutation.isPending ? 'Saving…' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── dateLabel — contextual label for a date ────────────────────────────────

function dateLabel(d) {
  const today     = new Date()
  const yesterday = subDays(today, 1)
  const tomorrow  = addDays(today, 1)
  if (format(d, 'yyyy-MM-dd') === format(today,     'yyyy-MM-dd')) return 'Today'
  if (format(d, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Yesterday'
  if (format(d, 'yyyy-MM-dd') === format(tomorrow,  'yyyy-MM-dd')) return 'Tomorrow'
  return null
}

// ── Schedule (main) ────────────────────────────────────────────────────────

export default function Schedule() {
  const [view,       setView]       = useState('day')
  const [date,       setDate]       = useState(new Date())
  const [selectedId, setSelectedId] = useState(null)
  const [showNewAppt, setShowNewAppt] = useState(false)

  const go = {
    prev:      () => { setSelectedId(null); setDate((d) => view === 'month' ? subMonths(d, 1) : view === 'week' ? subWeeks(d, 1) : subDays(d, 1)) },
    next:      () => { setSelectedId(null); setDate((d) => view === 'month' ? addMonths(d, 1) : view === 'week' ? addWeeks(d, 1) : addDays(d, 1)) },
    today:     () => { setDate(new Date()); setSelectedId(null) },
    yesterday: () => { setDate(subDays(new Date(), 1)); setSelectedId(null) },
    tomorrow:  () => { setDate(addDays(new Date(), 1)); setSelectedId(null) },
    toDate:    (d) => { setDate(d); setSelectedId(null) },
  }

  const handleSelect = (id) => setSelectedId((prev) => prev === id ? null : id)

  // Build a 9-day strip centred on the selected date so it slides on next/prev
  const stripDays = Array.from({ length: 9 }, (_, i) => addDays(subDays(date, 4), i))

  // For week/month, show step labels instead of day strip
  const isStripView = view === 'day' || view === 'doctor'

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Row 1: View-by tabs ───────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-6 px-6 py-3 border-b border-gray-200">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black whitespace-nowrap">
          View By
        </span>
        {VIEW_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setView(key); setSelectedId(null) }}
            className={
              view === key
                ? 'text-[10px] font-bold uppercase tracking-wider text-black underline underline-offset-2 whitespace-nowrap'
                : 'text-[10px] uppercase tracking-wider text-gray-400 hover:text-black transition-colors whitespace-nowrap'
            }
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowNewAppt(true)}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold border border-black text-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors whitespace-nowrap"
        >
          <Plus className="h-3 w-3" /> New Appointment
        </button>
      </div>

      {/* ── Row 2: Date navigation ───────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-gray-200 px-4 flex items-stretch" style={{ minHeight: '64px' }}>
        {isStripView ? (
          /* Day / Dr.Assigned: full-width 9-day strip */
          <div className="flex items-stretch w-full gap-px">
            <button onClick={go.prev} className="flex items-center px-2 text-gray-400 hover:text-black transition-colors flex-shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </button>

            {stripDays.map((d) => {
              const isSelected = format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
              const ctx        = dateLabel(d)
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => go.toDate(d)}
                  className={`flex flex-col items-center justify-center flex-1 transition-colors border-x border-transparent ${
                    isSelected
                      ? 'bg-black text-white border-black'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                  }`}
                >
                  <span className={`text-[8px] uppercase tracking-wider leading-none ${isSelected ? 'text-white opacity-60' : 'text-gray-400'}`}>
                    {ctx ?? format(d, 'EEE')}
                  </span>
                  <span className={`text-sm font-bold leading-tight mt-1 ${isSelected ? 'text-white' : 'text-black'}`}>
                    {format(d, 'd')}
                  </span>
                  <span className={`text-[8px] leading-none mt-0.5 ${isSelected ? 'text-white opacity-60' : 'text-gray-400'}`}>
                    {format(d, 'MMM')}
                  </span>
                </button>
              )
            })}

            <button onClick={go.next} className="flex items-center px-2 text-gray-400 hover:text-black transition-colors flex-shrink-0">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* Week / Month: same height bar, prev · label · today · next */
          <div className="flex items-center w-full gap-3">
            <button onClick={go.prev} className="flex items-center px-2 self-stretch text-gray-400 hover:text-black transition-colors flex-shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-bold text-black flex-1">
              {view === 'week'
                ? `${format(startOfWeek(date, { weekStartsOn: 1 }), 'MMM d')} – ${format(endOfWeek(date, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
                : format(date, 'MMMM yyyy')
              }
            </p>
            <button onClick={go.today} className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-2.5 py-1 hover:border-black hover:text-black transition-colors flex-shrink-0">
              Today
            </button>
            <button onClick={go.next} className="flex items-center px-2 self-stretch text-gray-400 hover:text-black transition-colors flex-shrink-0">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── View content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {view === 'day'    && <DayView    date={date} selectedId={selectedId} onSelect={handleSelect} />}
        {view === 'week'   && <WeekView   date={date} selectedId={selectedId} onSelect={handleSelect} />}
        {view === 'month'  && <MonthView  date={date} selectedId={selectedId} onSelect={handleSelect} />}
        {view === 'doctor' && <DoctorView date={date} selectedId={selectedId} onSelect={handleSelect} />}
      </div>

      {showNewAppt && (
        <NewAppointmentModal
          defaultDate={date}
          onClose={() => setShowNewAppt(false)}
          onCreated={() => setShowNewAppt(false)}
        />
      )}
    </div>
  )
}
