import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { appointmentsApi } from '../services/api'

// ── Constants ──────────────────────────────────────────────────────────────

const VIEW_OPTIONS = [
  { key: 'day',    label: 'Day' },
  { key: 'week',   label: 'Weekly Overview' },
  { key: 'month',  label: 'Monthly' },
  { key: 'doctor', label: 'Dr. Assigned' },
]

// Hourly slots 08:00–19:00
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8)

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

// "09:00:00" → 9
function startHour(timeStr) {
  if (!timeStr) return null
  const [h] = timeStr.split(':')
  return parseInt(h, 10)
}

// "09:00:00" → "09:00"
function fmtTime(timeStr) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  return `${h}:${m}`
}

function endTime(startStr, durationMins) {
  if (!startStr) return '—'
  const [h, m] = startStr.split(':').map(Number)
  const totalMins = h * 60 + m + (durationMins ?? 60)
  const eh = Math.floor(totalMins / 60)
  const em = totalMins % 60
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
}

// ── AppointmentCard ────────────────────────────────────────────────────────

function AppointmentCard({ appt, isSelected, onClick }) {
  const isEmergency = appt.status === 'emergency' ||
    appt.reason?.toLowerCase().includes('emergency') ||
    appt.procedure_type?.toLowerCase().includes('emergency')

  if (isEmergency) {
    return (
      <div
        onClick={onClick}
        className="bg-black text-white p-2 cursor-pointer select-none"
      >
        <p className="text-xs font-bold leading-tight">{appt.patient_name ?? `Patient #${appt.patient_id}`}</p>
        <p className="text-[9px] uppercase tracking-wider mt-0.5 opacity-70">
          {appt.reason ?? appt.procedure_type ?? ''}
        </p>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`border p-2 cursor-pointer select-none transition-colors ${
        isSelected ? 'border-black bg-gray-50' : 'border-gray-300 bg-white hover:border-black'
      }`}
    >
      <p className="text-xs font-bold text-black leading-tight">
        {appt.patient_name ?? `Patient #${appt.patient_id}`}
      </p>
      <p className="text-[9px] uppercase tracking-wider text-gray-500 mt-0.5">
        {appt.reason ?? appt.procedure_type ?? ''}
      </p>
    </div>
  )
}

// ── Detail panel ───────────────────────────────────────────────────────────

function AppointmentDetail({ appt }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
        <p className="text-sm font-bold text-black">Appointment Detail</p>
      </div>

      {!appt ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-gray-300">
            Select an appointment
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          <DetailRow
            label="Patient"
            value={`${appt.patient_name ?? `Patient #${appt.patient_id}`}${appt.patient_id ? ` (PA-${String(appt.patient_id).padStart(4, '0')})` : ''}`}
            bold
          />
          <DetailRow
            label="Time Slot"
            value={`${fmtTime(appt.start_time)} - ${endTime(appt.start_time, appt.duration_minutes)}`}
            bold
          />
          <DetailRow
            label="Primary Doctor"
            value={appt.doctor_name ?? appt.doctor ?? '—'}
            bold
          />
          <DetailRow
            label="Treatment Type"
            value={appt.reason ?? appt.procedure_type ?? '—'}
            bold
          />
          <div className="px-6 py-4">
            <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-2">Status</p>
            <span className="inline-block border border-black text-black text-[10px] font-medium tracking-wider px-2 py-0.5 leading-none">
              {STATUS_BADGE[appt.status] ?? appt.status?.toUpperCase() ?? '—'}
            </span>
          </div>
          {appt.chair && (
            <DetailRow label="Chair Assignment" value={appt.chair} bold />
          )}
          {appt.notes && (
            <DetailRow label="Notes" value={appt.notes} />
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

  // Get unique doctors from appointments
  const doctors = useMemo(() => {
    const seen = new Map()
    appointments.forEach((a) => {
      const key = a.doctor_id ?? a.doctor ?? 'unknown'
      if (!seen.has(key)) {
        seen.set(key, {
          id:   key,
          name: a.doctor_name ?? a.doctor ?? 'Unknown Doctor',
        })
      }
    })
    return [...seen.values()]
  }, [appointments])

  // Map: doctorId → Map(hour → appointment)
  const grid = useMemo(() => {
    const map = new Map()
    doctors.forEach((d) => map.set(d.id, new Map()))
    appointments.forEach((a) => {
      const key = a.doctor_id ?? a.doctor ?? 'unknown'
      const h = startHour(a.start_time)
      if (h !== null && map.has(key)) {
        map.get(key).set(h, a)
      }
    })
    return map
  }, [appointments, doctors])

  // Track which hour cells are "spanned" by a multi-hour appointment
  const spanned = useMemo(() => {
    const set = new Set() // "doctorId-hour"
    appointments.forEach((a) => {
      const key = a.doctor_id ?? a.doctor ?? 'unknown'
      const h = startHour(a.start_time)
      if (h === null) return
      const durationHours = Math.ceil((a.duration_minutes ?? 60) / 60)
      for (let i = 1; i < durationHours; i++) {
        set.add(`${key}-${h + i}`)
      }
    })
    return set
  }, [appointments])

  const selectedAppt = appointments.find(
    (a) => a.id === selectedId
  ) ?? null

  return (
    <div className="flex h-full overflow-hidden">

      {/* LEFT 65%: time grid */}
      <div className="flex flex-col overflow-hidden border-r border-gray-200" style={{ width: '65%' }}>

        {/* Date row */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {/* handled by parent */}}
              className="text-gray-400 hover:text-black transition-colors"
            >
            </button>
            <p className="text-base font-bold text-black">
              {format(date, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <button className="text-[10px] uppercase tracking-wider text-gray-500 underline underline-offset-2 hover:text-black transition-colors">
            Print Schedule
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-200">
                  {/* Time column header */}
                  <th className="w-16 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black border-r border-gray-200">
                    Time
                  </th>
                  {doctors.length === 0 ? (
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-black">
                      No appointments today
                    </th>
                  ) : (
                    doctors.map((d) => (
                      <th key={d.id} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black border-l border-gray-200">
                        {d.name.toUpperCase()}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="border-b border-gray-100" style={{ height: 80 }}>
                    {/* Time label */}
                    <td className="w-16 px-3 align-top pt-2 text-sm text-gray-500 border-r border-gray-200 whitespace-nowrap">
                      {String(hour).padStart(2, '0')}:00
                    </td>

                    {doctors.length === 0 ? (
                      <td />
                    ) : (
                      doctors.map((d) => {
                        const spanKey = `${d.id}-${hour}`
                        if (spanned.has(spanKey)) return null

                        const appt = grid.get(d.id)?.get(hour)
                        const rowSpanVal = appt
                          ? Math.max(1, Math.ceil((appt.duration_minutes ?? 60) / 60))
                          : 1

                        return (
                          <td
                            key={d.id}
                            rowSpan={rowSpanVal}
                            className="px-3 align-top pt-2 border-l border-gray-200"
                            style={{ verticalAlign: 'top' }}
                          >
                            {appt && (
                              <AppointmentCard
                                appt={appt}
                                isSelected={selectedId === appt.id}
                                onClick={() => onSelect(appt.id)}
                              />
                            )}
                          </td>
                        )
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RIGHT 35%: detail panel — always visible */}
      <div className="flex flex-col overflow-hidden" style={{ width: '35%' }}>
        <AppointmentDetail appt={selectedAppt} />
      </div>
    </div>
  )
}

// ── Schedule (main) ────────────────────────────────────────────────────────

export default function Schedule() {
  const [view,       setView]       = useState('day')
  const [date,       setDate]       = useState(new Date())
  const [selectedId, setSelectedId] = useState(null)

  const prevDay  = () => setDate((d) => subDays(d, 1))
  const nextDay  = () => setDate((d) => addDays(d, 1))
  const goToday  = () => setDate(new Date())

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── View-by bar ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-6 px-6 py-3 border-b border-gray-200">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black whitespace-nowrap">
          View By
        </span>
        {VIEW_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={
              view === key
                ? 'text-[10px] font-bold uppercase tracking-wider text-black underline underline-offset-2 whitespace-nowrap'
                : 'text-[10px] uppercase tracking-wider text-gray-400 hover:text-black transition-colors whitespace-nowrap'
            }
          >
            {label}
          </button>
        ))}

        {/* Date nav — right side */}
        <div className="ml-auto flex items-center gap-3">
          <button onClick={prevDay} className="text-gray-400 hover:text-black transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="text-[10px] uppercase tracking-wider text-gray-500 hover:text-black transition-colors"
          >
            Today
          </button>
          <button onClick={nextDay} className="text-gray-400 hover:text-black transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {view === 'day' ? (
          <DayView
            date={date}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((prev) => prev === id ? null : id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] uppercase tracking-widest text-gray-300">
              {VIEW_OPTIONS.find((v) => v.key === view)?.label} — coming next
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
