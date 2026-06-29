'use client'
import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Loader2, Star, Copy } from 'lucide-react'

interface Plan {
  id: string
  name: string
  duration_days: number
  price: number
  gst_rate: number
  features: string[]
  is_popular: boolean
  is_active: boolean
  member_count: number
}

interface Props { plans: Plan[] }

const DURATION_OPTIONS = [
  { label: '1 month', days: 30 },
  { label: '2 months', days: 60 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
]

function durationLabel(days: number) {
  const match = DURATION_OPTIONS.find(d => d.days === days)
  return match?.label ?? `${days} days`
}

function planTierColor(name: string) {
  const n = name.toLowerCase()
  if (n.includes('premium') || n.includes('pro')) return { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' }
  if (n.includes('standard') || n.includes('growth')) return { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' }
  return { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600' }
}

// ── Plan Form Modal ────────────────────────────────────────────────────────
function PlanModal({
  plan, onClose, onSaved,
}: {
  plan: Plan | null
  onClose: () => void
  onSaved: (plan: Plan) => void
}) {
  const isEdit = !!plan
  const [name, setName] = useState(plan?.name ?? '')
  const [durationDays, setDurationDays] = useState(plan?.duration_days ?? 30)
  const [price, setPrice] = useState(plan?.price ? String(plan.price) : '')
  const [gstRate, setGstRate] = useState(plan?.gst_rate ?? 18)
  const [isPopular, setIsPopular] = useState(plan?.is_popular ?? false)
  const [featuresText, setFeaturesText] = useState((plan?.features ?? []).join('\n'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const priceWithGst = price ? Math.round(Number(price) * (1 + gstRate / 100)) : null

  async function handleSubmit() {
    if (!name.trim()) { setError('Plan name is required'); return }
    if (!price || Number(price) <= 0) { setError('Price is required'); return }

    setSaving(true); setError('')
    const body = {
      name: name.trim(),
      duration_days: durationDays,
      price: Number(price),
      gst_rate: gstRate,
      features: featuresText.split('\n').map(f => f.trim()).filter(Boolean),
      is_popular: isPopular,
      is_active: true,
    }

    const res = await fetch(isEdit ? `/api/plans/${plan!.id}` : '/api/plans', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to save plan'); setSaving(false); return }
    onSaved({ ...json.plan, member_count: plan?.member_count ?? 0 })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">{isEdit ? 'Edit plan' : 'New plan'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-page"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-secondary">Plan name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard, Premium"
              className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30" />
          </div>

          {/* Duration + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-secondary">Duration</label>
              <select value={durationDays} onChange={e => setDurationDays(Number(e.target.value))}
                className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none">
                {DURATION_OPTIONS.map(d => <option key={d.days} value={d.days}>{d.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-secondary">Price (₹) *</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="999"
                className="h-10 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30" />
            </div>
          </div>

          {/* GST + with GST preview */}
          <div className="flex items-center justify-between rounded-lg bg-bg-page px-3 py-2.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-ink-secondary">GST rate</label>
              <select value={gstRate} onChange={e => setGstRate(Number(e.target.value))}
                className="h-7 rounded-md border border-border bg-bg-card px-2 text-xs text-ink focus:border-brand-light focus:outline-none">
                <option value={0}>0%</option><option value={5}>5%</option>
                <option value={12}>12%</option><option value={18}>18%</option>
              </select>
            </div>
            {priceWithGst && (
              <p className="text-xs text-ink-muted">With GST: <span className="font-semibold text-ink">₹{priceWithGst.toLocaleString('en-IN')}</span></p>
            )}
          </div>

          {/* Features */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-secondary">Features <span className="text-ink-muted">(one per line)</span></label>
            <textarea value={featuresText} onChange={e => setFeaturesText(e.target.value)} rows={4}
              placeholder={"Gym floor access\nLocker access\n1 group class / week"}
              className="rounded-lg border border-border-medium bg-bg-input px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30 resize-none" />
          </div>

          {/* Popular toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <div onClick={() => setIsPopular(!isPopular)}
              className={`relative h-5 w-9 rounded-full transition-colors ${isPopular ? 'bg-brand' : 'bg-border-strong'}`}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isPopular ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Mark as most popular</p>
              <p className="text-xs text-ink-muted">Shows a "Most popular" badge on this plan</p>
            </div>
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-xs text-ink-muted">{isEdit ? `${plan!.member_count} active members` : 'New plan'}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-bg-page">Cancel</button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirmation ────────────────────────────────────────────────────
function DeleteConfirm({ plan, onClose, onDeleted }: { plan: Plan; onClose: () => void; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/plans/${plan.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to delete'); setDeleting(false); return }
    onDeleted(plan.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-bg-card shadow-xl p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <Trash2 className="h-6 w-6 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-ink mb-1">Delete "{plan.name}"?</h2>
        {plan.member_count > 0 ? (
          <p className="text-sm text-red-600 mb-4">
            ⚠️ This plan has <strong>{plan.member_count} active members</strong>. Deleting it will not remove their existing subscriptions, but no new members can be assigned to this plan.
          </p>
        ) : (
          <p className="text-sm text-ink-muted mb-4">This plan has no active members. It will be permanently deleted.</p>
        )}
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-ink-secondary hover:bg-bg-page">Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? 'Deleting…' : 'Delete plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function PlansClient({ plans: initialPlans }: Props) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null)

  function handleSaved(saved: Plan) {
    setPlans(prev => {
      const exists = prev.find(p => p.id === saved.id)
      return exists ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]
    })
    setShowModal(false)
    setEditingPlan(null)
  }

  function handleDeleted(id: string) {
    setPlans(prev => prev.filter(p => p.id !== id))
    setDeletingPlan(null)
  }

  async function handleDuplicate(plan: Plan) {
    const res = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${plan.name} (Copy)`,
        duration_days: plan.duration_days,
        price: plan.price,
        gst_rate: plan.gst_rate,
        features: plan.features ?? [],
        is_popular: false,
        is_active: true,
      }),
    })
    const json = await res.json()
    if (res.ok && json.plan) setPlans(prev => [...prev, { ...json.plan, member_count: 0 }])
  }

  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Plans & pricing</h1>
          <p className="mt-0.5 text-sm text-ink-muted">Subscription plans assigned to your members</p>
        </div>
        <button onClick={() => { setEditingPlan(null); setShowModal(true) }}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover">
          <Plus className="h-4 w-4" /> New plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-muted">
            <Star className="h-7 w-7 text-brand" />
          </div>
          <p className="text-base font-semibold text-ink">No plans yet</p>
          <p className="mt-1 text-sm text-ink-muted">Create your first membership plan</p>
          <button onClick={() => setShowModal(true)} className="mt-5 flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Create plan
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map(plan => {
            const colors = planTierColor(plan.name)
            const priceWithGst = Math.round(plan.price * (1 + (plan.gst_rate ?? 18) / 100))
            return (
              <div key={plan.id} className={`relative flex flex-col rounded-2xl border bg-bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${plan.is_popular ? 'border-brand ring-1 ring-brand' : 'border-border'}`}>
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-brand px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">Most popular</span>
                  </div>
                )}

                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
                    <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}>
                      {durationLabel(plan.duration_days)}
                    </span>
                  </div>
                  {!plan.is_active && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Inactive</span>
                  )}
                </div>

                <div className="mb-1">
                  <span className="text-3xl font-bold text-ink">₹{plan.price.toLocaleString('en-IN')}</span>
                </div>
                <p className="mb-1 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">{plan.member_count}</span> active members · +{plan.gst_rate ?? 18}% GST
                </p>
                <p className="mb-4 text-xs text-ink-muted">With GST: ₹{priceWithGst.toLocaleString('en-IN')}</p>

                {plan.features && plan.features.length > 0 && (
                  <ul className="mb-5 flex-1 space-y-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-secondary">
                        <span className="mt-0.5 text-brand">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Actions */}
                <div className="mt-auto flex gap-2 pt-3 border-t border-border">
                  <button
                    onClick={() => { setEditingPlan(plan); setShowModal(true) }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium text-ink-secondary hover:bg-bg-page hover:border-brand hover:text-brand transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDuplicate(plan)}
                    title="Duplicate plan"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-bg-page transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingPlan(plan)}
                    title="Delete plan"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit/Create modal */}
      {showModal && (
        <PlanModal
          plan={editingPlan}
          onClose={() => { setShowModal(false); setEditingPlan(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deletingPlan && (
        <DeleteConfirm
          plan={deletingPlan}
          onClose={() => setDeletingPlan(null)}
          onDeleted={handleDeleted}
        />
      )}
    </main>
  )
}
