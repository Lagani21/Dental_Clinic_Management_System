/**
 * Shared permissions panel used by both AccountNew and AccountDetail.
 *
 * Props:
 *   roleKey       string   — current role key ('doctor' | 'receptionist' | 'nurse' | 'compounder')
 *   perms         object   — { [permission]: boolean }
 *   onChange      fn       — (permKey, newValue) => void
 *   onReset       fn       — () => void — resets to role defaults
 *   showBadge     bool     — show "Default for X" / "Custom permissions" badge
 *   autoSave      bool     — show "Saved" indicator instead of reset
 */
import { PERMISSION_GROUPS, DEFAULT_PERMISSIONS, LOCKED_ON, isCustomized, ROLE_META } from './permissionConfig'

function Toggle({ enabled, locked, onChange }) {
  // Track: w-11 (44px) h-6 (24px)
  // Knob:  w-5 (20px)  h-5 (20px), 2px margin each side
  // OFF → translate-x-0  (knob at 2px from left)
  // ON  → translate-x-5  (knob at 22px from left, 2px from right)
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => !locked && onChange(!enabled)}
      aria-pressed={enabled}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
        enabled ? 'bg-black' : 'bg-gray-300'
      } ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function PermissionsPanel({ roleKey, perms, onChange, onReset, showBadge = true }) {
  const defaults  = new Set(DEFAULT_PERMISSIONS[roleKey] ?? [])
  const locked    = LOCKED_ON[roleKey] ?? new Set()
  const customized = showBadge && isCustomized(roleKey, perms)

  const enabledCount  = Object.values(perms).filter(Boolean).length
  const disabledCount = Object.values(perms).filter((v) => !v).length
  const roleMeta      = ROLE_META[roleKey]

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-black">
          Permissions
        </p>
        {showBadge && (
          <span className={`text-[9px] font-medium tracking-wider border px-2 py-0.5 ${
            customized
              ? 'border-amber-400 text-amber-600 bg-amber-50'
              : 'border-green-400 text-green-600 bg-green-50'
          }`}>
            {customized
              ? 'Custom permissions'
              : `Default for ${roleMeta?.label ?? roleKey}`
            }
          </span>
        )}
      </div>

      {/* Groups */}
      <div className="space-y-5 flex-1 overflow-y-auto">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-2 border-b border-gray-100 pb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.permissions.map(({ key, name, desc }) => {
                const isOn      = perms[key] ?? false
                const isDefault = defaults.has(key)
                const isLocked  = locked.has(key)
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between py-2.5 px-3 transition-colors ${
                      isOn ? 'bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-black">{name}</span>
                        {isDefault && (
                          <span className="text-[8px] uppercase tracking-wider border border-gray-300 text-gray-400 px-1 py-0.5 leading-none">
                            default
                          </span>
                        )}
                        {isLocked && (
                          <span className="text-[8px] uppercase tracking-wider border border-gray-300 text-gray-400 px-1 py-0.5 leading-none">
                            locked
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{desc}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] w-5 text-right ${isOn ? 'text-black font-medium' : 'text-gray-400'}`}>
                        {isOn ? 'On' : 'Off'}
                      </span>
                      <Toggle enabled={isOn} locked={isLocked} onChange={(v) => onChange(key, v)} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer summary */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-[9px] uppercase tracking-wider border border-black text-black px-2 py-0.5">
            Enabled: {enabledCount}
          </span>
          <span className="text-[9px] uppercase tracking-wider border border-gray-300 text-gray-500 px-2 py-0.5">
            Disabled: {disabledCount}
          </span>
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] uppercase tracking-wider text-gray-400 hover:text-black transition-colors underline underline-offset-2"
          >
            Reset to defaults
          </button>
        )}
      </div>
    </div>
  )
}
