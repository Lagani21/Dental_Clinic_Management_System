/**
 * CR-003: Periodontal charting
 * - 6-point measurement grid per tooth
 * - Bleeding (B) and furcation (F1/F2/F3) toggle per point
 * - Trend graph across exams using Recharts
 * - New exam creation form
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { format, parseISO } from 'date-fns'
import { Plus, TrendingUp, X } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { clinicalApi } from '../../services/api'

// Upper teeth in FDI display order (right to left from patient's view)
const UPPER_TEETH = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28]
const LOWER_TEETH = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]
// 6 probe points: buccal side (db, b, mb) then lingual side (dl, l, ml)
const POINTS = ['db','b','mb','dl','l','ml']
const POINT_LABELS = { db:'DB', b:'B', mb:'MB', dl:'DL', l:'L', ml:'ML' }

const DEPTH_COLORS = { normal: '#22c55e', mild: '#f59e0b', moderate: '#f97316', severe: '#ef4444' }

function depthColor(d) {
  if (!d && d !== 0) return '#e5e7eb'
  if (d <= 3) return DEPTH_COLORS.normal
  if (d <= 4) return DEPTH_COLORS.mild
  if (d <= 5) return DEPTH_COLORS.moderate
  return DEPTH_COLORS.severe
}

// ── Perio grid cell ────────────────────────────────────────────────────────────

function DepthCell({ value, bleeding, furcation, onChange, onBleedingToggle, onFurcationCycle }) {
  const hasBleed = Boolean(bleeding)
  const furcGrade = furcation ?? 0

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ width: 28 }}>
      {/* Bleeding dot */}
      <button
        type="button"
        onClick={onBleedingToggle}
        className={`w-3 h-3 rounded-full border transition-colors ${hasBleed ? 'bg-red-500 border-red-500' : 'bg-white border-gray-300 hover:border-red-300'}`}
        title="Toggle bleeding on probing"
      />

      {/* Pocket depth input */}
      <input
        type="number"
        min={0}
        max={15}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
        className="w-7 h-7 text-center text-xs border focus:outline-none focus:border-black transition-colors"
        style={{ borderColor: value != null ? depthColor(value) : '#e5e7eb', borderWidth: 2 }}
      />

      {/* Furcation grade (click to cycle 0→1→2→3→0) */}
      <button
        type="button"
        onClick={onFurcationCycle}
        className={`text-[9px] leading-none px-0.5 transition-colors ${furcGrade > 0 ? 'text-orange-600 font-bold' : 'text-gray-300 hover:text-gray-500'}`}
        title="Furcation grade (click to cycle)"
      >
        {furcGrade > 0 ? `F${furcGrade}` : 'F'}
      </button>
    </div>
  )
}

// ── Single tooth row in the grid ───────────────────────────────────────────────

function ToothRow({ toothNum, data, onChange }) {
  const depths   = data?.depths   ?? {}
  const bleeding = data?.bleeding ?? {}
  const furcation = data?.furcation ?? {}

  const setDepth = (pt, val) => onChange(toothNum, 'depths',   { ...depths,   [pt]: val })
  const toggleBle = (pt)     => onChange(toothNum, 'bleeding', { ...bleeding, [pt]: !bleeding[pt] })
  const cycleFurc = (pt)     => onChange(toothNum, 'furcation', { ...furcation, [pt]: ((furcation[pt] ?? 0) + 1) % 4 })

  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] text-gray-400 mb-0.5">{toothNum}</span>
      <div className="flex gap-px">
        {POINTS.map(pt => (
          <DepthCell
            key={pt}
            value={depths[pt]}
            bleeding={bleeding[pt]}
            furcation={furcation[pt]}
            onChange={(v) => setDepth(pt, v)}
            onBleedingToggle={() => toggleBle(pt)}
            onFurcationCycle={() => cycleFurc(pt)}
          />
        ))}
      </div>
      <div className="flex gap-px mt-0.5">
        {POINTS.map(pt => (
          <span key={pt} className="text-[7px] text-gray-400 text-center" style={{ width: 28 }}>{POINT_LABELS[pt]}</span>
        ))}
      </div>
    </div>
  )
}

// ── New exam form ──────────────────────────────────────────────────────────────

function NewExamForm({ patientId, onDone }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit } = useForm({
    defaultValues: { exam_date: format(new Date(), 'yyyy-MM-dd') },
  })

  // Local state: { [toothNum]: { depths: {db:2,...}, bleeding: {b: true,...}, furcation: {db: 1,...} } }
  const [toothData, setToothData] = useState({})
  const allTeeth = [...UPPER_TEETH, ...LOWER_TEETH]

  const setTooth = (toothNum, field, val) => {
    setToothData(prev => ({
      ...prev,
      [toothNum]: { ...(prev[toothNum] ?? {}), [field]: val },
    }))
  }

  const mutation = useMutation({
    mutationFn: (data) => clinicalApi.createPerio(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perio-exams', patientId] })
      onDone()
    },
  })

  const onSubmit = (formData) => {
    const measurements = allTeeth
      .filter(n => toothData[n])
      .map(n => {
        const td = toothData[n] ?? {}
        return {
          tooth_number: n,
          db: td.depths?.db ?? null,
          b:  td.depths?.b  ?? null,
          mb: td.depths?.mb ?? null,
          dl: td.depths?.dl ?? null,
          l:  td.depths?.l  ?? null,
          ml: td.depths?.ml ?? null,
          bleeding:  td.bleeding  ?? {},
          furcation: td.furcation ?? {},
        }
      })

    mutation.mutate({ ...formData, measurements })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">New Periodontal Exam</p>
        <div className="flex items-center gap-3">
          <input type="date" className="border border-gray-200 px-2 py-1 text-xs focus:outline-none" {...register('exam_date')} />
          <button type="button" onClick={onDone} className="text-gray-400 hover:text-black"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px]">
        {Object.entries(DEPTH_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm" style={{ background: c }} />
            {k === 'normal' ? '≤3mm' : k === 'mild' ? '4mm' : k === 'moderate' ? '5mm' : '≥6mm'}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <span className="h-3 w-3 rounded-full bg-red-500" /> Bleeding
        </span>
        <span className="text-gray-400 ml-2">F = furcation grade (click to set)</span>
      </div>

      {/* Upper arch */}
      <div>
        <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-2 text-center">Upper</p>
        <div className="overflow-x-auto">
          <div className="flex gap-1 pb-1">
            {UPPER_TEETH.map(n => (
              <ToothRow key={n} toothNum={n} data={toothData[n]} onChange={setTooth} />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-200" />

      {/* Lower arch */}
      <div>
        <div className="overflow-x-auto">
          <div className="flex gap-1 pb-1">
            {LOWER_TEETH.map(n => (
              <ToothRow key={n} toothNum={n} data={toothData[n]} onChange={setTooth} />
            ))}
          </div>
        </div>
        <p className="text-[9px] uppercase tracking-widest text-gray-400 mt-2 text-center">Lower</p>
      </div>

      {mutation.isError && <p className="text-[10px] text-red-500">Save failed</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={mutation.isPending}
          className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
          {mutation.isPending ? 'Saving…' : 'Save Exam'}
        </button>
      </div>
    </form>
  )
}

// ── Trend graph ────────────────────────────────────────────────────────────────

function TrendGraph({ exams }) {
  if (exams.length < 2) {
    return <p className="text-xs text-gray-400">Trend available after 2 or more exams.</p>
  }

  // Build per-tooth average depth over time
  const allTeethInExams = [...new Set(exams.flatMap(e => e.measurements.map(m => m.tooth_number)))]
    .sort((a, b) => a - b)
    .slice(0, 8) // show first 8 for legibility

  const chartData = exams.map(exam => {
    const point = { date: format(parseISO(String(exam.exam_date)), 'dd MMM') }
    exam.measurements.forEach(m => {
      const depths = [m.db, m.b, m.mb, m.dl, m.l, m.ml].filter(v => v != null)
      if (depths.length) point[`t${m.tooth_number}`] = parseFloat((depths.reduce((a,b) => a+b, 0) / depths.length).toFixed(1))
    })
    return point
  })

  const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-400">Average Pocket Depth Trend (mm)</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} unit="mm" />
          <Tooltip formatter={(v) => [`${v}mm`]} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          <ReferenceLine y={3.5} stroke="#22c55e" strokeDasharray="4 2" label={{ value:'3.5', position:'right', fontSize:9 }} />
          {allTeethInExams.map((t, i) => (
            <Line key={t} type="monotone" dataKey={`t${t}`} name={`T${t}`} stroke={COLORS[i % COLORS.length]} dot strokeWidth={1.5} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Exam summary row ───────────────────────────────────────────────────────────

function ExamRow({ exam }) {
  const [open, setOpen] = useState(false)
  const totalBleed = exam.measurements.reduce((acc, m) =>
    acc + Object.values(m.bleeding ?? {}).filter(Boolean).length, 0)
  const totalSites = exam.measurements.length * 6
  const bleedPct = totalSites > 0 ? Math.round((totalBleed / totalSites) * 100) : 0

  const maxDepth = exam.measurements.flatMap(m =>
    [m.db, m.b, m.mb, m.dl, m.l, m.ml].filter(v => v != null)
  ).reduce((max, v) => Math.max(max, v), 0)

  return (
    <div className="border border-gray-200">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
        <div className="text-left">
          <p className="text-sm font-bold text-black">{format(parseISO(String(exam.exam_date)), 'dd MMM yyyy')}</p>
          <p className="text-[10px] text-gray-400">{exam.doctor_name} · {exam.measurements.length} teeth recorded</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className={`font-medium ${bleedPct > 25 ? 'text-red-500' : 'text-green-600'}`}>BOP {bleedPct}%</span>
          <span className={`font-medium ${maxDepth >= 6 ? 'text-red-500' : maxDepth >= 4 ? 'text-orange-500' : 'text-green-600'}`}>Max {maxDepth}mm</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 overflow-x-auto">
          <div className="flex gap-1">
            {exam.measurements.map(m => {
              const avg = [m.db, m.b, m.mb, m.dl, m.l, m.ml].filter(v => v != null)
              const avgDepth = avg.length ? (avg.reduce((a,b)=>a+b,0)/avg.length).toFixed(1) : '—'
              const bleed = Object.values(m.bleeding ?? {}).some(Boolean)
              return (
                <div key={m.id} className="flex flex-col items-center gap-0.5" style={{ width: 36 }}>
                  <span className="text-[9px] text-gray-400">{m.tooth_number}</span>
                  <div className="text-xs font-bold text-center" style={{ color: depthColor(parseFloat(avgDepth)) }}>{avgDepth}</div>
                  {bleed && <div className="w-2 h-2 rounded-full bg-red-400" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function PerioChart({ patientId }) {
  const [creating, setCreating] = useState(false)
  const [showTrend, setShowTrend] = useState(false)

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['perio-exams', patientId],
    queryFn: () => clinicalApi.listPerio(patientId),
    select: (r) => r.data,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{exams.length} exam{exams.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          {exams.length >= 2 && (
            <button
              onClick={() => setShowTrend(t => !t)}
              className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider border px-3 py-2 transition-colors ${showTrend ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-500 hover:border-black hover:text-black'}`}
            >
              <TrendingUp className="h-3.5 w-3.5" /> Trend
            </button>
          )}
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold border border-black text-black px-3 py-2 hover:bg-black hover:text-white transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New Exam
            </button>
          )}
        </div>
      </div>

      {showTrend && <div className="border border-gray-200 p-4"><TrendGraph exams={exams} /></div>}

      {creating && (
        <div className="border border-black p-4">
          <NewExamForm patientId={patientId} onDone={() => setCreating(false)} />
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading exams…</p>
      ) : exams.length === 0 && !creating ? (
        <p className="text-xs text-gray-400">No periodontal exams recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {exams.map(exam => <ExamRow key={exam.id} exam={exam} />)}
        </div>
      )}
    </div>
  )
}
