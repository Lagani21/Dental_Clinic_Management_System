import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  FileText,
  Package,
  Settings,
  Stethoscope,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patients',     icon: Users,           label: 'Patients' },
  { to: '/appointments', icon: CalendarDays,    label: 'Appointments' },
  { to: '/treatments',   icon: ClipboardList,   label: 'Treatments' },
  { to: '/billing',      icon: FileText,        label: 'Billing' },
  { to: '/inventory',    icon: Package,         label: 'Inventory' },
]

export default function Sidebar() {
  return (
    <aside className="flex w-60 flex-col border-r border-surface-border bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-surface-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
          <Stethoscope className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-semibold text-slate-800">DentFlow</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-surface-muted hover:text-slate-800'
                  )
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Settings */}
      <div className="border-t border-surface-border px-3 py-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-surface-muted hover:text-slate-800'
            )
          }
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
