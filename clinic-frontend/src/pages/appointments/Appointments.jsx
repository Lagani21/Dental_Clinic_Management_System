import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { appointmentsApi } from '../../services/api'
import clsx from 'clsx'

const STATUS_BADGE = {
  scheduled:  'badge-blue',
  checked_in: 'badge-yellow',
  in_chair:   'badge-yellow',
  completed:  'badge-green',
  no_show:    'badge-red',
  cancelled:  'badge-gray',
}

const STATUS_LABEL = {
  scheduled:  'Scheduled',
  checked_in: 'Checked In',
  in_chair:   'In Chair',
  completed:  'Completed',
  no_show:    'No Show',
  cancelled:  'Cancelled',
}

const STATUS_FLOW = {
  scheduled:  ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['in_chair', 'no_show'],
  in_chair:   ['completed'],
  completed:  [],
  no_show:    [],
  cancelled:  [],
}

export default function Appointments() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', { date: selectedDate }],
    queryFn: () => appointmentsApi.list({ appointment_date: selectedDate, page_size: 50 }),
    select: (res) => res.data,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => appointmentsApi.updateStatus(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  })

  const shiftDate = (days) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(format(d, 'yyyy-MM-dd'))
  }

  const appointments = data?.items ?? []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Appointments</h1>
        <button className="btn-primary">
          <Plus className="h-4 w-4" />
          New Appointment
        </button>
      </div>

      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <button onClick={() => shiftDate(-1)} className="btn-secondary rounded-lg p-2">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="date"
          className="input w-auto"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        <button onClick={() => shiftDate(1)} className="btn-secondary rounded-lg p-2">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
          className="btn-ghost text-sm"
        >Today</button>
        <span className="text-sm text-slate-500">{data?.total ?? 0} appointments</span>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : appointments.length === 0 ? (
          <div className="py-12 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No appointments on this day</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {appointments.map((appt) => (
              <li key={appt.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-16 text-right">
                  <p className="text-sm font-medium text-slate-700">{appt.start_time?.slice(0,5)}</p>
                  <p className="text-xs text-slate-400">{appt.duration_minutes}m</p>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{appt.patient_id}</p>
                  <p className="text-xs text-slate-500 truncate">{appt.reason ?? 'General Checkup'}</p>
                </div>

                <span className={STATUS_BADGE[appt.status] ?? 'badge-gray'}>
                  {STATUS_LABEL[appt.status] ?? appt.status}
                </span>

                {/* Quick status actions */}
                {STATUS_FLOW[appt.status]?.length > 0 && (
                  <div className="flex gap-1.5">
                    {STATUS_FLOW[appt.status].map((nextStatus) => (
                      <button
                        key={nextStatus}
                        onClick={() => statusMutation.mutate({ id: appt.id, status: nextStatus })}
                        className={clsx(
                          'text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors',
                          nextStatus === 'cancelled' || nextStatus === 'no_show'
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-primary-200 text-primary-700 hover:bg-primary-50'
                        )}
                      >
                        → {STATUS_LABEL[nextStatus]}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
