import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { adminApi } from '../../services/api'
import { ROLE_META } from './permissionConfig'

const ROLE_FILTERS = [
  { key: '',             label: 'All' },
  { key: 'doctor',       label: 'Doctor' },
  { key: 'receptionist', label: 'Receptionist' },
  { key: 'nurse',        label: 'Nurse' },
  { key: 'compounder',   label: 'Compounder' },
]

export default function AccountList() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const [roleFilter, setRoleFilter] = useState('')

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['admin-accounts', roleFilter],
    queryFn:  () => adminApi.listAccounts(roleFilter ? { role: roleFilter } : {}).then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => adminApi.updateAccount(id, { is_active }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['admin-accounts'] }),
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-b border-gray-200">
        <h1 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black">Staff Accounts</h1>
        <button
          onClick={() => navigate('/settings/new')}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
        >
          <Plus className="h-3 w-3" /> New Account
        </button>
      </div>

      {/* Role filter bar */}
      <div className="flex-shrink-0 flex items-center gap-6 px-8 py-3 border-b border-gray-200">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black whitespace-nowrap">Filter By</span>
        {ROLE_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRoleFilter(key)}
            className={
              roleFilter === key
                ? 'text-[10px] font-bold uppercase tracking-wider text-black underline underline-offset-2'
                : 'text-[10px] uppercase tracking-wider text-gray-400 hover:text-black transition-colors'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
            <tr>
              {['Full Name', 'Role', 'Email', 'Permissions', 'Status', ''].map((h) => (
                <th key={h} className={`py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400 ${h === 'Full Name' ? 'px-8' : 'px-4'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-8 py-4">
                      <div className="h-3 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-24 text-center text-[10px] uppercase tracking-widest text-gray-300">
                  No accounts found
                </td>
              </tr>
            ) : (
              accounts.map((acc) => {
                const meta = ROLE_META[acc.role] ?? { label: acc.role, initials: '??', color: 'bg-gray-200 text-black' }
                return (
                  <tr
                    key={acc.id}
                    onClick={() => navigate(`/settings/${acc.id}`)}
                    className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ${meta.color}`}>
                          {meta.initials}
                        </span>
                        <span className="text-sm font-bold text-black">{acc.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-block border border-gray-300 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 leading-none text-gray-600">
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{acc.email}</td>
                    <td className="px-4 py-4 text-[11px] text-gray-500 font-mono">{acc.permission_count} enabled</td>
                    <td className="px-4 py-4">
                      <span className={`inline-block border text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 leading-none ${
                        acc.is_active ? 'border-black text-black' : 'border-gray-300 text-gray-400'
                      }`}>
                        {acc.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleMutation.mutate({ id: acc.id, is_active: !acc.is_active })}
                        disabled={toggleMutation.isPending}
                        className="text-[10px] uppercase tracking-wider text-gray-400 border border-gray-200 px-3 py-1.5 hover:border-black hover:text-black transition-colors disabled:opacity-40"
                      >
                        {acc.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
