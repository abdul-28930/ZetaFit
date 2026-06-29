'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Search, X, Phone, Users, MoreVertical, CalendarCheck, RefreshCw, Pencil, Bell, CheckSquare, Square, UserPlus } from 'lucide-react'
import MemberDrawer from './member-drawer'

interface Plan { id: string; name: string; price: number; duration_days: number }
interface Member {
  id: string; full_name: string; initials: string; phone: string
  email: string | null; status: string; join_date: string
  plan_id: string | null; plan_name: string | null; plan_price: number | null
  end_date: string | null; days_remaining: number | null
  outstanding_dues: number; subscription_id: string | null
}
interface Props { members: Member[]; plans: Plan[] }

function avatarColor(name: string) {
  const colors = ['#1D9E75','#378ADD','#5B53C6','#C2587A','#E08A3C','#0F6E56']
  let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
function statusClass(s: string) {
  if (s === 'active') return 'bg-green-50 text-green-700 border border-green-200'
  if (s === 'expired') return 'bg-red-50 text-red-600 border border-red-200'
  return 'bg-yellow-50 text-yellow-700 border border-yellow-200'
}
function planClass(name: string | null) {
  if (!name) return 'bg-gray-100 text-gray-500'
  const n = name.toLowerCase()
  if (n.includes('premium') || n.includes('pro')) return 'bg-purple-50 text-purple-700 border border-purple-200'
  if (n.includes('standard') || n.includes('growth')) return 'bg-blue-50 text-blue-700 border border-blue-200'
  return 'bg-gray-100 text-gray-600 border border-gray-200'
}
function expiryClass(days: number | null) {
  if (days === null || days < 0) return 'text-red-600 font-semibold'
  if (days <= 7) return 'text-orange-500 font-semibold'
  if (days <= 14) return 'text-yellow-600 font-medium'
  return 'text-ink-secondary'
}
function daysLabel(days: number | null) {
  if (days === null) return '—'
  if (days < 0) return `Exp. ${Math.abs(days)}d ago`
  if (days === 0) return 'Today'
  if (days <= 30) return `${days}d left`
  return `${days}d`
}
function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function durationLabel(days: number) {
  if (days === 30) return '1 month'; if (days === 90) return '3 months'
  if (days === 180) return '6 months'; if (days === 365) return '1 year'
  return `${days} days`
}

function KebabMenu({ member, onEdit, onRenew }: { member: Member; onEdit: () => void; onRenew: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button title="Member actions" onClick={e => { e.stopPropagation(); setOpen(!open) }}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-bg-page hover:text-ink">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-border bg-bg-card shadow-lg overflow-hidden">
            {[
              { icon: Pencil, label: 'Edit details', action: () => { setOpen(false); onEdit() } },
              { icon: RefreshCw, label: 'Renew membership', action: () => { setOpen(false); onRenew() } },
              { icon: CalendarCheck, label: 'Check in now', action: () => setOpen(false) },
              { icon: Bell, label: 'Send reminder', action: () => setOpen(false) },
            ].map(({ icon: Icon, label, action }) => (
              <button key={label} onClick={action}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-secondary hover:bg-bg-page hover:text-ink">
                <Icon className="h-3.5 w-3.5 text-ink-muted" /> {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function MembersInner({ members: initialMembers, plans }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [showModal, setShowModal] = useState(searchParams.get('add') === '1')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expiringOnly, setExpiringOnly] = useState(searchParams.get('filter') === 'expiring')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [drawerTab, setDrawerTab] = useState<'overview' | 'edit' | 'renew'>('overview')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'upi'|'card'>('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const selectedPlan = plans.find(p => p.id === planId)

  function resetForm() {
    setFullName(''); setPhone(''); setEmail('')
    setPlanId(plans[0]?.id ?? ''); setPaymentMethod('cash'); setAmountPaid(''); setError('')
  }

  const filtered = members.filter(m => {
    const matchSearch = !search || m.full_name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search)
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    const matchExpiring = !expiringOnly || (m.days_remaining !== null && m.days_remaining >= 0 && m.days_remaining <= 7)
    return matchSearch && matchStatus && matchExpiring
  })

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }
  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(m => m.id)))
  }
  function openDrawer(m: Member, tab: 'overview'|'edit'|'renew' = 'overview') {
    setSelectedMember(m); setDrawerTab(tab)
  }

  async function handleAddMember() {
    if (!fullName.trim()) { setError('Full name is required'); return }
    if (!phone.trim()) { setError('Phone number is required'); return }
    if (!planId) { setError('Select a plan'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim(), email: email.trim() || null, plan_id: planId, payment_method: paymentMethod, amount_paid: amountPaid ? Number(amountPaid) : 0 }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to add member'); setSaving(false); return }
    setMembers(prev => [json.member, ...prev])
    setShowModal(false); resetForm(); setSaving(false)
  }

  const pageTitle = expiringOnly ? `Expiring soon (${filtered.length})` : `Members (${members.length})`

  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{pageTitle}</h1>
          {expiringOnly
            ? <p className="mt-0.5 text-sm text-ink-muted">Members expiring in the next 7 days</p>
            : <p className="mt-0.5 text-sm text-ink-muted">{members.filter(m => m.status === 'active').length} active · {members.filter(m => m.status === 'expired').length} expired</p>
          }
        </div>
        <div className="flex items-center gap-2">
          {expiringOnly && (
            <button onClick={() => { setExpiringOnly(false); router.push('/members') }}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-bg-page">
              <X className="h-3.5 w-3.5" /> Show all
            </button>
          )}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-card px-3 py-1.5">
              <span className="text-sm font-medium text-ink">{selected.size} selected</span>
              <button className="text-xs text-brand hover:underline">Remind all</button>
              <button className="text-xs text-ink-muted hover:text-red-500" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover">
            <UserPlus className="h-4 w-4" /> Add member
          </button>
        </div>
      </div>

      {/* Filters */}
      {!expiringOnly && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…"
              className="h-9 w-64 rounded-lg border border-border-medium bg-bg-card pl-9 pr-3 text-sm text-ink focus:border-brand-light focus:outline-none" />
            {search && <button title="Clear search" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <select title="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-border-medium bg-bg-card px-3 text-sm text-ink focus:border-brand-light focus:outline-none">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
          <span className="ml-auto text-xs text-ink-muted">{filtered.length} members</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-bg-card overflow-hidden shadow-sm">
        <div className="hidden grid-cols-[40px_1fr_130px_110px_120px_110px_40px] gap-3 border-b border-border bg-bg-page px-4 py-3 lg:grid">
          <div className="flex items-center">
            <button title="Select all" onClick={toggleAll} className="text-ink-muted hover:text-ink">
              {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-brand" /> : <Square className="h-4 w-4" />}
            </button>
          </div>
          {['Member', 'Plan', 'Status', 'Expiry', 'Dues', ''].map(h => (
            <span key={h} className="text-xs font-medium uppercase tracking-wide text-ink-muted">{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-10 w-10 text-ink-muted mb-3" />
            <p className="text-sm font-medium text-ink">{expiringOnly ? 'No members expiring in the next 7 days 🎉' : members.length === 0 ? 'No members yet' : 'No matches'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map(m => {
              const isSelected = selected.has(m.id)
              return (
                <li key={m.id} onClick={() => openDrawer(m)}
                  className={`grid grid-cols-[40px_1fr_auto] items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors lg:grid-cols-[40px_1fr_130px_110px_120px_110px_40px] ${isSelected ? 'bg-brand-muted' : 'hover:bg-bg-page'}`}>
                  <div className="flex items-center" onClick={e => toggleSelect(m.id, e)}>
                    {isSelected ? <CheckSquare className="h-4 w-4 text-brand" /> : <Square className="h-4 w-4 text-ink-muted" />}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: avatarColor(m.full_name) }}>{m.initials}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{m.full_name}</p>
                      <p className="flex items-center gap-1 text-xs text-ink-muted"><Phone className="h-3 w-3" />{m.phone}</p>
                    </div>
                  </div>
                  <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium lg:inline-flex border ${planClass(m.plan_name)}`}>{m.plan_name ?? '—'}</span>
                  <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium capitalize lg:inline-flex border ${statusClass(m.status)}`}>{m.status}</span>
                  <span className={`hidden text-sm lg:block ${expiryClass(m.days_remaining)}`}>
                    {daysLabel(m.days_remaining)}
                    {m.end_date && m.days_remaining !== null && m.days_remaining <= 14 && (
                      <span className="block text-[10px] font-normal text-ink-muted">{formatDate(m.end_date)}</span>
                    )}
                  </span>
                  <span className={`hidden text-sm font-semibold lg:block ${m.outstanding_dues > 0 ? 'text-red-600' : 'text-ink-muted'}`}>
                    {m.outstanding_dues > 0 ? `₹${m.outstanding_dues.toLocaleString('en-IN')}` : 'Paid'}
                  </span>
                  <div className="hidden lg:block" onClick={e => e.stopPropagation()}>
                    <KebabMenu member={m} onEdit={() => openDrawer(m, 'edit')} onRenew={() => openDrawer(m, 'renew')} />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize lg:hidden border ${statusClass(m.status)}`}>{m.status}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Add Member Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-ink">Add member</h2>
              <button title="Close" onClick={() => { setShowModal(false); resetForm() }} className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-page"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              {[
                { label: 'Full name *', value: fullName, set: setFullName, placeholder: 'Suresh Kumar', type: 'text' },
                { label: 'Phone *', value: phone, set: setPhone, placeholder: '+91 98765 43210', type: 'tel' },
                { label: 'Email (optional)', value: email, set: setEmail, placeholder: 'member@gmail.com', type: 'email' },
              ].map(({ label, value, set, placeholder, type }) => (
                <div key={label} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-secondary">{label}</label>
                  <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder} type={type}
                    className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30" />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Plan *</label>
                <select title="Select plan" value={planId} onChange={e => setPlanId(e.target.value)}
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none">
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.price.toLocaleString('en-IN')} / {durationLabel(p.duration_days)}</option>)}
                </select>
                {selectedPlan && <p className="text-xs text-ink-muted">With GST: ₹{Math.round(selectedPlan.price * 1.18).toLocaleString('en-IN')}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-secondary">Amount paid (₹)</label>
                  <input value={amountPaid} onChange={e => setAmountPaid(e.target.value)} type="number"
                    placeholder={selectedPlan ? String(Math.round(selectedPlan.price * 1.18)) : '0'}
                    className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-secondary">Method</label>
                  <select title="Payment method" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}
                    className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none">
                    <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
                  </select>
                </div>
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              <p className="text-xs text-ink-muted">Starts today</p>
              <div className="flex gap-2">
                <button onClick={() => { setShowModal(false); resetForm() }} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-bg-page">Cancel</button>
                <button onClick={handleAddMember} disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
                  {saving ? 'Adding…' : 'Add member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedMember && (
        <MemberDrawer member={selectedMember} plans={plans} initialTab={drawerTab}
          onClose={() => setSelectedMember(null)}
          onUpdated={updated => { setMembers(prev => prev.map(m => m.id === updated.id ? updated : m)); setSelectedMember(updated) }} />
      )}
    </main>
  )
}

export default function MembersClient(props: Props) {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-ink-muted">Loading…</div>}>
      <MembersInner {...props} />
    </Suspense>
  )
}
