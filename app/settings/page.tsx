import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  console.log('[Settings] Rendering...')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, organization_id, organizations(*)')
    .eq('id', user.id)
    .single()

  const org = profile?.organizations as unknown as Record<string, any> | null
  console.log('[Settings] Org:', org?.name)

  return (
    <div className="flex min-h-screen">
      <Sidebar gymName={org?.name} orgPlan={org?.platform_plan} />
      <SettingsClient org={org} userFullName={profile?.full_name ?? ''} />
    </div>
  )
}
