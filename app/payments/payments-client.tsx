'use client'
import { useState } from 'react'
import { Plus, X, IndianRupee, Clock, ExternalLink, Loader2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MemberRef {
  id: string
  full_name: string
  initials: string
}

interface Payment {
  id: string
  amount: number
  gst_amount: number
  total_amount: number
  payment_method: string
  payment_status: string
  invoice_number: string | null
  invoice_pdf_url: string | null
  paid_at: string | null
  created_at: string
  members: any
}

interface Props {
  payments: Payment[]
  members: MemberRef[]
  collectedThisMonth: number
  pendingDues: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(name: string) {
  const colors = ['#1D9E75','#378ADD','#5B53C6','#C2587A','#E08A3C','#0F6E56']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function statusClass(status: string) {
  if (status === 'paid') return 'bg-green-50 text-green-700'
  if (status === 'pending') return 'bg-yellow-50 text-yellow-700'
  if (status === 'overdue') return 'bg-red-50 text-red-600'
  return 'bg-gray-100 text-gray-600'
}

function formatMethod(method: string) {
  const map: Record<string, string> = { upi: 'UPI', cash: 'Cash', card: 'Card', bank_transfer: 'Bank Transfer', cheque: 'Cheque' }
  return map[method] ?? method
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatINR(amount: number) {
  return '₹' + Math.round(amount).toLocaleString('en-IN')
}

type TabFilter = 'all' | 'paid' | 'pending'

// ── Invoice download / status pill ───────────────────────────────────────────
function InvoiceAction({ payment }: { payment: Payment }) {
  if (payment.invoice_pdf_url) {
    return (
      <a
        href={payment.invoice_pdf_url}
        target="_blank"
        rel="noopener noreferrer"
        title="Download invoice"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:text-brand hover:bg-brand-muted"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    )
  }
  if (payment.payment_status === 'paid' && payment.invoice_number) {
    // Payment is paid and has an invoice number assigned, but the PDF
    // hasn't come back from the FastAPI service yet (fire-and-forget).
    return (
      <span title="Invoice generating…" className="flex h-7 w-7 items-center justify-center text-ink-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    )
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PaymentsClient({ payments: initialPayments, members, collectedThisMonth, pendingDues }: Props) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [tab, setTab] = useState<TabFilter>('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Record payment form
  const [memberId, setMemberId] = useState(members[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'upi' | 'card'>('cash')
  const [notes, setNotes] = useState('')

  function resetForm() {
    setMemberId(members[0]?.id ?? ''); setAmount('')
    setMethod('cash'); setNotes(''); setError('')
  }

  function closeModal() { setShowModal(false); resetForm() }

  const filtered = payments.filter(p => {
    if (tab === 'all') return true
    return p.payment_status === tab
  })

  async function handleRecord() {
    if (!memberId) { setError('Select a member'); return }
    if (!amount || isNaN(Number(amount))) { setError('Enter a valid amount'); return }

    setSaving(true)
    setError('')
    console.log('[RecordPayment] Submitting:', { memberId, amount, method })

    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: memberId,
        amount: Number(amount),
        payment_method: method,
        notes: notes || null,
      }),
    })

    const json = await res.json()
    console.log('[RecordPayment] Response:', json)

    if (!res.ok) {
      setError(json.error ?? 'Failed to record payment')
      setSaving(false)
      return
    }

    setPayments(prev => [{ ...json.payment, invoice_pdf_url: json.payment.invoice_pdf_url ?? null }, ...prev])
    closeModal()
    setSaving(false)

    // The invoice is generated server-side, fire-and-forget. Poll once
    // after a few seconds to pick up the URL without a full page reload.
    setTimeout(() => refreshInvoiceUrl(json.payment.id), 4000)
  }

  async function refreshInvoiceUrl(paymentId: string) {
    try {
      const res = await fetch(`/api/payments/${paymentId}`)
      if (!res.ok) return
      const json = await res.json()
      if (json.payment?.invoice_pdf_url) {
        setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, invoice_pdf_url: json.payment.invoice_pdf_url } : p))
      }
    } catch {
      // Silent — owner can still refresh the page manually
    }
  }

  return (
    <>

    <main className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Payments</h1>
            <p className="mt-0.5 text-sm text-ink-muted">{payments.length} total transactions</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" /> Record payment
          </button>
        </div>

        {/* Stat cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[
            { label: 'Collected this month', value: formatINR(collectedThisMonth), icon: IndianRupee, color: 'bg-green-50 text-green-700' },
            { label: 'Pending dues', value: formatINR(pendingDues), icon: Clock, color: 'bg-yellow-50 text-yellow-700' },
            { label: 'Total payments', value: String(payments.length), icon: IndianRupee, color: 'bg-blue-50 text-blue-700' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-bg-card p-4 shadow-sm">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="text-xl font-bold text-ink">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="mb-4 flex gap-1 rounded-xl bg-bg-page p-1 w-fit">
          {(['all', 'paid', 'pending'] as TabFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                tab === t ? 'bg-bg-card text-brand shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t === 'all' ? 'All' : t === 'paid' ? 'Paid' : 'Pending'}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-bg-card overflow-hidden shadow-sm">
          {/* Header */}
          <div className="hidden grid-cols-[1fr_120px_100px_120px_80px_40px] gap-4 border-b border-border bg-bg-page px-5 py-3 lg:grid">
            {['Member', 'Amount', 'Method', 'Date', 'Status', ''].map(h => (
              <span key={h} className="text-xs font-medium uppercase tracking-wide text-ink-muted">{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <IndianRupee className="h-10 w-10 text-ink-muted mb-3" />
              <p className="text-sm font-medium text-ink">No payments found</p>
              <p className="mt-1 text-sm text-ink-muted">Record your first payment to get started</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(p => {
                const memberName = p.members?.full_name ?? 'Unknown'
                const initials = p.members?.initials ?? '?'
                return (
                  <li key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3.5 hover:bg-bg-page lg:grid-cols-[1fr_120px_100px_120px_80px_40px]">
                    {/* Member */}
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ background: avatarColor(memberName) }}
                      >
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{memberName}</p>
                        {p.invoice_number && (
                          <p className="text-xs text-ink-muted">{p.invoice_number}</p>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <span className="hidden text-sm font-semibold text-ink lg:block">
                      {formatINR(p.total_amount)}
                    </span>

                    {/* Method */}
                    <span className="hidden text-sm text-ink-secondary lg:block">
                      {formatMethod(p.payment_method)}
                    </span>

                    {/* Date */}
                    <span className="hidden text-sm text-ink-muted lg:block">
                      {formatDate(p.paid_at ?? p.created_at)}
                    </span>

                    {/* Status */}
                    <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium capitalize lg:inline-flex ${statusClass(p.payment_status)}`}>
                      {p.payment_status}
                    </span>

                    {/* Mobile: amount + status */}
                    <div className="flex items-center gap-2 lg:hidden">
                      <span className="text-sm font-semibold text-ink">{formatINR(p.total_amount)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusClass(p.payment_status)}`}>
                        {p.payment_status}
                      </span>
                    </div>

                    {/* Invoice link */}
                    <div className="hidden lg:block">
                      <InvoiceAction payment={p} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-ink">Record payment</h2>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-page">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-6">
              {/* Member */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Member *</label>
                <select
                  value={memberId}
                  onChange={e => setMemberId(e.target.value)}
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Amount (₹) *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="2950"
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30"
                />
              </div>

              {/* Method */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Payment method</label>
                <div className="flex gap-2">
                  {(['cash', 'upi', 'card'] as const).map(m => (
                    <label key={m} className="flex-1">
                      <input type="radio" value={m} checked={method === m} onChange={() => setMethod(m)} className="peer sr-only" />
                      <div className="flex cursor-pointer items-center justify-center rounded-lg border border-border py-2 text-sm font-medium text-ink-muted transition-all peer-checked:border-brand peer-checked:bg-brand-muted peer-checked:text-brand uppercase">
                        {m}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Notes (optional)</label>
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Renewal for June"
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button onClick={closeModal} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-bg-page">
                Cancel
              </button>
              <button
                onClick={handleRecord}
                disabled={saving}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
              >
                {saving ? 'Recording…' : 'Record payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
