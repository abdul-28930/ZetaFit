import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerInvoiceGeneration } from '@/lib/invoice'

export async function POST(request: NextRequest) {
  console.log('[POST /api/payments] Called')
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
      return NextResponse.json({ error: 'No organization found' }, { status: 403 })
    }
    const orgId = profile.organization_id
    const body = await request.json()
    const { member_id, amount, payment_method, notes } = body
    console.log('[POST /api/payments] Body:', { member_id, amount, payment_method })
    if (!member_id || !amount) {
      return NextResponse.json({ error: 'Member and amount are required' }, { status: 400 })
    }
    // Verify member belongs to this org
    const { data: member } = await supabase
      .from('members')
      .select('id, full_name')
      .eq('id', member_id)
      .eq('organization_id', orgId)
      .single()
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    const total = Number(amount)
    const gstRate = 18
    const gstAmount = parseFloat((total - total / (1 + gstRate / 100)).toFixed(2))
    const baseAmount = parseFloat((total - gstAmount).toFixed(2))
    const { data: payment, error: payError } = await supabase
      .from('payments')
      .insert({
        organization_id: orgId,
        member_id,
        amount: baseAmount,
        gst_amount: gstAmount,
        discount_amount: 0,
        payment_method: payment_method ?? 'cash',
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        invoice_number: `INV-${Date.now()}`,
        notes: notes ?? null,
      })
      .select(`
        id, amount, gst_amount, total_amount,
        payment_method, payment_status,
        invoice_number, invoice_pdf_url, paid_at, created_at,
        members(id, full_name, initials)
      `)
      .single()
    if (payError || !payment) {
      console.log('[POST /api/payments] Error:', payError?.message)
      return NextResponse.json({ error: payError?.message ?? 'Failed to record payment' }, { status: 500 })
    }
    console.log('[POST /api/payments] Done Payment:', payment.id)
    triggerInvoiceGeneration(payment.id) // fire-and-forget
    return NextResponse.json({ payment }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/payments] Unexpected error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
