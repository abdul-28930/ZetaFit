'use client'
import { useState } from 'react'
import { Plus, Search, X, Phone, Users } from 'lucide-react'
import MemberDrawer from './member-drawer'

interface Plan {
  id: string
  name: string
  price: number
  duration_days: number
}

interface Member {
  id: string
  full_name: string
  initials: string
  phone: string
  email: string | null
  status: string
  join_date: string
  plan_id: string | null
  plan_name: string | null
  plan_price: number | null
  end_date: string | null
  days_remaining: number | null
  outstanding_dues: number
  subscription_id: string | null
}

interface Props {
  members: Member[]
  plans: Plan[]
}

function avatarColor(name: string) {
  const colors = ['#1D9E75','#378ADD','#5B53C6','#C2587A','#E08A3C','#0F6E56']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function statusClass(status: string) {
  if (status === 'active') return 'bg-green-50 text-green-700'
  if (status === 'expired') return 'bg-red-50 text-red-600'
  if (status === 'paused') return 'bg-gray-100 text-gray-600'
  return 'bg-yellow-50 text-yellow-700'
}

function daysLabel(days: number | null) {
  if (days === null) return '—'
  if (days < 0) return `Expired ${Math.abs(days)}d ago`
  if (days === 0) return 'Today'
  if (days <= 7) return `${days}d left`
  return `${days}d left`
}

function daysColor(days: number | null) {
  if (days === null || days < 0) return 'text-red-500'
  if (days <= 7) return 'text-yellow-600'
  return 'text-ink-secondary'
}

function planClass(name: string | null) {
  if (!name) return 'bg-gray-100 text-gray-500'
  const n = name.toLowerCase()
  if (n.includes('premium')) return 'bg-purple-50 text-purple-700'
  if (n.includes('standard')) return 'bg-blue-50 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

function durationLabel(days: number) {
  if (days === 30) return '1 month'
  if (days === 60) return '2 months'
  if (days === 90) return '3 months'
  if (days === 180) return '6 months'
  if (days === 365) return '1 year'
  return `${days} days`
}

export default function MembersClient({ members: initialMembers, plans }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  // Add member form
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash')
  const [amountPaid, setAmountPaid] = useState('')

  const selectedPlan = plans.find(p => p.id === planId)

  function resetForm() {
    setFullName(''); setPhone(''); setEmail('')
    setPlanId(plans[0]?.id ?? ''); setPaymentMethod('cash')
    setAmountPaid(''); setError('')
  }

  function closeModal() { setShowModal(false); resetForm() }

  const filtered = members.filter(m => {
    const matchSearch = !search ||
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search)
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    return matchSearch && matchStatus
  })

  function handleMemberUpdated(updated: Member) {
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelectedMember(updated)
  }

  async function handleAddMember() {
    if (!fullName.trim()) { setError('Full name is required'); return }
    if (!phone.trim()) { setError('Phone number is required'); return }
    if (!planId) { setError('Select a plan'); return }

    setSaving(true)
    setError('')

    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        plan_id: planId,
        payment_method: paymentMethod,
        amount_paid: amountPaid ? Number(amountPaid) : 0,
      }),
    })

    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to add member'); setSaving(false); return }

    setMembers(prev => [json.member, ...prev])
    closeModal()
    setSaving(false)
  }

  return (
    <main className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Members</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{members.length} total members</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4" /> Add member
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className="h-9 w-64 rounded-lg border border-border-medium bg-bg-card pl-9 pr-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-border-medium bg-bg-card px-3 text-sm text-ink focus:border-brand-light focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-bg-card overflow-hidden shadow-sm">
        <div className="hidden grid-cols-[1fr_120px_100px_110px_100px] gap-4 border-b border-border bg-bg-page px-5 py-3 lg:grid">
          {['Member', 'Plan', 'Status', 'Expiry', 'Dues'].map(h => (
            <span key={h} className="text-xs font-medium uppercase tracking-wide text-ink-muted">{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-10 w-10 text-ink-muted mb-3" />
            <p className="text-sm font-medium text-ink">
              {members.length === 0 ? 'No members yet' : 'No members match your search'}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {members.length === 0 ? 'Add your first member to get started' : 'Try a different search or filter'}
            </p>
            {members.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> Add member
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map(m => (
              <li
                key={m.id}
                onClick={() => setSelectedMember(m)}
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3.5 hover:bg-bg-page cursor-pointer transition-colors lg:grid-cols-[1fr_120px_100px_110px_100px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: avatarColor(m.full_name) }}
                  >
                    {m.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{m.full_name}</p>
                    <p className="flex items-center gap-1 text-xs text-ink-muted">
                      <Phone className="h-3 w-3" />{m.phone}
                    </p>
                  </div>
                </div>
                <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium lg:inline-flex ${planClass(m.plan_name)}`}>
                  {m.plan_name ?? '—'}
                </span>
                <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium capitalize lg:inline-flex ${statusClass(m.status)}`}>
                  {m.status}
                </span>
                <span className={`hidden text-sm lg:block ${daysColor(m.days_remaining)}`}>
                  {daysLabel(m.days_remaining)}
                </span>
                <span className={`hidden text-sm font-medium lg:block ${m.outstanding_dues > 0 ? 'text-red-500' : 'text-ink-muted'}`}>
                  {m.outstanding_dues > 0 ? `₹${m.outstanding_dues.toLocaleString('en-IN')}` : '—'}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize lg:hidden ${statusClass(m.status)}`}>
                  {m.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Member Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-ink">Add member</h2>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-page">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Full name *</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Suresh Kumar"
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Phone *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel"
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Email (optional)</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="member@gmail.com" type="email"
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Plan *</label>
                <select value={planId} onChange={e => setPlanId(e.target.value)}
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none">
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{p.price.toLocaleString('en-IN')} / {durationLabel(p.duration_days)}</option>
                  ))}
                </select>
                {selectedPlan && (
                  <p className="text-xs text-ink-muted">Total with 18% GST: ₹{Math.round(selectedPlan.price * 1.18).toLocaleString('en-IN')}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-secondary">Amount paid (₹)</label>
                  <input value={amountPaid} onChange={e => setAmountPaid(e.target.value)} type="number"
                    placeholder={selectedPlan ? String(Math.round(selectedPlan.price * 1.18)) : '0'}
                    className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-secondary">Payment method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}
                    className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              <p className="text-xs text-ink-muted">Subscription starts today</p>
              <div className="flex gap-2">
                <button onClick={closeModal} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-bg-page">Cancel</button>
                <button onClick={handleAddMember} disabled={saving}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
                  {saving ? 'Adding…' : 'Add member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Member Drawer */}
      {selectedMember && (
        <MemberDrawer
          member={selectedMember}
          plans={plans}
          onClose={() => setSelectedMember(null)}
          onUpdated={handleMemberUpdated}
        />
      )}
    </main>
  )
}
