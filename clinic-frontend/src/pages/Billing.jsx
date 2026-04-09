/**
 * BL-001: Itemized bill with CDT codes / GST, PDF export, thermal / A4 print
 * BL-003: Email / SMS invoice with payment link, status tracking, re-send
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, Download, Printer, Mail, MessageSquare, CheckCircle, XCircle } from 'lucide-react'
import { billingApi, patientsApi, appointmentsApi } from '../services/api'

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  draft:           'border-gray-400 text-gray-500',
  sent:            'border-blue-500 text-blue-600',
  paid:            'border-green-600 text-green-700',
  partially_paid:  'border-yellow-500 text-yellow-600',
  overdue:         'border-red-500 text-red-600',
  cancelled:       'border-gray-300 text-gray-400',
}

const STATUS_LABELS = {
  draft:          'DRAFT',
  sent:           'SENT',
  paid:           'PAID',
  partially_paid: 'PART. PAID',
  overdue:        'OVERDUE',
  cancelled:      'CANCELLED',
}

const PAYMENT_METHODS = [
  { value: 'cash',       label: 'Cash' },
  { value: 'upi',        label: 'UPI' },
  { value: 'card',       label: 'Card' },
  { value: 'netbanking', label: 'Net Banking' },
  { value: 'cheque',     label: 'Cheque' },
  { value: 'insurance',  label: 'Insurance' },
]

// Common dental CDT codes (SAC 999311 for dental services in India)
const QUICK_ITEMS = [
  { description: 'Consultation', hsn_sac_code: '999311', unit_price: 500,  cgst_rate: 0, sgst_rate: 0 },
  { description: 'Scaling & Polishing', hsn_sac_code: '999311', unit_price: 1200, cgst_rate: 9, sgst_rate: 9 },
  { description: 'Tooth Extraction (Simple)', hsn_sac_code: '999311', unit_price: 800, cgst_rate: 0, sgst_rate: 0 },
  { description: 'Root Canal Treatment (Single Canal)', hsn_sac_code: '999311', unit_price: 3500, cgst_rate: 9, sgst_rate: 9 },
  { description: 'Composite Filling', hsn_sac_code: '999311', unit_price: 1500, cgst_rate: 9, sgst_rate: 9 },
  { description: 'Dental Crown (PFM)', hsn_sac_code: '999311', unit_price: 8000, cgst_rate: 9, sgst_rate: 9 },
  { description: 'Dental Implant', hsn_sac_code: '999311', unit_price: 35000, cgst_rate: 9, sgst_rate: 9 },
  { description: 'Orthodontic Consultation', hsn_sac_code: '999311', unit_price: 1000, cgst_rate: 0, sgst_rate: 0 },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n) { return `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
function fmtDate(d) { return d ? format(parseISO(String(d)), 'dd MMM yyyy') : '—' }

function calcLine(item) {
  const base  = (item.unit_price ?? 0) * (item.quantity ?? 1)
  const cgst  = base * ((item.cgst_rate ?? 0) / 100)
  const sgst  = base * ((item.sgst_rate ?? 0) / 100)
  const igst  = base * ((item.igst_rate ?? 0) / 100)
  return { base, cgst, sgst, igst, total: base + cgst + sgst + igst }
}

// ── InvoiceList ────────────────────────────────────────────────────────────────

function InvoiceList({ selectedId, onSelect, onNew }) {
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn:  () => billingApi.list({ status: statusFilter || undefined, page_size: 100 }),
    select:   (r) => r.data?.items ?? [],
  })

  const invoices = useMemo(() => {
    if (!q) return data ?? []
    const lq = q.toLowerCase()
    return (data ?? []).filter(
      (i) => i.invoice_number.toLowerCase().includes(lq) ||
             (i.patient_name ?? '').toLowerCase().includes(lq)
    )
  }, [data, q])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black">Billing</p>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold border border-black text-black px-3 py-2 hover:bg-black hover:text-white transition-colors"
        >
          <Plus className="h-3 w-3" /> New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 border-b border-gray-100">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search invoice or patient…"
          className="flex-1 border border-gray-200 px-3 py-1.5 text-xs focus:border-black focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-black focus:outline-none"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-[10px] uppercase tracking-widest text-gray-300">No invoices found</p>
          </div>
        ) : invoices.map((inv) => (
          <div
            key={inv.id}
            onClick={() => onSelect(inv.id)}
            className={`px-6 py-4 cursor-pointer transition-colors hover:bg-gray-50 ${
              selectedId === inv.id ? 'bg-gray-50 border-l-2 border-l-black' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-black">{inv.invoice_number}</p>
              <span className={`text-[9px] font-medium tracking-wider border px-1.5 py-0.5 ${STATUS_STYLES[inv.status]}`}>
                {STATUS_LABELS[inv.status]}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-0.5">{inv.patient_name ?? '—'}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-gray-400">{fmtDate(inv.invoice_date)}</p>
              <p className="text-xs font-bold text-black">{fmt(inv.total_amount)}</p>
            </div>
            {inv.amount_due > 0 && inv.status !== 'draft' && (
              <p className="text-[9px] text-red-500 mt-0.5">Due: {fmt(inv.amount_due)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── InvoiceDetail ──────────────────────────────────────────────────────────────

function InvoiceDetail({ invoiceId, onClose }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState('view') // 'view' | 'payment' | 'send'
  const [printFormat, setPrintFormat] = useState('a4')

  const { data: inv, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn:  () => billingApi.get(invoiceId),
    select:   (r) => r.data,
    enabled:  !!invoiceId,
  })

  // Payment form
  const payForm = useForm({ defaultValues: { amount_paid: '', payment_method: 'cash', payment_reference: '' } })
  const payMutation = useMutation({
    mutationFn: (data) => billingApi.recordPayment(invoiceId, { ...data, amount_paid: parseFloat(data.amount_paid) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      setMode('view')
      payForm.reset()
    },
  })

  // Send form
  const sendForm = useForm({ defaultValues: { channel: 'email', email: '', phone: '' } })
  const sendMutation = useMutation({
    mutationFn: (data) => billingApi.send(invoiceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      setMode('view')
    },
  })

  if (!invoiceId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[9px] uppercase tracking-[0.2em] text-gray-300">Select an invoice</p>
      </div>
    )
  }

  if (isLoading || !inv) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
      </div>
    )
  }

  const isTerminal = inv.status === 'paid' || inv.status === 'cancelled'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-black">{inv.invoice_number}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{inv.patient_name} · {fmtDate(inv.invoice_date)}</p>
        </div>
        <span className={`text-[9px] font-medium tracking-wider border px-2 py-0.5 ${STATUS_STYLES[inv.status]}`}>
          {STATUS_LABELS[inv.status]}
        </span>
      </div>

      {mode === 'payment' ? (
        /* ── Record Payment ────────────────────────────────────── */
        <form onSubmit={payForm.handleSubmit((d) => payMutation.mutate(d))}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-black">Record Payment</p>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Amount (₹)</label>
            <input type="number" step="0.01" min="0.01" required
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              placeholder={`Max ${fmt(inv.amount_due)}`}
              {...payForm.register('amount_paid', { required: true, min: 0.01 })} />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Payment Method</label>
            <select className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
              {...payForm.register('payment_method')}>
              {PAYMENT_METHODS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Reference / UPI ID</label>
            <input className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              placeholder="Transaction ID, cheque no, etc."
              {...payForm.register('payment_reference')} />
          </div>
          {payMutation.isError && <p className="text-[10px] text-red-500">{payMutation.error?.response?.data?.detail ?? 'Failed'}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setMode('view')}
              className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={payMutation.isPending}
              className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
              {payMutation.isPending ? 'Saving…' : 'Confirm Payment'}
            </button>
          </div>
        </form>

      ) : mode === 'send' ? (
        /* ── Send Invoice ──────────────────────────────────────── */
        <form onSubmit={sendForm.handleSubmit((d) => sendMutation.mutate(d))}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-black">Send Invoice</p>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Channel</label>
            <select className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
              {...sendForm.register('channel')}>
              <option value="email">Email only</option>
              <option value="sms">SMS only</option>
              <option value="both">Email + SMS</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">
              Email <span className="text-gray-300">(leave blank to use patient's email)</span>
            </label>
            <input type="email"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              placeholder={inv.patient_email ?? 'patient@email.com'}
              {...sendForm.register('email')} />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">
              Mobile <span className="text-gray-300">(leave blank to use patient's phone)</span>
            </label>
            <input
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              placeholder={inv.patient_phone ?? '9876543210'}
              {...sendForm.register('phone')} />
          </div>
          {sendMutation.isError && (
            <p className="text-[10px] text-red-500">{sendMutation.error?.response?.data?.detail ?? 'Send failed'}</p>
          )}
          {sendMutation.isSuccess && (
            <p className="text-[10px] text-green-600">Invoice sent successfully.</p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setMode('view')}
              className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={sendMutation.isPending}
              className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
              {sendMutation.isPending ? 'Sending…' : 'Send Now'}
            </button>
          </div>
        </form>

      ) : (
        /* ── View mode ─────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto">
          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50">
            {/* Print */}
            <div className="flex items-center gap-1">
              <select
                value={printFormat}
                onChange={(e) => setPrintFormat(e.target.value)}
                className="border border-gray-200 text-[10px] px-1.5 py-1 bg-white focus:outline-none"
              >
                <option value="a4">A4</option>
                <option value="thermal">Thermal 80mm</option>
              </select>
              <button
                onClick={() => window.open(billingApi.pdfUrl(invoiceId, printFormat), '_blank')}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider border border-gray-300 text-gray-600 px-2 py-1 hover:border-black hover:text-black transition-colors"
              >
                <Printer className="h-3 w-3" /> Print
              </button>
            </div>

            {/* PDF Download */}
            <a
              href={billingApi.pdfUrl(invoiceId, printFormat)}
              download={`${inv.invoice_number}.pdf`}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider border border-gray-300 text-gray-600 px-2 py-1 hover:border-black hover:text-black transition-colors"
            >
              <Download className="h-3 w-3" /> PDF
            </a>

            {/* Send */}
            <button
              onClick={() => setMode('send')}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider border border-gray-300 text-gray-600 px-2 py-1 hover:border-black hover:text-black transition-colors"
            >
              <Mail className="h-3 w-3" />
              {inv.status === 'sent' || inv.status === 'paid' ? 'Re-send' : 'Send'}
            </button>

            {/* Record Payment */}
            {!isTerminal && inv.amount_due > 0 && (
              <button
                onClick={() => setMode('payment')}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold border border-black text-black px-3 py-1 hover:bg-black hover:text-white transition-colors ml-auto"
              >
                <CheckCircle className="h-3 w-3" /> Record Payment
              </button>
            )}
          </div>

          {/* Patient + Doctor */}
          <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
            <div className="px-6 py-4">
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Patient</p>
              <p className="text-sm font-bold text-black">{inv.patient_name ?? '—'}</p>
              {inv.patient_phone && <p className="text-[10px] text-gray-500 mt-0.5">{inv.patient_phone}</p>}
              {inv.patient_email && <p className="text-[10px] text-gray-400">{inv.patient_email}</p>}
            </div>
            <div className="px-6 py-4">
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Doctor</p>
              <p className="text-sm font-bold text-black">{inv.doctor_name ?? '—'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(inv.invoice_date)}</p>
            </div>
          </div>

          {/* Line items */}
          <div className="px-6 py-4">
            <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-3">Line Items</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-500 text-[10px] uppercase tracking-wider">Description</th>
                  <th className="text-right py-2 font-medium text-gray-500 text-[10px] uppercase tracking-wider w-10">Qty</th>
                  <th className="text-right py-2 font-medium text-gray-500 text-[10px] uppercase tracking-wider w-20">Rate</th>
                  <th className="text-right py-2 font-medium text-gray-500 text-[10px] uppercase tracking-wider w-16">GST</th>
                  <th className="text-right py-2 font-medium text-gray-500 text-[10px] uppercase tracking-wider w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(inv.items ?? []).map((item) => {
                  const gstPct = (item.cgst_rate ?? 0) + (item.sgst_rate ?? 0) + (item.igst_rate ?? 0)
                  return (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-black">{item.description}</p>
                        {item.hsn_sac_code && <p className="text-[9px] text-gray-400">HSN/SAC: {item.hsn_sac_code}</p>}
                      </td>
                      <td className="py-2.5 text-right text-gray-600">{item.quantity}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(item.unit_price)}</td>
                      <td className="py-2.5 text-right text-gray-500">{gstPct > 0 ? `${gstPct}%` : '—'}</td>
                      <td className="py-2.5 text-right font-bold text-black">{fmt(item.line_total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="ml-auto max-w-[240px] space-y-1.5">
              <TotalRow label="Subtotal" value={fmt(inv.subtotal)} />
              {inv.discount_amount > 0 && <TotalRow label={`Discount${inv.discount_percent > 0 ? ` (${inv.discount_percent}%)` : ''}`} value={`− ${fmt(inv.discount_amount)}`} />}
              {inv.cgst_amount > 0 && <TotalRow label="CGST" value={fmt(inv.cgst_amount)} />}
              {inv.sgst_amount > 0 && <TotalRow label="SGST" value={fmt(inv.sgst_amount)} />}
              {inv.igst_amount > 0 && <TotalRow label="IGST" value={fmt(inv.igst_amount)} />}
              <div className="border-t border-black pt-1.5">
                <TotalRow label="Total" value={fmt(inv.total_amount)} bold />
              </div>
              <TotalRow label="Amount Paid" value={fmt(inv.amount_paid)} />
              <div className="border-t border-gray-300 pt-1.5">
                <TotalRow label="Balance Due" value={fmt(inv.amount_due)} bold className="text-red-600" />
              </div>
            </div>
          </div>

          {inv.notes && (
            <div className="px-6 pb-4">
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-1">Notes</p>
              <p className="text-xs text-gray-600">{inv.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TotalRow({ label, value, bold, className }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[10px] uppercase tracking-wider text-gray-500 ${bold ? 'font-bold text-black' : ''}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-black' : 'text-gray-700'} ${className ?? ''}`}>{value}</span>
    </div>
  )
}

// ── NewInvoiceModal ────────────────────────────────────────────────────────────

function NewInvoiceModal({ onClose, onCreated }) {
  const queryClient = useQueryClient()
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      patient_id:  '',
      doctor_id:   '',
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
      discount_percent: 0,
      discount_amount: 0,
      notes: '',
      items: [{ description: '', hsn_sac_code: '999311', quantity: 1, unit_price: '', cgst_rate: 9, sgst_rate: 9, igst_rate: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const watchItems   = watch('items')
  const watchDiscPct = parseFloat(watch('discount_percent') || 0)
  const watchDiscAmt = parseFloat(watch('discount_amount') || 0)

  const totals = useMemo(() => {
    const subtotal = watchItems.reduce((acc, i) => acc + calcLine(i).total, 0)
    const disc = watchDiscPct > 0 ? subtotal * watchDiscPct / 100 : watchDiscAmt
    const taxed = watchItems.reduce((acc, i) => {
      const l = calcLine(i)
      return { cgst: acc.cgst + l.cgst, sgst: acc.sgst + l.sgst, igst: acc.igst + l.igst }
    }, { cgst: 0, sgst: 0, igst: 0 })
    return { subtotal, disc, ...taxed, total: subtotal - disc }
  }, [watchItems, watchDiscPct, watchDiscAmt])

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => patientsApi.list({ page_size: 200 }),
    select: (r) => r.data?.items ?? [],
  })

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: () => appointmentsApi.doctors(),
    select: (r) => r.data ?? [],
  })

  const mutation = useMutation({
    mutationFn: (data) => billingApi.create({
      ...data,
      items: data.items.map((i) => ({
        ...i,
        quantity: parseInt(i.quantity) || 1,
        unit_price: parseFloat(i.unit_price) || 0,
        cgst_rate: parseFloat(i.cgst_rate) || 0,
        sgst_rate: parseFloat(i.sgst_rate) || 0,
        igst_rate: parseFloat(i.igst_rate) || 0,
      })),
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      onCreated(res.data.id)
    },
  })

  const addQuickItem = (quick) => {
    append({ ...quick, quantity: 1 })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Modal header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-black">New Invoice</p>
          <button onClick={onClose} className="text-gray-400 hover:text-black transition-colors">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Patient + Doctor + Date */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Patient *</label>
                <select required className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
                  {...register('patient_id', { required: true })}>
                  <option value="">Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Doctor *</label>
                <select required className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none bg-white"
                  {...register('doctor_id', { required: true })}>
                  <option value="">Select doctor…</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name ?? d.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Invoice Date *</label>
                <input type="date" required className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  {...register('invoice_date', { required: true })} />
              </div>
            </div>

            {/* Quick-add items */}
            <div>
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mb-2">Quick Add</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ITEMS.map((qi) => (
                  <button key={qi.description} type="button" onClick={() => addQuickItem(qi)}
                    className="text-[9px] border border-gray-200 px-2 py-1 hover:border-black transition-colors">
                    {qi.description}
                  </button>
                ))}
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400">Line Items</p>
                <button type="button"
                  onClick={() => append({ description: '', hsn_sac_code: '999311', quantity: 1, unit_price: '', cgst_rate: 9, sgst_rate: 9, igst_rate: 0 })}
                  className="flex items-center gap-1 text-[10px] text-gray-500 border border-gray-200 px-2 py-1 hover:border-black transition-colors">
                  <Plus className="h-3 w-3" /> Add Row
                </button>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Description', 'HSN/SAC', 'Qty', 'Rate (₹)', 'CGST%', 'SGST%', 'Total', ''].map((h) => (
                      <th key={h} className="text-left py-2 text-[9px] font-medium text-gray-400 uppercase tracking-wider pr-2 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, idx) => {
                    const line = calcLine(watchItems[idx] ?? {})
                    return (
                      <tr key={field.id} className="border-b border-gray-100">
                        <td className="py-1.5 pr-2">
                          <input className="w-full border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none"
                            placeholder="Service / procedure"
                            {...register(`items.${idx}.description`, { required: true })} />
                        </td>
                        <td className="py-1.5 pr-2 w-20">
                          <input className="w-full border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none"
                            placeholder="999311"
                            {...register(`items.${idx}.hsn_sac_code`)} />
                        </td>
                        <td className="py-1.5 pr-2 w-12">
                          <input type="number" min="1" className="w-full border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none"
                            {...register(`items.${idx}.quantity`, { min: 1 })} />
                        </td>
                        <td className="py-1.5 pr-2 w-24">
                          <input type="number" min="0" step="0.01" className="w-full border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none"
                            placeholder="0.00"
                            {...register(`items.${idx}.unit_price`, { min: 0 })} />
                        </td>
                        <td className="py-1.5 pr-2 w-14">
                          <input type="number" min="0" max="28" step="0.5" className="w-full border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none"
                            {...register(`items.${idx}.cgst_rate`, { min: 0 })} />
                        </td>
                        <td className="py-1.5 pr-2 w-14">
                          <input type="number" min="0" max="28" step="0.5" className="w-full border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none"
                            {...register(`items.${idx}.sgst_rate`, { min: 0 })} />
                        </td>
                        <td className="py-1.5 pr-2 w-20 text-xs font-bold text-black text-right">
                          {fmt(line.total)}
                        </td>
                        <td className="py-1.5 w-6">
                          {fields.length > 1 && (
                            <button type="button" onClick={() => remove(idx)}
                              className="text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Discount + Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Discount (%)</label>
                <input type="number" min="0" max="100" step="0.5"
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  {...register('discount_percent', { min: 0, max: 100 })} />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-gray-400 block mb-1">Notes</label>
                <input className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  placeholder="Optional remarks…"
                  {...register('notes')} />
              </div>
            </div>

            {/* Live totals preview */}
            <div className="border border-gray-200 p-4 bg-gray-50">
              <div className="max-w-[260px] ml-auto space-y-1">
                <TotalRow label="Subtotal" value={fmt(totals.subtotal)} />
                {totals.disc > 0 && <TotalRow label="Discount" value={`− ${fmt(totals.disc)}`} />}
                {totals.cgst > 0 && <TotalRow label="CGST" value={fmt(totals.cgst)} />}
                {totals.sgst > 0 && <TotalRow label="SGST" value={fmt(totals.sgst)} />}
                <div className="border-t border-black pt-1"><TotalRow label="Total" value={fmt(totals.total)} bold /></div>
              </div>
            </div>
          </div>

          {/* Footer */}
          {mutation.isError && (
            <div className="px-6 py-2 bg-red-50 border-t border-red-100">
              <p className="text-[10px] text-red-600">{mutation.error?.response?.data?.detail ?? 'Failed to create invoice'}</p>
            </div>
          )}
          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="text-[10px] uppercase tracking-wider text-gray-500 border border-gray-300 px-4 py-2 hover:border-black transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="text-[10px] uppercase tracking-wider font-bold border border-black text-black px-5 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40">
              {mutation.isPending ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Billing (main) ─────────────────────────────────────────────────────────────

export default function Billing() {
  const [selectedId, setSelectedId] = useState(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: invoice list */}
      <div className="flex flex-col overflow-hidden border-r border-gray-200" style={{ width: '38%' }}>
        <InvoiceList
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNew={() => setShowNew(true)}
        />
      </div>

      {/* Right: invoice detail */}
      <div className="flex flex-col overflow-hidden" style={{ width: '62%' }}>
        <InvoiceDetail invoiceId={selectedId} onClose={() => setSelectedId(null)} />
      </div>

      {showNew && (
        <NewInvoiceModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); setSelectedId(id) }}
        />
      )}
    </div>
  )
}
