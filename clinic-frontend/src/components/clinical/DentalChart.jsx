/**
 * Interactive FDI dental chart.
 * Adult teeth: 11-18, 21-28, 31-38, 41-48 (32 teeth).
 * Each tooth rendered as 5 clickable surface polygons + whole-tooth status overlay.
 * Conditions: intact(white) | caries(red) | filled(blue) | crown(gold) |
 *             root_canal(purple) | fracture(orange) | other(gray)
 * Tooth status overlays: missing(X) | implant(■) | unerupted(○)
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clinicalApi } from '../../services/api'

// ── Colour map ────────────────────────────────────────────────────────────────

const CONDITION_COLORS = {
  intact:     '#ffffff',
  caries:     '#ef4444',
  filled:     '#3b82f6',
  crown:      '#f59e0b',
  root_canal: '#8b5cf6',
  fracture:   '#f97316',
  bridge:     '#06b6d4',
  other:      '#9ca3af',
}

const CONDITIONS = [
  { value: 'intact',     label: 'Intact / Clear' },
  { value: 'caries',     label: 'Caries' },
  { value: 'filled',     label: 'Filled' },
  { value: 'crown',      label: 'Crown' },
  { value: 'root_canal', label: 'Root Canal' },
  { value: 'fracture',   label: 'Fracture' },
  { value: 'bridge',     label: 'Bridge Pontic' },
  { value: 'other',      label: 'Other' },
]

const TOOTH_STATUSES = [
  { value: 'missing',   label: 'Missing' },
  { value: 'implant',   label: 'Implant' },
  { value: 'unerupted', label: 'Unerupted' },
  { value: 'clear',     label: 'Clear Status' },
]

const SURFACES = ['mesial', 'distal', 'buccal', 'lingual', 'occlusal']

// FDI adult teeth in display order (top arch L→R, bottom arch L→R)
const UPPER = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28]
const LOWER = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38]

const TOOTH_SIZE = 32  // px per tooth cell
const GAP = 2

// ── SVG tooth: 5 surface polygons in a square ─────────────────────────────────
//  Layout (looking at occlusal):
//       [buccal/incisal top strip]
//  [mesial left] [occlusal center] [distal right]
//       [lingual bottom strip]

function ToothSVG({ toothNum, surfaces = {}, status, onSurfaceClick, onStatusClick }) {
  const S = TOOTH_SIZE
  const C = S / 2
  const inset = 8

  const surfacePolys = {
    occlusal: `${inset},${inset} ${S-inset},${inset} ${S-inset},${S-inset} ${inset},${S-inset}`,
    buccal:   `0,0 ${S},0 ${S-inset},${inset} ${inset},${inset}`,
    lingual:  `${inset},${S-inset} ${S-inset},${S-inset} ${S},${S} 0,${S}`,
    mesial:   `0,0 ${inset},${inset} ${inset},${S-inset} 0,${S}`,
    distal:   `${S-inset},${inset} ${S},0 ${S},${S} ${S-inset},${S-inset}`,
  }

  const isMissing = status === 'missing'

  return (
    <svg
      width={S} height={S}
      className="cursor-pointer flex-shrink-0"
      style={{ display: 'block' }}
    >
      {/* border */}
      <rect x={0} y={0} width={S} height={S} fill="#e5e7eb" rx={2} />

      {isMissing ? (
        // Missing tooth — grey with X
        <>
          <rect x={0} y={0} width={S} height={S} fill="#f3f4f6" rx={2} />
          <line x1={4} y1={4} x2={S-4} y2={S-4} stroke="#9ca3af" strokeWidth={2} />
          <line x1={S-4} y1={4} x2={4} y2={S-4} stroke="#9ca3af" strokeWidth={2} />
        </>
      ) : status === 'implant' ? (
        <>
          {Object.entries(surfacePolys).map(([s, pts]) => (
            <polygon key={s} points={pts} fill={CONDITION_COLORS[surfaces[s]] ?? '#ffffff'}
              stroke="#d1d5db" strokeWidth={0.5}
              onClick={() => onSurfaceClick(toothNum, s)}
            />
          ))}
          <rect x={C-6} y={C-6} width={12} height={12} fill="none" stroke="#3b82f6" strokeWidth={2} />
          <text x={C} y={C+1} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#3b82f6" fontWeight="bold">I</text>
        </>
      ) : (
        Object.entries(surfacePolys).map(([s, pts]) => (
          <polygon
            key={s}
            points={pts}
            fill={CONDITION_COLORS[surfaces[s]] ?? '#ffffff'}
            stroke="#d1d5db"
            strokeWidth={0.5}
            onClick={() => onSurfaceClick(toothNum, s)}
            className="hover:opacity-80 transition-opacity"
          />
        ))
      )}

      {/* Whole-tooth click target (transparent overlay for status) */}
      <rect x={0} y={0} width={S} height={S} fill="transparent"
        onContextMenu={(e) => { e.preventDefault(); onStatusClick(toothNum) }}
      />
    </svg>
  )
}

// ── Tooltip / picker popover ───────────────────────────────────────────────────

function Picker({ title, onSelect, onClose }) {
  return (
    <div className="absolute z-30 bg-white border border-gray-200 shadow-lg p-3 space-y-1" style={{ minWidth: 160 }}>
      <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-2">{title}</p>
      {CONDITIONS.map(c => (
        <button
          key={c.value}
          onClick={() => onSelect(c.value)}
          className="flex items-center gap-2 w-full text-left text-xs hover:bg-gray-50 px-1 py-0.5"
        >
          <span className="h-3 w-3 flex-shrink-0 border border-gray-300" style={{ background: CONDITION_COLORS[c.value] }} />
          {c.label}
        </button>
      ))}
      <div className="border-t border-gray-100 mt-1 pt-1">
        <button onClick={onClose} className="text-[10px] text-gray-400 hover:text-black w-full text-left px-1">Close</button>
      </div>
    </div>
  )
}

function StatusPicker({ onSelect, onClose }) {
  return (
    <div className="absolute z-30 bg-white border border-gray-200 shadow-lg p-3 space-y-1" style={{ minWidth: 150 }}>
      <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-2">Tooth Status</p>
      {TOOTH_STATUSES.map(s => (
        <button key={s.value} onClick={() => onSelect(s.value)}
          className="w-full text-left text-xs hover:bg-gray-50 px-1 py-0.5">
          {s.label}
        </button>
      ))}
      <div className="border-t border-gray-100 mt-1 pt-1">
        <button onClick={onClose} className="text-[10px] text-gray-400 hover:text-black w-full text-left px-1">Close</button>
      </div>
    </div>
  )
}

// ── Row of teeth ──────────────────────────────────────────────────────────────

function ToothRow({ teeth, chartData, toothStatus, onSurface, onStatus, arch }) {
  return (
    <div className="flex items-center gap-px">
      {teeth.map((num) => {
        const key = String(num)
        return (
          <div key={num} className="flex flex-col items-center gap-0.5" style={{ width: TOOTH_SIZE }}>
            {arch === 'upper' && (
              <span className="text-[8px] text-gray-400 leading-none">{num}</span>
            )}
            <ToothSVG
              toothNum={key}
              surfaces={chartData[key] ?? {}}
              status={toothStatus[key]}
              onSurfaceClick={onSurface}
              onStatusClick={onStatus}
            />
            {arch === 'lower' && (
              <span className="text-[8px] text-gray-400 leading-none">{num}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DentalChart({ patientId, chartData: initialChartData, toothStatus: initialToothStatus, readOnly = false }) {
  const queryClient = useQueryClient()
  const [chartData, setChartData]     = useState(initialChartData ?? {})
  const [toothStatus, setToothStatus] = useState(initialToothStatus ?? {})
  const [picker, setPicker]           = useState(null) // { tooth, surface, x, y }
  const [statusPicker, setStatusPicker] = useState(null)

  const mutation = useMutation({
    mutationFn: (patch) => clinicalApi.patchChart(patientId, patch),
    onSuccess: (res) => {
      const data = res.data
      setChartData(data.chart_data)
      setToothStatus(data.tooth_status)
      queryClient.invalidateQueries({ queryKey: ['dental-chart', patientId] })
    },
  })

  const handleSurface = (tooth, surface) => {
    if (readOnly) return
    // Find click position relative to viewport for popover
    setPicker({ tooth, surface })
    setStatusPicker(null)
  }

  const handleStatus = (tooth) => {
    if (readOnly) return
    setStatusPicker({ tooth })
    setPicker(null)
  }

  const applyCondition = (condition) => {
    if (!picker) return
    const patch = {
      tooth_number: picker.tooth,
      surface: picker.surface,
      condition: condition === 'intact' ? null : condition,
    }
    // Optimistic update
    const newData = { ...chartData }
    if (condition === 'intact') {
      if (newData[picker.tooth]) {
        const { [picker.surface]: _, ...rest } = newData[picker.tooth]
        if (Object.keys(rest).length === 0) delete newData[picker.tooth]
        else newData[picker.tooth] = rest
      }
    } else {
      newData[picker.tooth] = { ...(newData[picker.tooth] ?? {}), [picker.surface]: condition }
    }
    setChartData(newData)
    setPicker(null)
    mutation.mutate(patch)
  }

  const applyStatus = (status) => {
    if (!statusPicker) return
    const patch = { tooth_number: statusPicker.tooth, surface: 'whole', condition: null, tooth_status: status }
    const newStatus = { ...toothStatus }
    if (status === 'clear') delete newStatus[statusPicker.tooth]
    else newStatus[statusPicker.tooth] = status
    setToothStatus(newStatus)
    setStatusPicker(null)
    mutation.mutate(patch)
  }

  return (
    <div className="relative select-none">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {CONDITIONS.filter(c => c.value !== 'intact').map(c => (
          <span key={c.value} className="flex items-center gap-1 text-[10px] text-gray-600">
            <span className="h-3 w-3 border border-gray-300 flex-shrink-0" style={{ background: CONDITION_COLORS[c.value] }} />
            {c.label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[10px] text-gray-400 ml-2">Right-click tooth for status (missing/implant)</span>
      </div>

      {/* Upper arch */}
      <div className="flex flex-col items-center gap-1 mb-2">
        <span className="text-[9px] uppercase tracking-widest text-gray-400">Upper (Maxillary)</span>
        <ToothRow teeth={UPPER} chartData={chartData} toothStatus={toothStatus} onSurface={handleSurface} onStatus={handleStatus} arch="upper" />
      </div>

      {/* Midline separator */}
      <div className="my-2 border-t border-dashed border-gray-200" />

      {/* Lower arch */}
      <div className="flex flex-col items-center gap-1 mt-2">
        <ToothRow teeth={LOWER} chartData={chartData} toothStatus={toothStatus} onSurface={handleSurface} onStatus={handleStatus} arch="lower" />
        <span className="text-[9px] uppercase tracking-widest text-gray-400">Lower (Mandibular)</span>
      </div>

      {/* Surface condition picker */}
      {picker && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setPicker(null)} />
          <div className="fixed z-30" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
            <Picker
              title={`Tooth ${picker.tooth} — ${picker.surface}`}
              onSelect={applyCondition}
              onClose={() => setPicker(null)}
            />
          </div>
        </>
      )}

      {/* Tooth status picker */}
      {statusPicker && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setStatusPicker(null)} />
          <div className="fixed z-30" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
            <StatusPicker onSelect={applyStatus} onClose={() => setStatusPicker(null)} />
          </div>
        </>
      )}

      {mutation.isPending && (
        <p className="text-[10px] text-gray-400 mt-2 text-right">Saving…</p>
      )}
    </div>
  )
}
