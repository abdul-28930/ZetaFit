'use client'
import { useState } from 'react'
import {
  X, Phone, Mail, Calendar, IndianRupee,
  CheckCircle2, Save, RefreshCw, Loader2,
  User, CreditCard, AlertTriangle,
} from 'lucide-react'

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
  member: Member
  plans: Plan[]
  onClose: () => void
  onUpdated: (updated: Member) => void
}

type Tab = 'overview' | 'edit' | 'renew'

function avatarColor(name: string) {
  const colors = ['#1D9E75', '#378ADD', '#5B53C6', '#C2587A', '#E08A3C', '#0F6E56']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatINR(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

function durationLabel(days: number) {
  if (days === 30) return '1 month'
  if (days === 90) return '3 months'
  if (days === 180) return '6 months'
  if (days === 365) return '1 year'
  return `${days} days`
}

export default function MemberDrawer({ member, plans, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  // Edit form state
  const [editName, setEditName] = useState(member.full_name)
  const [editPhone, setEditPhone] = useState(member.phone)
  const [editEmail, setEditEmail] = useState(member.email ?? '')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState(false)

  // Renew form state
  const [renewPlanId, setRenewPlanId] = useState(member.plan_id ?? plans[0]?.id ?? '')
  const [renewMethod, setRenewMethod] = useState<'cash' | 'upi' | 'card'>('cash')
  const [renewAmount, setRenewAmount] = useState('')
  const [renewSaving, setRenewSaving] = useState(false)
  const [renewError, setRenewError] = useState('')
  const [renewSuccess, setRenewSuccess] = useState(false)

  const selectedPlan = plans.find(p => p.id === renewPlanId)
  const color = avatarColor(member.full_name)

  async function handleEdit() {
    if (!editName.trim()) { setEditError('Name is required'); return }
    if (!editPhone.trim()) { setEditError('Phone is required'); return }

    setEditSaving(true)
    setEditError('')
    console.log('[EditMember] Saving:', { editName, editPhone, editEmail })

    const res = await fetch(`/api/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
      }),
    })

    const json = await res.json()
    console.log('[EditMember] Response:', json)

    if (!res.ok) {
      setEditError(json.error ?? 'Failed to update')
      setEditSaving(false)
      return
    }

    setEditSuccess(true)
    setEditSaving(false)
    onUpdated({ ...member, full_name: editName.trim(), phone: editPhone.trim(), email: editEmail.trim() || null })
    setTimeout(() => setEditSuccess(false), 3000)
  }

  async function handleRenew() {
    if (!renewPlanId) { setRenewError('Select a plan'); return }

    setRenewSaving(true)
    setRenewError('')
    console.log('[RenewMember] Renewing:', { memberId: member.id, renewPlanId, renewMethod })

    const res = await fetch(`/api/members/${member.id}/renew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: renewPlanId,
        payment_method: renewMethod,
        amount_paid: renewAmount ? Number(renewAmount) : (selectedPlan?.price ?? 0) * 1.18,
      }),
    })

    const json = await res.json()
    console.log('[RenewMember] Response:', json)

    if (!res.ok) {
      setRenewError(json.error ?? 'Failed to renew')
      setRenewSaving(false)
      return
    }

    setRenewSuccess(true)
    setRenewSaving(false)
    onUpdated({ ...member, status: 'active', end_date: json.end_date, days_remaining: json.days_remaining, plan_id: renewPlanId, plan_name: selectedPlan?.name ?? member.plan_name })
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: User },
    { key: 'edit', label: 'Edit', icon: Save },
    { key: 'renew', label: 'Renew', icon: RefreshCw },
  ]

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-bg-card shadow-2xl animate-slide-in">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
              style={{ background: color }}
            >
              {member.initials}
            </div>
            <div>
              <p className="font-semibold text-ink">{member.full_name}</p>
              <p className="text-xs text-ink-muted">{member.phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-page">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                tab === key
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="p-5 space-y-4">
              {/* Status + plan */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Status', value: member.status, className: member.status === 'active' ? 'text-green-700' : 'text-red-600' },
                  { label: 'Plan', value: member.plan_name ?? '—', className: 'text-ink' },
                  { label: 'Joined', value: formatDate(member.join_date), className: 'text-ink' },
                  { label: 'Expires', value: formatDate(member.end_date), className: member.days_remaining !== null && member.days_remaining <= 7 ? 'text-red-600' : 'text-ink' },
                  { label: 'Days left', value: member.days_remaining !== null ? `${member.days_remaining}d` : '—', className: member.days_remaining !== null && member.days_remaining <= 7 ? 'text-red-600 font-bold' : 'text-ink' },
                  { label: 'Dues', value: member.outstanding_dues > 0 ? formatINR(member.outstanding_dues) : 'None', className: member.outstanding_dues > 0 ? 'text-red-600 font-bold' : 'text-green-700' },
                ].map(({ label, value, className }) => (
                  <div key={label} className="rounded-xl border border-border p-3">
                    <p className="text-xs text-ink-muted">{label}</p>
                    <p className={`mt-0.5 text-sm font-semibold capitalize ${className}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {member.days_remaining !== null && member.plan_price && (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-ink-muted">
                    <span>Membership progress</span>
                    <span>{member.days_remaining}d remaining</span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-light"
                      style={{ width: `${Math.max(5, Math.min(100, (member.days_remaining / 90) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Contact */}
              <div className="rounded-xl border border-border p-4 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Contact</p>
                <div className="flex items-center gap-2.5 text-sm text-ink-secondary">
                  <Phone className="h-4 w-4 text-ink-muted shrink-0" />
                  {member.phone}
                </div>
                {member.email && (
                  <div className="flex items-center gap-2.5 text-sm text-ink-secondary">
                    <Mail className="h-4 w-4 text-ink-muted shrink-0" />
                    {member.email}
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-sm text-ink-secondary">
                  <Calendar className="h-4 w-4 text-ink-muted shrink-0" />
                  Joined {formatDate(member.join_date)}
                </div>
              </div>

              {/* Expiry warning */}
              {member.days_remaining !== null && member.days_remaining <= 7 && member.days_remaining >= 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                  <p className="text-sm text-orange-700">
                    {member.days_remaining === 0 ? 'Expires today!' : `Expires in ${member.days_remaining} days`} — consider renewing.
                  </p>
                </div>
              )}

              {/* Quick renew button */}
              <button
                onClick={() => setTab('renew')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                <RefreshCw className="h-4 w-4" /> Renew membership
              </button>
            </div>
          )}

          {/* ── EDIT ── */}
          {tab === 'edit' && (
            <div className="p-5 space-y-4">
              <p className="text-sm text-ink-muted">Update member contact details.</p>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Full name *</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Phone *</label>
                <input
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  type="tel"
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-secondary">Email</label>
                <input
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  type="email"
                  className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30"
                />
              </div>

              {editError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>}

              {editSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Saved successfully
                </div>
              )}

              <button
                onClick={handleEdit}
                disabled={editSaving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
              >
                {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}

          {/* ── RENEW ── */}
          {tab === 'renew' && (
            <div className="p-5 space-y-4">
              {renewSuccess ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink">Membership renewed!</p>
                    <p className="text-sm text-ink-muted mt-1">
                      {member.full_name} is now active on the {selectedPlan?.name} plan.
                    </p>
                  </div>
                  <button onClick={onClose} className="rounded-xl border border-border px-5 py-2 text-sm font-medium text-ink-secondary hover:bg-bg-page">
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-ink-muted">
                    Select a plan to renew {member.full_name}&apos;s membership. Starts from today.
                  </p>

                  {/* Current status */}
                  <div className="rounded-xl border border-border p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-ink-muted">Current plan</p>
                      <p className="text-sm font-semibold text-ink">{member.plan_name ?? 'None'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-muted">Expires</p>
                      <p className={`text-sm font-semibold ${member.days_remaining !== null && member.days_remaining <= 0 ? 'text-red-600' : 'text-ink'}`}>
                        {formatDate(member.end_date)}
                      </p>
                    </div>
                  </div>

                  {/* Plan selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-ink-secondary">New plan *</label>
                    <div className="space-y-2">
                      {plans.map(p => (
                        <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 hover:bg-bg-page has-[:checked]:border-brand has-[:checked]:bg-brand-muted">
                          <input
                            type="radio"
                            name="plan"
                            value={p.id}
                            checked={renewPlanId === p.id}
                            onChange={() => {
                              setRenewPlanId(p.id)
                              setRenewAmount(String(Math.round(p.price * 1.18)))
                            }}
                            className="sr-only"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-ink">{p.name}</p>
                            <p className="text-xs text-ink-muted">{durationLabel(p.duration_days)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-ink">{formatINR(p.price)}</p>
                            <p className="text-[10px] text-ink-muted">+18% GST = {formatINR(Math.round(p.price * 1.18))}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-ink-secondary">Amount (₹)</label>
                      <input
                        type="number"
                        value={renewAmount}
                        onChange={e => setRenewAmount(e.target.value)}
                        placeholder={selectedPlan ? String(Math.round(selectedPlan.price * 1.18)) : '0'}
                        className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-ink-secondary">Method</label>
                      <select
                        value={renewMethod}
                        onChange={e => setRenewMethod(e.target.value as any)}
                        className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  </div>

                  {renewError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{renewError}</p>}

                  <button
                    onClick={handleRenew}
                    disabled={renewSaving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
                  >
                    {renewSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {renewSaving ? 'Renewing…' : 'Confirm renewal'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
