import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import RemindButton from './remind-button'
import DashboardChart from './dashboard-chart'
import {
  Users, CalendarCheck, Clock, IndianRupee,
  TrendingUp, TrendingDown, UserPlus,
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, organization_id, organizations(name, platform_plan)')
    .eq('id', user.id)
    .single()

  const org = profile?.organizations as unknown as { name: string; platform_plan: string } | null

  const { data: kpis } = await supabase.from('org_dashboard_kpis').select('*').single()

  const now = new Date()
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const [
    { data: newMembersThisMonth },
    { data: newMembersLastMonth },
    { data: revenueLastMonthData },
    { data: expiringData },
    { data: recentCheckIns },
    { data: monthlyRevenue },
  ] = await Promise.all([
    supabase.from('members').select('id').is('deleted_at', null).gte('created_at', firstThisMonth),
    supabase.from('members').select('id').is('deleted_at', null).gte('created_at', firstLastMonth).lt('created_at', firstThisMonth),
    supabase.from('payments').select('total_amount').eq('payment_status', 'paid').gte('paid_at', firstLastMonth).lt('paid_at', firstThisMonth),
    supabase.from('member_subscriptions')
      .select('id, end_date, members(id, full_name, phone), membership_plans(name)')
      .gte('end_date', now.toISOString().split('T')[0])
      .lte('end_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
      .eq('status', 'active')
      .order('end_date'),
    supabase.from('attendance')
      .select('id, checked_in_at, result, method, members(id, full_name, initials)')
      .order('checked_in_at', { ascending: false })
      .limit(6),
    supabase.from('payments').select('total_amount, paid_at, created_at').eq('payment_status', 'paid'),
  ])

  const newThisMonth = newMembersThisMonth?.length ?? 0
  const revenueLastMonth = (revenueLastMonthData ?? []).reduce((s: number, p: any) => s + (p.total_amount ?? 0), 0)
  const revThisMonth = kpis?.revenue_this_month ?? 0
  const revDelta = revenueLastMonth > 0 ? Math.round(((revThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : null
  const expiringCount = expiringData?.length ?? 0

  // 6-month chart data
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const total = (monthlyRevenue ?? []).filter((p: any) => {
      const pd = new Date(p.paid_at ?? p.created_at)
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth()
    }).reduce((s: number, p: any) => s + (p.total_amount ?? 0), 0)
    return { month: label, revenue: Math.round(total) }
  })

  function formatINR(n: number) { return '₹' + Math.round(n).toLocaleString('en-IN') }
  function avatarColor(name: string) {
    const colors = ['#1D9E75','#378ADD','#5B53C6','#C2587A','#E08A3C','#0F6E56']
    let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }
  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  function daysLabel(endDate: string) {
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    return `${days} days`
  }
  function daysColor(endDate: string) {
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
    if (days <= 1) return 'text-red-500 font-semibold'
    if (days <= 3) return 'text-orange-500 font-semibold'
    return 'text-yellow-600'
  }

  const stats = [
    {
      label: 'Active members', value: (kpis?.active_members ?? 0).toLocaleString('en-IN'),
      icon: Users, iconBg: 'bg-brand-muted', iconColor: 'text-brand',
      delta: newThisMonth > 0 ? `+${newThisMonth} this month` : 'No new members',
      deltaColor: newThisMonth > 0 ? 'text-green-600' : 'text-ink-muted',
      deltaIcon: newThisMonth > 0 ? TrendingUp : null,
    },
    {
      label: 'Check-ins today', value: (kpis?.checkins_today ?? 0).toLocaleString('en-IN'),
      icon: CalendarCheck, iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
      delta: 'Updating live', deltaColor: 'text-green-500', deltaIcon: null,
    },
    {
      label: 'Expiring in 7 days', value: expiringCount.toLocaleString('en-IN'),
      icon: Clock, iconBg: 'bg-yellow-50', iconColor: 'text-yellow-600',
      delta: expiringCount > 0 ? `${expiringCount} need renewal` : 'All good',
      deltaColor: expiringCount > 0 ? 'text-orange-500' : 'text-green-600',
      deltaIcon: expiringCount > 0 ? TrendingDown : null,
    },
    {
      label: 'Revenue this month', value: formatINR(revThisMonth),
      icon: IndianRupee, iconBg: 'bg-green-50', iconColor: 'text-green-600',
      delta: revDelta !== null ? `${revDelta >= 0 ? '+' : ''}${revDelta}% vs last month` : 'No data last month',
      deltaColor: revDelta !== null && revDelta >= 0 ? 'text-green-600' : 'text-red-500',
      deltaIcon: revDelta !== null ? (revDelta >= 0 ? TrendingUp : TrendingDown) : null,
    },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar gymName={org?.name} orgPlan={org?.platform_plan} expiringCount={expiringCount} />
      <main className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              Welcome back, {profile?.full_name ?? 'Owner'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <a href="/members?add=1"
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover">
            <UserPlus className="h-4 w-4" /> Add member
          </a>
        </div>

        {/* KPI cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, iconBg, iconColor, delta, deltaColor, deltaIcon: DIcon }) => (
            <div key={label} className="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <span className="text-xs font-medium text-ink-muted">{label}</span>
              </div>
              <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
              {delta && (
                <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${deltaColor}`}>
                  {DIcon && <DIcon className="h-3 w-3" />}
                  {delta}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Revenue chart */}
        <div className="mb-5 rounded-xl border border-border bg-bg-card p-5 shadow-sm">
          <DashboardChart data={chartData} totalRevenue={chartData.reduce((s, d) => s + d.revenue, 0)} />
        </div>

        {/* Bottom row */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Expiring this week */}
          <div className="rounded-xl border border-border bg-bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-semibold text-ink">Expiring this week</span>
              </div>
              <a href="/members?filter=expiring" className="text-xs font-medium text-brand hover:underline">View all</a>
            </div>
            {!expiringData || expiringData.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-ink-muted">No members expiring this week 🎉</div>
            ) : (
              <ul className="divide-y divide-border">
                {(expiringData as any[]).map((sub: any) => (
                  <li key={sub.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{sub.members?.full_name}</p>
                      <p className="text-xs text-ink-muted">{sub.membership_plans?.name} · {sub.members?.phone}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm whitespace-nowrap ${daysColor(sub.end_date)}`}>
                        {daysLabel(sub.end_date)}
                      </span>
                      <RemindButton phone={sub.members?.phone ?? ''} name={sub.members?.full_name ?? ''} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent check-ins */}
          <div className="rounded-xl border border-border bg-bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-sm font-semibold text-ink">Recent check-ins</span>
                <span className="text-xs text-green-600 font-medium">Updating live</span>
              </div>
              <a href="/attendance" className="text-xs font-medium text-brand hover:underline">View all</a>
            </div>
            {!recentCheckIns || recentCheckIns.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-ink-muted">No check-ins yet today</div>
            ) : (
              <ul className="divide-y divide-border">
                {(recentCheckIns as any[]).map((c: any) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: avatarColor(c.members?.full_name ?? '') }}>
                      {c.members?.initials ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{c.members?.full_name ?? 'Unknown'}</p>
                      <p className="text-xs text-ink-muted capitalize">{c.method === 'qr' ? 'QR scan' : 'Manual'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs text-ink-muted">{timeAgo(c.checked_in_at)}</span>
                      <span className={`text-xs font-semibold ${c.result === 'allowed' ? 'text-green-600' : 'text-red-500'}`}>
                        {c.result === 'allowed' ? '✓ In' : '✕ Blocked'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
