import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import PlansClient from './plans-client'

export default async function PlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations(name, platform_plan)')
    .eq('id', user.id)
    .single()

  const org = profile?.organizations as unknown as { name: string; platform_plan: string } | null

  // Fetch plans
  const { data: plans } = await supabase
    .from('membership_plans')
    .select('*')
    .is('deleted_at', null)
    .order('price', { ascending: true })

  // Count actual active members per plan from subscriptions
  const { data: activeSubs } = await supabase
    .from('member_subscriptions')
    .select('plan_id')
    .eq('status', 'active')

  const countByPlan: Record<string, number> = {}
  ;(activeSubs ?? []).forEach(s => {
    countByPlan[s.plan_id] = (countByPlan[s.plan_id] ?? 0) + 1
  })

  const plansWithCount = (plans ?? []).map(p => ({
    ...p,
    member_count: countByPlan[p.id] ?? 0,
  }))

  return (
    <div className="flex min-h-screen">
      <Sidebar gymName={org?.name} orgPlan={org?.platform_plan} />
      <PlansClient plans={plansWithCount} />
    </div>
  )
}
