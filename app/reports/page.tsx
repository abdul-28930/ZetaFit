import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import ReportsClient from './reports-client'

export default async function ReportsPage() {
  console.log('[Reports] Rendering...')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations(name, platform_plan)')
    .eq('id', user.id)
    .single()

  const org = profile?.organizations as unknown as { name: string; platform_plan: string } | null

  // ── Plan distribution — count from member_subscriptions directly ──────────
  const { data: plans } = await supabase
    .from('membership_plans')
    .select('id, name, price')
    .is('deleted_at', null)
    .order('price')

  // Count active subscriptions per plan
  const { data: activeSubs } = await supabase
    .from('member_subscriptions')
    .select('plan_id')
    .eq('status', 'active')

  const subCountByPlan: Record<string, number> = {}
  ;(activeSubs ?? []).forEach(s => {
    subCountByPlan[s.plan_id] = (subCountByPlan[s.plan_id] ?? 0) + 1
  })

  const planStats = (plans ?? []).map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    member_count: subCountByPlan[p.id] ?? 0,
  }))

  console.log('[Reports] Plan stats:', JSON.stringify(planStats))

  // ── Revenue data ───────────────────────────────────────────────────────────
  const now = new Date()
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const firstThisMonthISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: allPayments } = await supabase
    .from('payments')
    .select('total_amount, payment_status, paid_at, created_at')
    .eq('payment_status', 'paid')

  const totalAllTime = (allPayments ?? []).reduce((s, p) => s + (p.total_amount ?? 0), 0)
  const revenueThisMonth = (allPayments ?? [])
    .filter(p => new Date(p.paid_at ?? p.created_at) >= new Date(firstThisMonth))
    .reduce((s, p) => s + (p.total_amount ?? 0), 0)
  const revenueLastMonth = (allPayments ?? [])
    .filter(p => {
      const d = new Date(p.paid_at ?? p.created_at)
      return d >= new Date(firstLastMonth) && d < new Date(firstThisMonthISO)
    })
    .reduce((s, p) => s + (p.total_amount ?? 0), 0)

  console.log('[Reports] Revenue this month:', revenueThisMonth, 'last:', revenueLastMonth, 'all time:', totalAllTime)

  // ── Attendance this month ──────────────────────────────────────────────────
  const { data: attendanceThisMonth } = await supabase
    .from('attendance')
    .select('id')
    .gte('checked_in_at', firstThisMonth)

  const totalCheckInsThisMonth = attendanceThisMonth?.length ?? 0

  // ── Member growth last 6 months ────────────────────────────────────────────
  const { data: allMembers } = await supabase
    .from('members')
    .select('created_at')
    .is('deleted_at', null)

  const monthlyGrowth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const count = (allMembers ?? []).filter(m => {
      const md = new Date(m.created_at)
      return md.getFullYear() === d.getFullYear() && md.getMonth() === d.getMonth()
    }).length
    return { month: label, count }
  })

  console.log('[Reports] Monthly growth:', JSON.stringify(monthlyGrowth))

  // ── Expiring in 30 days ────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const { data: expiringMembers } = await supabase
    .from('member_subscriptions')
    .select('id, end_date, members(id, full_name, phone), membership_plans(name)')
    .gte('end_date', today)
    .lte('end_date', in30Days)
    .eq('status', 'active')
    .order('end_date')

  console.log('[Reports] Expiring in 30 days:', expiringMembers?.length ?? 0)

  return (
    <div className="flex min-h-screen">
      <Sidebar gymName={org?.name} orgPlan={org?.platform_plan} />
      <ReportsClient
        planStats={planStats}
        revenueThisMonth={revenueThisMonth}
        revenueLastMonth={revenueLastMonth}
        totalAllTime={totalAllTime}
        totalCheckInsThisMonth={totalCheckInsThisMonth}
        monthlyGrowth={monthlyGrowth}
        expiringMembers={(expiringMembers ?? []) as unknown as any[]}
        gymName={org?.name ?? 'Your Gym'}
      />
    </div>
  )
}
