/**
 * CR-002: SOAP clinical notes
 * - SOAP template with autosave
 * - Voice-to-text via Web Speech API (where available)
 * - Notes auto-lock after 24h; locked notes require amend_reason to edit
 */
import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { Plus, Lock, Unlock, Mic, MicOff, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { clinicalApi } from '../../services/api'

const SOAP_FIELDS = [
  { key: 'chief_complaint', label: 'S — Subjective (Chief Complaint)', placeholder: "Patient's own description of symptoms…" },
  { key: 'examination',     label: 'O — Objective (Examination Findings)', placeholder: 'Clinical observations, radiograph findings…' },
  { key: 'assessment',      label: 'A — Assessment / Diagnosis', placeholder: 'Diagnosis, differential diagnosis…' },
  { key: 'plan',            label: 'P — Treatment Plan', placeholder: 'Planned procedures, referrals, follow-up…' },
  { key: 'procedures_done', label: 'Procedures Performed', placeholder: 'What was done this visit…' },
]

// ── Voice input hook ───────────────────────────────────────────────────────────

function useVoice(onResult) {
  const recRef = useRef(null)
  const [listening, setListening] = useState(false)
  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = useCallback((fieldKey) => {
    if (!supported) return
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-IN'
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ')
      onResult(fieldKey, transcript)
    }
    rec.onend = () => setListening(false)
    rec.start()
    recRef.current = rec
    setListening(true)
  }, [supported, onResult])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}

// ── Single note editor ─────────────────────────────────────────────────────────

function NoteEditor({ note, patientId, onSaved }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [amendReason, setAmendReason] = useState('')
  const [voiceTarget, setVoiceTarget] = useState(null)
  const { register, handleSubmit, setValue, getValues, formState: { isDirty } } = useForm({
    defaultValues: {
      chief_complaint: note.chief_complaint ?? '',
      examination:     note.examination ?? '',
      assessment:      note.assessment ?? '',
      plan:            note.plan ?? '',
      procedures_done: note.procedures_done ?? '',
    },
  })

  const onVoiceResult = useCallback((fieldKey, transcript) => {
    const current = getValues(fieldKey)
    setValue(fieldKey, current ? `${current} ${transcript}` : transcript, { shouldDirty: true })
  }, [getValues, setValue])

  const { listening, supported, start, stop } = useVoice(onVoiceResult)

  const mutation = useMutation({
    mutationFn: (data) => clinicalApi.updateNote(patientId, note.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-notes', patientId] })
      setAmendReason('')
      onSaved?.()
    },
  })

  const onSubmit = (data) => {
    const payload = { ...data }
    if (note.is_locked) {
      if (!amendReason.trim()) return
      payload.amend_reason = amendReason.trim()
    }
    mutation.mutate(payload)
  }

  const toggleVoice = (fieldKey) => {
    if (listening && voiceTarget === fieldKey) {
      stop()
      setVoiceTarget(null)
    } else {
      stop()
      setVoiceTarget(fieldKey)
      start(fieldKey)
    }
  }

  return (
    <div className="border border-gray-200">
      {/* Note header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {note.is_locked
            ? <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            : <Unlock className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
          }
          <div className="text-left">
            <p className="text-sm font-bold text-black">
              {format(parseISO(String(note.visit_date)), 'dd MMM yyyy')}
            </p>
            <p className="text-[10px] text-gray-400">
              {note.doctor_name ?? 'Unknown'} ·{' '}
              {note.is_locked
                ? 'Locked'
                : `Editable for ${formatDistanceToNow(new Date(note.created_at), { addSuffix: false })}`
              }
              {note.amendments.length > 0 && ` · ${note.amendments.length} amendment${note.amendments.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {note.chief_complaint && (
            <p className="text-xs text-gray-500 max-w-[200px] truncate hidden sm:block">{note.chief_complaint}</p>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded form */}
      {expanded && (
        <form onSubmit={handleSubmit(onSubmit)} className="border-t border-gray-100 px-4 py-4 space-y-4">
          {SOAP_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</label>
                {supported && (
                  <button
                    type="button"
                    onClick={() => toggleVoice(key)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 border transition-colors ${
                      listening && voiceTarget === key
                        ? 'border-red-400 text-red-500 bg-red-50'
                        : 'border-gray-200 text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    {listening && voiceTarget === key
                      ? <><MicOff className="h-3 w-3" /> Stop</>
                      : <><Mic className="h-3 w-3" /> Voice</>
                    }
                  </button>
                )}
              </div>
              <textarea
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
                rows={3}
                placeholder={placeholder}
                readOnly={note.is_locked && !amendReason}
                {...register(key)}
              />
            </div>
          ))}

          {/* Amendment reason (shown when locked) */}
          {note.is_locked && (
            <div className="border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                This note is locked. Provide an amendment reason to edit.
              </p>
              <input
                className="w-full border border-amber-300 bg-white px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                placeholder="Reason for amendment…"
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
              />
            </div>
          )}

          {/* Amendment history */}
          {note.amendments.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Amendment History</p>
              {note.amendments.map(a => (
                <div key={a.id} className="text-xs text-gray-500 border-l-2 border-gray-200 pl-2">
                  <span className="font-medium text-gray-700">{a.amended_by_name ?? 'Unknown'}</span>
                  {' · '}{format(parseISO(a.created_at), 'dd MMM yyyy HH:mm')}
                  {' · '}<span className="italic">{a.reason}</span>
                </div>
              ))}
            </div>
          )}

          {mutation.isError && (
            <p className="text-[10px] text-red-500">
              {mutation.error?.response?.data?.detail ?? 'Save failed'}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending || (note.is_locked && !amendReason.trim())}
              className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
            >
              {mutation.isPending ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── New note form ──────────────────────────────────────────────────────────────

function NewNoteForm({ patientId, onDone }) {
  const queryClient = useQueryClient()
  const [voiceTarget, setVoiceTarget] = useState(null)
  const { register, handleSubmit, setValue, getValues, reset } = useForm({
    defaultValues: { visit_date: format(new Date(), 'yyyy-MM-dd') },
  })

  const onVoiceResult = useCallback((fieldKey, transcript) => {
    const current = getValues(fieldKey)
    setValue(fieldKey, current ? `${current} ${transcript}` : transcript)
  }, [getValues, setValue])

  const { listening, supported, start, stop } = useVoice(onVoiceResult)

  const mutation = useMutation({
    mutationFn: (data) => clinicalApi.createNote(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-notes', patientId] })
      reset()
      onDone()
    },
  })

  const toggleVoice = (fieldKey) => {
    if (listening && voiceTarget === fieldKey) { stop(); setVoiceTarget(null) }
    else { stop(); setVoiceTarget(fieldKey); start(fieldKey) }
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="border border-black p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">New Clinical Note</p>
        <input type="date" className="border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none" {...register('visit_date', { required: true })} />
      </div>

      {SOAP_FIELDS.map(({ key, label, placeholder }) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] uppercase tracking-wider text-gray-500">{label}</label>
            {supported && (
              <button type="button" onClick={() => toggleVoice(key)}
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 border transition-colors ${listening && voiceTarget === key ? 'border-red-400 text-red-500 bg-red-50' : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}>
                {listening && voiceTarget === key ? <><MicOff className="h-3 w-3" /> Stop</> : <><Mic className="h-3 w-3" /> Voice</>}
              </button>
            )}
          </div>
          <textarea
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
            rows={2}
            placeholder={placeholder}
            {...register(key)}
          />
        </div>
      ))}

      {mutation.isError && <p className="text-[10px] text-red-500">{mutation.error?.response?.data?.detail ?? 'Save failed'}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
          {mutation.isPending ? 'Saving…' : 'Save Note'}
        </button>
      </div>
    </form>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function ClinicalNotes({ patientId }) {
  const [creating, setCreating] = useState(false)

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['clinical-notes', patientId],
    queryFn: () => clinicalApi.listNotes(patientId),
    select: (r) => r.data,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold border border-black text-black px-3 py-2 hover:bg-black hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New Note
          </button>
        )}
      </div>

      {creating && <NewNoteForm patientId={patientId} onDone={() => setCreating(false)} />}

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading notes…</p>
      ) : notes.length === 0 && !creating ? (
        <p className="text-xs text-gray-400">No clinical notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <NoteEditor key={note.id} note={note} patientId={patientId} />
          ))}
        </div>
      )}
    </div>
  )
}
