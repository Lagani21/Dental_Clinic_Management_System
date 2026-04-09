import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import useAuthStore from '../../store/authStore'

const NAV_ITEMS = [
  { to: '/patients',      label: 'Patients' },
  { to: '/schedule',      label: 'Schedule' },
  { to: '/treatments',    label: 'Treatments' },
  { to: '/prescriptions', label: 'Prescriptions' },
  { to: '/billing',       label: 'Billing' },
  { to: '/settings',      label: 'Settings' },
]

export default function AppLayout() {
  const user     = useAuthStore((s) => s.user)
  const logout   = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-screen bg-white">

      {/* ── Wordmark ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-gray-200 relative">
        {/* User / logout pinned top-right */}
        <div className="absolute right-5 top-0 h-full flex items-center gap-3">
          <div className="text-right leading-none">
            <p className="text-[10px] font-medium text-black">{user?.full_name ?? '—'}</p>
            <p className="text-[9px] text-gray-400 capitalize mt-0.5">
              {user?.role?.replace(/_/g, ' ') ?? ''}
            </p>
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            title="Logout"
            className="text-gray-400 hover:text-black transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Centered wordmark with decorative pipes */}
        <div className="flex items-center justify-center gap-4 py-5">
          <span className="text-gray-300 font-thin text-2xl leading-none select-none">|</span>
          <h1 className="text-2xl font-black tracking-[0.3em] uppercase text-black select-none leading-none">
            Dental Archive
          </h1>
          <span className="text-gray-300 font-thin text-2xl leading-none select-none">|</span>
        </div>
      </div>

      {/* ── Nav — equal-width bordered cells ─────────────────────── */}
      <div className="flex-shrink-0 border-b border-gray-200">
        <nav className="flex divide-x divide-gray-200">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 text-center py-3 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                  isActive
                    ? 'text-black bg-white'
                    : 'text-gray-400 hover:text-black hover:bg-gray-50'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* ── Page content ─────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
