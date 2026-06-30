import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MemberLayout from '@/components/member-layout'
import { Check, FileText, RefreshCw, Download } from 'lucide-react'

export default async function MemberPlanPage() {
  console.log('[MemberPlan] Rendering...')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/member/login')

  const { data: member } = await supabase
    .from('members_with_subscription')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!member) redirect('/member/login')

  const { data: payments } = await supabase
    .from('payments')
    .select('id, total_amount, payment_method, paid_at, invoice_number, invoice_pdf_url, payment_status')
    .eq('member_id', member.id)
    .order('paid_at', { ascending: false })

  const { data: planDetails } = await supabase
    .from('membership_plans')
    .select('features, description')
    .eq('id', member.plan_id ?? '')
    .single()

  const features = Array.isArray(planDetails?.features) ? planDetails.features as string[] : []

  function formatINR(n: number) {
    return '\u20B9' + Math.round(n).toLocaleString('en-IN')
  }

  function formatDate(d: string | null) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatMethod(m: string) {
    return ({ upi: 'UPI', cash: 'Cash', card: 'Card' } as Record<string, string>)[m] ?? m
  }

  const daysRemaining = member.days_remaining ?? 0
  const progress = Math.max(0, Math.min(100, (daysRemaining / (member.duration_days ?? 30)) * 100))

  return (
    <MemberLayout activePage="plan" memberName={member.full_name} memberId={member.id}>
      <div className="px-4 py-3 space-y-4">
        <h2 className="text-lg font-bold text-ink">My plan</h2>

        <div className="rounded-2xl bg-brand p-5 text-white shadow-sm">
          <p className="text-sm opacity-80">Current plan</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {member.plan_price ? formatINR(member.plan_price) : '-'}
            <span className="text-base font-normal opacity-75"> / plan</span>
          </p>
          <span className="mt-1 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
            {member.plan_name ?? 'No plan'}
          </span>

          <div className="mt-4 grid grid-cols-2 gap-4">
            {[
              { label: 'Started', value: formatDate(member.start_date) },
              { label: 'Expires', value: formatDate(member.end_date) },
              { label: 'Status', value: member.subscription_status === 'active' ? 'Active' : 'Inactive' },
              { label: 'Days left', value: `${daysRemaining} days` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs opacity-75">{label}</p>
                <p className="text-sm font-semibold mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs opacity-75">
              <span>Progress</span>
              <span>{Math.round(progress)}% remaining</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {features.length > 0 && (
          <div className="rounded-2xl border border-border bg-bg-card p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-ink">What's included</p>
            <ul className="space-y-2.5">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-ink-secondary">
                  <Check className="h-4 w-4 shrink-0 text-brand-light" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-bold text-white hover:bg-brand-hover shadow-sm">
          <RefreshCw className="h-4 w-4" /> Renew now
        </button>
        <p className="text-center text-xs text-ink-muted -mt-2">Contact the front desk to process your renewal</p>

        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-ink">Payment history</p>
          </div>
          {!payments || payments.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">No payments yet</p>
          ) : (
            <ul className="divide-y divide-border">
              {payments.map(p => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted">
                    <FileText className="h-4 w-4 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{formatINR(p.total_amount)}</p>
                    <p className="text-xs text-ink-muted">{formatMethod(p.payment_method)} &middot; {p.invoice_number}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-ink-muted">{formatDate(p.paid_at)}</span>
                    {p.invoice_pdf_url ? (
                      <a
                        href={p.invoice_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                      >
                        <Download className="h-3 w-3" /> Invoice
                      </a>
                    ) : p.payment_status === 'paid' ? (
                      <span className="text-xs text-ink-muted">Generating&hellip;</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </MemberLayout>
  )
}
