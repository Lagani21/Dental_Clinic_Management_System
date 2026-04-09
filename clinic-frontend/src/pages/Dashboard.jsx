import { useQuery } from '@tanstack/react-query'
import { Users, CalendarDays, CheckCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { appointmentsApi } from '../services/api'
import useAuthStore from '../store/authStore'

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

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-slate-800">{value ?? '—'}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: todayAppts } = useQuery({
    queryKey: ['appointments', 'today'],
    queryFn: () => appointmentsApi.list({ appointment_date: today, page_size: 50 }),
    select: (res) => res.data,
  })

  const items = todayAppts?.items ?? []
  const completed = items.filter((a) => a.status === 'completed').length
  const pending = items.filter((a) => ['scheduled', 'checked_in', 'in_chair'].includes(a.status)).length

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Good morning, {user?.first_name} 👋
        </h1>
        <p className="text-sm text-slate-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Today's Appointments" value={todayAppts?.total} color="bg-primary-600" />
        <StatCard icon={CheckCircle}  label="Completed"            value={completed}           color="bg-green-500" />
        <StatCard icon={Clock}        label="Pending"              value={pending}             color="bg-yellow-500" />
        <StatCard icon={Users}        label="In Chair"             value={items.filter(a => a.status === 'in_chair').length} color="bg-blue-500" />
      </div>

      {/* Today's appointment list */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
          <h2 className="font-medium text-slate-800">Today's Schedule</h2>
          <span className="text-sm text-slate-500">{format(new Date(), 'MMM d')}</span>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No appointments today</div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {items.map((appt) => (
              <li key={appt.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{appt.patient_id}</p>
                  <p className="text-xs text-slate-500">
                    {appt.start_time} · {appt.duration_minutes} min · {appt.reason ?? 'General'}
                  </p>
                </div>
                <span className={STATUS_BADGE[appt.status] ?? 'badge-gray'}>
                  {STATUS_LABEL[appt.status] ?? appt.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
