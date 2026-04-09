import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { adminApi } from '../../services/api'
import {
  PERMISSIONS, ROLE_META,
  buildDefaultPerms, isCustomized,
} from './permissionConfig'
import PermissionsPanel from './PermissionsPanel'

const ROLES = ['doctor', 'receptionist', 'nurse', 'compounder']

export default function AccountNew() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [selectedRole, setSelectedRole] = useState('doctor')
  const [perms, setPerms]               = useState(() => buildDefaultPerms('doctor'))
  const [autoGen, setAutoGen]           = useState(true)

  const { register, handleSubmit, formState: { errors } } = useForm()

  // Account counts by role for the cards
  const { data: allAccounts = [] } = useQuery({
    queryKey: ['admin-accounts', ''],
    queryFn:  () => adminApi.listAccounts({}).then((r) => r.data),
  })
  const countByRole = allAccounts.reduce((acc, a) => {
    acc[a.role] = (acc[a.role] ?? 0) + 1
    return acc
  }, {})

  const createMutation = useMutation({
    mutationFn: (data) => adminApi.createAccount(data),
    onSuccess: async (res) => {
      const id = res.data.id
      // If user customized permissions, push overrides
      if (isCustomized(selectedRole, perms)) {
        const toggles = PERMISSIONS.map((p) => ({ permission: p, granted: perms[p] }))
        await adminApi.updatePermissions(id, toggles)
      }
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
      navigate(`/settings/${id}`)
    },
  })

  const handleRoleSelect = (role) => {
    setSelectedRole(role)
    setPerms(buildDefaultPerms(role))
  }

  const handlePermChange = (key, value) => {
    setPerms((prev) => ({ ...prev, [key]: value }))
  }

  const handleReset = () => setPerms(buildDefaultPerms(selectedRole))

  const onSubmit = (formData) => {
    createMutation.mutate({
      full_name: formData.full_name,
      email:     formData.email,
      phone:     formData.phone || null,
      role:      selectedRole,
      password:  autoGen ? null : (formData.password || null),
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex-shrink-0 flex items-center gap-4 px-8 py-4 border-b border-gray-200">
        <button
          onClick={() => navigate('/settings')}
          className="text-gray-400 hover:text-black transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black">New Staff Account</p>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Role cards ─────────────────────────────────── */}
        <div className="flex-shrink-0 w-64 border-r border-gray-200 overflow-y-auto px-6 py-6">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Select Role</p>
          <div className="space-y-2">
            {ROLES.map((role) => {
              const meta  = ROLE_META[role]
              const count = countByRole[role] ?? 0
              const active = selectedRole === role
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSelect(role)}
                  className={`w-full text-left p-4 border transition-colors ${
                    active
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-black bg-white text-black'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      active ? 'bg-white text-black' : meta.color
                    }`}>
                      {meta.initials}
                    </span>
                    <div>
                      <p className={`text-xs font-bold ${active ? 'text-white' : 'text-black'}`}>
                        {meta.label}
                      </p>
                      <p className={`text-[9px] mt-0.5 ${active ? 'text-gray-300' : 'text-gray-400'}`}>
                        {count} account{count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right: Form + Permissions ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Account details */}
            <div className="px-8 py-6 border-b border-gray-200 space-y-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">Account Details</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Full Name *</label>
                  <input
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    placeholder="Dr. Priya Sharma"
                    {...register('full_name', { required: true })}
                  />
                  {errors.full_name && <p className="text-[9px] text-red-500 mt-1">Required</p>}
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Email *</label>
                  <input
                    type="email"
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    placeholder="priya@clinic.in"
                    {...register('email', { required: true })}
                  />
                  {errors.email && <p className="text-[9px] text-red-500 mt-1">Required</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Phone</label>
                  <input
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    placeholder="9876543210"
                    {...register('phone')}
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Role</label>
                  <div className="border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-gray-600 capitalize">
                    {ROLE_META[selectedRole]?.label ?? selectedRole}
                    <span className="text-gray-400 text-[10px] ml-2">(set from left panel)</span>
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    id="auto-gen"
                    type="checkbox"
                    checked={autoGen}
                    onChange={(e) => setAutoGen(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <label htmlFor="auto-gen" className="text-[10px] text-gray-600 cursor-pointer">
                    Auto-generate password and email to user
                  </label>
                </div>
                {!autoGen && (
                  <input
                    type="password"
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    placeholder="Set initial password"
                    {...register('password')}
                  />
                )}
              </div>
            </div>

            {/* Permissions */}
            <div className="px-8 py-6">
              <PermissionsPanel
                roleKey={selectedRole}
                perms={perms}
                onChange={handlePermChange}
                onReset={handleReset}
                showBadge
              />

              {createMutation.isError && (
                <p className="text-[10px] text-red-500 mt-4">
                  {createMutation.error?.response?.data?.detail ?? 'Failed to create account'}
                </p>
              )}

              {/* Submit */}
              <div className="flex justify-end pt-6">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-6 py-2.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
