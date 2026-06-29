import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import WorkoutBuilder from './workout-builder'

export default async function WorkoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations(name, platform_plan)')
    .eq('id', user.id)
    .single()

  const org = profile?.organizations as unknown as { name: string; platform_plan: string } | null

  const [{ data: exercises }, { data: members }, { data: savedTemplates }, { data: presetTemplates }] = await Promise.all([
    supabase
      .from('exercises')
      .select('id, name, muscle_group, equipment')
      .order('muscle_group').order('name'),
    supabase
      .from('members')
      .select('id, full_name, initials')
      .is('deleted_at', null)
      .eq('status', 'active')
      .order('full_name'),
    // Gym's own saved templates
    supabase
      .from('workout_templates')
      .select(`id, title, goal, level, created_at, is_preset, preset_category,
        workout_template_items:workout_template_items(id, position, sets, reps, weight, rest_seconds, notes,
          exercises(id, name, muscle_group))`)
      .eq('organization_id', profile?.organization_id ?? '')
      .eq('is_preset', false)
      .order('created_at', { ascending: false }),
    // Global preset templates
    supabase
      .from('workout_templates')
      .select(`id, title, goal, level, preset_category,
        workout_template_items:workout_template_items(id, position, sets, reps, weight, rest_seconds, notes,
          exercises(id, name, muscle_group))`)
      .eq('is_preset', true)
      .order('preset_category').order('title'),
  ])

  // Expiring count for sidebar
  const today = new Date().toISOString().split('T')[0]
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const { data: expiringData } = await supabase
    .from('member_subscriptions')
    .select('id')
    .gte('end_date', today)
    .lte('end_date', in7Days)
    .eq('status', 'active')

  return (
    <div className="flex min-h-screen">
      <Sidebar gymName={org?.name} orgPlan={org?.platform_plan} expiringCount={expiringData?.length ?? 0} />
      <WorkoutBuilder
        exercises={exercises ?? []}
        members={members ?? []}
        savedTemplates={(savedTemplates ?? []) as any[]}
        presetTemplates={(presetTemplates ?? []) as any[]}
        trainerId={user.id}
      />
    </div>
  )
}
