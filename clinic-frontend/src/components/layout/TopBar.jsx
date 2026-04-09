import { useNavigate } from 'react-router-dom'
import { Bell, LogOut, ChevronDown } from 'lucide-react'
import useAuthStore from '../../store/authStore'

const ROLE_LABEL = {
  superadmin:    'Superadmin',
  clinic_owner:  'Clinic Owner',
  doctor:        'Doctor',
  receptionist:  'Receptionist',
}

export default function TopBar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-surface-border bg-white px-6">
      {/* Left: breadcrumb placeholder */}
      <div />

      {/* Right: actions + user */}
      <div className="flex items-center gap-3">
        <button className="btn-ghost rounded-lg p-2">
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-800 leading-tight">{user?.full_name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[user?.role] ?? user?.role}</p>
          </div>
        </div>

        <button onClick={handleLogout} className="btn-ghost rounded-lg p-2 text-slate-500" title="Logout">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
