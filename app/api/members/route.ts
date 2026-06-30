import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerInvoiceGeneration } from '@/lib/invoice'

export async function POST(request: NextRequest) {
  console.log('[POST /api/members] Called')
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('[POST /api/members] Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get org
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      console.log('[POST /api/members] No org found')
      return NextResponse.json({ error: 'No organization found' }, { status: 403 })
    }

    const orgId = profile.organization_id
    const body = await request.json()
    const { full_name, phone, email, plan_id, payment_method, amount_paid } = body

    console.log('[POST /api/members] Body:', { full_name, phone, plan_id, payment_method, amount_paid })

    if (!full_name || !phone || !plan_id) {
      return NextResponse.json({ error: 'Name, phone and plan are required' }, { status: 400 })
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('membership_plans')
      .select('id, duration_days, price, gst_rate, name')
      .eq('id', plan_id)
      .eq('organization_id', orgId)
      .single()

    if (planError || !plan) {
      console.log('[POST /api/members] Plan not found:', planError?.message)
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    console.log('[POST /api/members] Plan:', plan.name, plan.duration_days, 'days')

    // Create member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        organization_id: orgId,
        full_name,
        phone,
        email: email ?? null,
        join_date: new Date().toISOString().split('T')[0],
        status: 'active',
      })
      .select()
      .single()

    if (memberError || !member) {
      console.log('[POST /api/members] Member insert error:', memberError?.message)
      return NextResponse.json({ error: memberError?.message ?? 'Failed to create member' }, { status: 500 })
    }

    console.log('[POST /api/members] Member created:', member.id)

    // Create subscription
    const startDate = new Date().toISOString().split('T')[0]
    const endDate = new Date(Date.now() + plan.duration_days * 86400000).toISOString().split('T')[0]

    const { data: subscription, error: subError } = await supabase
      .from('member_subscriptions')
      .insert({
        organization_id: orgId,
        member_id: member.id,
        plan_id: plan.id,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
      })
      .select()
      .single()

    if (subError) {
      console.log('[POST /api/members] Subscription insert error:', subError.message)
      return NextResponse.json({ error: subError.message }, { status: 500 })
    }

    console.log('[POST /api/members] Subscription created:', subscription.id, '-> expires', endDate)

    // Record payment if amount > 0
    if (amount_paid && Number(amount_paid) > 0) {
      const total = Number(amount_paid)
      const gstRate = plan.gst_rate ?? 18
      const gstAmount = parseFloat((total - total / (1 + gstRate / 100)).toFixed(2))
      const baseAmount = parseFloat((total - gstAmount).toFixed(2))

      const { data: payment, error: payError } = await supabase
        .from('payments')
        .insert({
          organization_id: orgId,
          member_id: member.id,
          subscription_id: subscription.id,
          amount: baseAmount,
          gst_amount: gstAmount,
          discount_amount: 0,
          payment_method: payment_method ?? 'cash',
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          invoice_number: `INV-${Date.now()}`,
        })
        .select()
        .single()

      if (payError) {
        console.log('[POST /api/members] Payment insert error:', payError.message)
        // Non-fatal — member + sub created, just payment failed
      } else {
        console.log('[POST /api/members] Payment recorded:', payment.id)
        triggerInvoiceGeneration(payment.id) // fire-and-forget
      }
    }

    // Return member with subscription info for immediate UI update
    const { data: memberWithSub } = await supabase
      .from('members_with_subscription')
      .select('*')
      .eq('id', member.id)
      .single()

    console.log('[POST /api/members] Done')
    return NextResponse.json({ member: memberWithSub ?? member }, { status: 201 })

  } catch (err) {
    console.error('[POST /api/members] Unexpected error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
