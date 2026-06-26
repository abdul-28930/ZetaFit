import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import PaymentsClient from './payments-client'

export default async function PaymentsPage() {
  console.log('[Payments] Rendering...')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations(name, platform_plan)')
    .eq('id', user.id)
    .single()

  const org = profile?.organizations as unknown as { name: string; platform_plan: string } | null

  const [{ data: payments }, { data: members }] = await Promise.all([
    supabase.from('payments').select(`id, amount, gst_amount, total_amount, payment_method, payment_status, invoice_number, paid_at, created_at, members(id, full_name, initials)`).order('created_at', { ascending: false }),
    supabase.from('members').select('id, full_name, initials').is('deleted_at', null).eq('status', 'active').order('full_name'),
  ])

  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: monthStats } = await supabase.from('payments').select('total_amount, payment_status').gte('created_at', firstOfMonth)

  const collectedThisMonth = (monthStats ?? []).filter(p => p.payment_status === 'paid').reduce((s, p) => s + (p.total_amount ?? 0), 0)
  const pendingDues = (monthStats ?? []).filter(p => p.payment_status === 'pending').reduce((s, p) => s + (p.total_amount ?? 0), 0)

  console.log('[Payments] Fetched:', payments?.length ?? 0, 'payments')

  return (
    <div className="flex min-h-screen">
      <Sidebar gymName={org?.name} orgPlan={org?.platform_plan} />
      <PaymentsClient payments={(payments ?? []) as unknown as any[]} members={members ?? []} collectedThisMonth={collectedThisMonth} pendingDues={pendingDues} />
    </div>
  )
}
