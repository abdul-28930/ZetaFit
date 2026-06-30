// lib/invoice.ts
//
// Enqueues a job for the FastAPI poller to pick up, instead of calling
// the FastAPI HTTP endpoint directly. This means invoice generation
// survives the tunnel being briefly down -- the job just waits in the
// queue until the poller comes back and picks it up.
//
// Requires a service-role Supabase client since the `jobs` table has
// no public INSERT policy by design.

import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

export async function triggerInvoiceGeneration(paymentId: string, organizationId?: string) {
  try {
    const supabase = getServiceClient()
    const { error } = await supabase.from('jobs').insert({
      type: 'generate_invoice',
      payload: { payment_id: paymentId },
      organization_id: organizationId ?? null,
      idempotency_key: `invoice-${paymentId}`,
    })

    if (error) {
      // Unique violation on idempotency_key just means a job for this
      // payment already exists -- that's fine, not a real error.
      if (error.code === '23505') {
        console.log('[Invoice] Job already queued for payment:', paymentId)
        return
      }
      console.error('[Invoice] Failed to enqueue job:', error.message)
      return
    }

    console.log('[Invoice] Job enqueued for payment:', paymentId)
  } catch (err) {
    console.error('[Invoice] Enqueue error:', err)
  }
}
