import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/payments/[id]
// Used by payments-client.tsx to poll for the invoice_pdf_url once the
// fire-and-forget FastAPI invoice generation has had time to finish.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: payment, error } = await supabase
    .from('payments')
    .select('id, invoice_number, invoice_pdf_url, payment_status')
    .eq('id', id)
    .single()

  if (error || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  return NextResponse.json({ payment })
}
