import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  console.log('[POST /api/members/:id/renew] Called, id:', id)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 403 })
    }

    const orgId = profile.organization_id
    const body = await request.json()
    const { plan_id, payment_method, amount_paid } = body

    console.log('[Renew] Plan:', plan_id, 'Method:', payment_method, 'Amount:', amount_paid)

    if (!plan_id) {
      return NextResponse.json({ error: 'Plan is required' }, { status: 400 })
    }

    // Verify member belongs to this org
    const { data: member } = await supabase
      .from('members')
      .select('id, full_name')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Get plan details
    const { data: plan } = await supabase
      .from('membership_plans')
      .select('id, name, duration_days, price, gst_rate')
      .eq('id', plan_id)
      .eq('organization_id', orgId)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Calculate new subscription dates — starts today
    const startDate = new Date().toISOString().split('T')[0]
    const endDate = new Date(Date.now() + plan.duration_days * 86400000).toISOString().split('T')[0]

    console.log('[Renew] New subscription:', startDate, '→', endDate)

    // Expire old active subscriptions for this member
    await supabase
      .from('member_subscriptions')
      .update({ status: 'expired' })
      .eq('member_id', id)
      .eq('status', 'active')

    // Create new subscription
    const { data: subscription, error: subError } = await supabase
      .from('member_subscriptions')
      .insert({
        organization_id: orgId,
        member_id: id,
        plan_id: plan.id,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
      })
      .select()
      .single()

    if (subError || !subscription) {
      console.log('[Renew] Subscription error:', subError?.message)
      return NextResponse.json({ error: subError?.message ?? 'Failed to create subscription' }, { status: 500 })
    }

    // Update member status to active
    await supabase
      .from('members')
      .update({ status: 'active' })
      .eq('id', id)

    // Record payment if amount provided
    if (amount_paid && Number(amount_paid) > 0) {
      const total = Number(amount_paid)
      const gstRate = plan.gst_rate ?? 18
      const gstAmount = parseFloat((total - total / (1 + gstRate / 100)).toFixed(2))
      const baseAmount = parseFloat((total - gstAmount).toFixed(2))

      const { error: payError } = await supabase
        .from('payments')
        .insert({
          organization_id: orgId,
          member_id: id,
          subscription_id: subscription.id,
          amount: baseAmount,
          gst_amount: gstAmount,
          discount_amount: 0,
          payment_method: payment_method ?? 'cash',
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          invoice_number: `INV-${Date.now()}`,
        })

      if (payError) {
        console.log('[Renew] Payment error (non-fatal):', payError.message)
      }
    }

    const daysRemaining = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)

    console.log('[Renew] Done ✅', member.full_name, '→', plan.name, 'until', endDate)

    return NextResponse.json({
      success: true,
      end_date: endDate,
      days_remaining: daysRemaining,
      plan_name: plan.name,
    })

  } catch (err) {
    console.error('[Renew] Unexpected:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
