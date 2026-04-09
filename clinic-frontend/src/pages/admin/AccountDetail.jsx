import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Edit2, Check, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { adminApi } from '../../services/api'
import { ROLE_META, buildDefaultPerms } from './permissionConfig'
import PermissionsPanel from './PermissionsPanel'

export default function AccountDetail() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data: account, isLoading } = useQuery({
    queryKey: ['admin-account', id],
    queryFn:  () => adminApi.getAccount(id).then((r) => r.data),
    enabled:  !!id,
  })

  const { data: auditLog = [] } = useQuery({
    queryKey: ['admin-audit', id],
    queryFn:  () => adminApi.getAuditLog(id).then((r) => r.data),
    enabled:  !!id,
  })

  // Edit profile form
  const { register, handleSubmit, reset: resetForm } = useForm()

  const updateMutation = useMutation({
    mutationFn: (data) => adminApi.updateAccount(id, data),
    onSuccess: (res) => {
      queryClient.setQueryData(['admin-account', id], res.data)
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
      setEditing(false)
    },
  })

  const permMutation = useMutation({
    mutationFn: (toggles) => adminApi.updatePermissions(id, toggles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-account', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['admin-audit', id] })
    },
  })

  const handlePermChange = (permKey, newValue) => {
    permMutation.mutate([{ permission: permKey, granted: newValue }])
  }

  // Build local perms map from account.permissions array
  const permsMap = account
    ? Object.fromEntries(account.permissions.map((p) => [p.permission, p.granted]))
    : buildDefaultPerms('doctor')

  const handleReset = () => {
    if (!account) return
    const defaults = buildDefaultPerms(account.role)
    const toggles  = Object.entries(defaults).map(([permission, granted]) => ({ permission, granted }))
    permMutation.mutate(toggles)
  }

  if (isLoading || !account) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
      </div>
    )
  }

  const meta = ROLE_META[account.role] ?? { label: account.role, initials: '??', color: 'bg-gray-200 text-black' }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex-shrink-0 flex items-center gap-4 px-8 py-4 border-b border-gray-200">
        <button onClick={() => navigate('/settings')} className="text-gray-400 hover:text-black transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${meta.color}`}>
            {meta.initials}
          </span>
          <div>
            <p className="text-sm font-bold text-black">{account.full_name}</p>
            <p className="text-[10px] text-gray-400">{account.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-block border border-gray-300 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 text-gray-600">
            {meta.label}
          </span>
          <span className={`inline-block border text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 ${
            account.is_active ? 'border-black text-black' : 'border-gray-300 text-gray-400'
          }`}>
            {account.is_active ? 'Active' : 'Inactive'}
          </span>
          {!editing && (
            <button
              onClick={() => {
                resetForm({ full_name: account.full_name, phone: account.phone ?? '' })
                setEditing(true)
              }}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400 hover:text-black transition-colors"
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Inline edit form */}
        {editing && (
          <form
            onSubmit={handleSubmit((d) => updateMutation.mutate(d))}
            className="px-8 py-5 border-b border-gray-200 bg-gray-50 space-y-4"
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black">Edit Account Info</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Full Name</label>
                <input
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
                  {...register('full_name', { required: true })}
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Phone</label>
                <input
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
                  {...register('phone')}
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Status</label>
                <select
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
                  {...register('is_active', { setValueAs: (v) => v === 'true' })}
                  defaultValue={String(account.is_active)}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            {updateMutation.isError && (
              <p className="text-[10px] text-red-500">{updateMutation.error?.response?.data?.detail ?? 'Update failed'}</p>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
                <Check className="h-3 w-3" />
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black transition-colors">
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          </form>
        )}

        {/* Permissions panel */}
        <div className="px-8 py-6 border-b border-gray-200">
          {permMutation.isError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200">
              <p className="text-[10px] text-red-600">{permMutation.error?.response?.data?.detail ?? 'Permission update failed'}</p>
            </div>
          )}
          {permMutation.isPending && (
            <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-3">Saving…</p>
          )}
          <PermissionsPanel
            roleKey={account.role}
            perms={permsMap}
            onChange={handlePermChange}
            onReset={handleReset}
            showBadge
          />
        </div>

        {/* Audit log */}
        <div className="px-8 py-6">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Permission Audit Log</p>
          {auditLog.length === 0 ? (
            <p className="text-[10px] text-gray-300 uppercase tracking-widest">No changes recorded yet</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Permission', 'Change', 'Changed By', 'Date'].map((h) => (
                    <th key={h} className="text-left py-2 text-[9px] font-medium uppercase tracking-wider text-gray-400 pr-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-6 text-xs font-mono text-gray-700">{entry.permission}</td>
                    <td className="py-3 pr-6">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] border px-1.5 py-0.5 ${
                          entry.old_value === null
                            ? 'border-gray-200 text-gray-400'
                            : entry.old_value
                            ? 'border-black text-black'
                            : 'border-gray-300 text-gray-400'
                        }`}>
                          {entry.old_value === null ? 'new' : entry.old_value ? 'ON' : 'OFF'}
                        </span>
                        <span className="text-gray-300">→</span>
                        <span className={`text-[9px] border px-1.5 py-0.5 font-medium ${
                          entry.new_value ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-400'
                        }`}>
                          {entry.new_value ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-6 text-xs text-gray-600">{entry.changed_by_name}</td>
                    <td className="py-3 text-[10px] text-gray-400">
                      {format(parseISO(entry.changed_at), 'dd MMM yyyy HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
