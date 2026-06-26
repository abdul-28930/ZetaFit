import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import {
  Users, CalendarCheck, Clock, IndianRupee,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react'

export default async function DashboardPage() {
  console.log('[Dashboard] Rendering...')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, organization_id, organizations(name, platform_plan)')
    .eq('id', user.id)
    .single()

  const org = profile?.organizations as unknown as { name: string; platform_plan: string } | null

  // Fetch KPIs
  const { data: kpis } = await supabase
    .from('org_dashboard_kpis')
    .select('*')
    .single()

  console.log('[Dashboard] KPIs:', JSON.stringify(kpis))

  // Expiring in 7 days
  const today = new Date().toISOString().split('T')[0]
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const { data: expiringMembers } = await supabase
    .from('member_subscriptions')
    .select('id, end_date, members(id, full_name, phone), membership_plans(name)')
    .gte('end_date', today)
    .lte('end_date', in7Days)
    .eq('status', 'active')
    .order('end_date')
    .limit(5)

  console.log('[Dashboard] Expiring members:', expiringMembers?.length ?? 0)

  // Recent check-ins
  const { data: recentCheckIns } = await supabase
    .from('attendance')
    .select('id, checked_in_at, result, method, members(id, full_name, initials)')
    .order('checked_in_at', { ascending: false })
    .limit(6)

  console.log('[Dashboard] Recent check-ins:', recentCheckIns?.length ?? 0)

  function formatINR(amount: number) {
    return '₹' + Math.round(amount).toLocaleString('en-IN')
  }

  function avatarColor(name: string) {
    const colors = ['#1D9E75', '#378ADD', '#5B53C6', '#C2587A', '#E08A3C', '#0F6E56']
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  function daysLabel(endDate: string) {
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    return `${days} days`
  }

  function daysColor(endDate: string) {
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
    if (days <= 1) return 'text-red-500'
    if (days <= 3) return 'text-orange-500'
    return 'text-yellow-600'
  }

  const stats = [
    {
      label: 'Active members',
      value: kpis?.active_members?.toLocaleString('en-IN') ?? '0',
      icon: Users,
      iconBg: 'bg-brand-muted',
      iconColor: 'text-brand',
      trend: null,
    },
    {
      label: 'Check-ins today',
      value: kpis?.checkins_today?.toLocaleString('en-IN') ?? '0',
      icon: CalendarCheck,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: null,
    },
    {
      label: 'Expiring in 7 days',
      value: kpis?.expiring_in_7_days?.toLocaleString('en-IN') ?? '0',
      icon: Clock,
      iconBg: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      trend: null,
    },
    {
      label: 'Revenue this month',
      value: formatINR(kpis?.revenue_this_month ?? 0),
      icon: IndianRupee,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: null,
    },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar gymName={org?.name} orgPlan={org?.platform_plan} />

      <main className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Welcome back, {profile?.full_name ?? 'Owner'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
            <div key={label} className="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <span className="text-xs font-medium text-ink-muted">{label}</span>
              </div>
              <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Expiring members */}
          <div className="rounded-xl border border-border bg-bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-semibold text-ink">Expiring this week</span>
              </div>
              <a href="/members" className="text-xs font-medium text-brand hover:underline">View all</a>
            </div>

            {!expiringMembers || expiringMembers.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-ink-muted">
                No members expiring this week 🎉
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {expiringMembers.map((sub: any) => (
                  <li key={sub.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{sub.members?.full_name}</p>
                      <p className="text-xs text-ink-muted">{sub.membership_plans?.name} · {sub.members?.phone}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${daysColor(sub.end_date)}`}>
                      {daysLabel(sub.end_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent check-ins */}
          <div className="rounded-xl border border-border bg-bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-brand" />
                <span className="text-sm font-semibold text-ink">Recent check-ins</span>
              </div>
              <a href="/attendance" className="text-xs font-medium text-brand hover:underline">View all</a>
            </div>

            {!recentCheckIns || recentCheckIns.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-ink-muted">
                No check-ins yet today
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentCheckIns.map((c: any) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: avatarColor(c.members?.full_name ?? '') }}
                    >
                      {c.members?.initials ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{c.members?.full_name ?? 'Unknown'}</p>
                      <p className="text-xs capitalize text-ink-muted">{c.method}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs text-ink-muted">{formatTime(c.checked_in_at)}</span>
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
