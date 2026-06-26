import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import AttendanceClient from './attendance-client'

export default async function AttendancePage() {
  console.log('[Attendance] Rendering...')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations(name, platform_plan)')
    .eq('id', user.id)
    .single()

  const org = profile?.organizations as unknown as { name: string; platform_plan: string } | null

  // Today's check-ins
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: todayCheckIns, error } = await supabase
    .from('attendance')
    .select(`
      id, checked_in_at, result, method,
      members(id, full_name, initials)
    `)
    .gte('checked_in_at', todayStart.toISOString())
    .order('checked_in_at', { ascending: false })

  console.log('[Attendance] Today check-ins:', todayCheckIns?.length ?? 0, error?.message ?? '')

  return (
    <div className="flex min-h-screen">
      <Sidebar gymName={org?.name} orgPlan={org?.platform_plan} />
      <AttendanceClient todayCheckIns={(todayCheckIns ?? []) as unknown as any[]} />
    </div>
  )
}
