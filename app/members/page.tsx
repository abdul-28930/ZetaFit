import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import MembersClient from './members-client'

export default async function MembersPage() {
  console.log('[Members] Rendering...')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations(name, platform_plan)')
    .eq('id', user.id)
    .single()

  const org = profile?.organizations as unknown as { name: string; platform_plan: string } | null

  const [{ data: members }, { data: plans }] = await Promise.all([
    supabase
      .from('members_with_subscription')
      .select('id, full_name, initials, phone, email, status, join_date, plan_id, plan_name, plan_price, end_date, days_remaining, outstanding_dues, subscription_id')
      .order('created_at', { ascending: false }),
    supabase
      .from('membership_plans')
      .select('id, name, price, duration_days')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('price'),
  ])

  console.log('[Members] Fetched:', members?.length ?? 0, 'members,', plans?.length ?? 0, 'plans')

  return (
    <div className="flex min-h-screen">
      <Sidebar gymName={org?.name} orgPlan={org?.platform_plan} />
      <MembersClient members={(members ?? []) as any[]} plans={plans ?? []} />
    </div>
  )
}
