// lib/invoice.ts
// Fire-and-forget trigger to the FastAPI invoice service.
// Call this after a payment row is successfully inserted.

export async function triggerInvoiceGeneration(paymentId: string) {
  const url = process.env.FASTAPI_URL
  const secret = process.env.FASTAPI_SECRET

  if (!url) {
    console.warn('[Invoice] FASTAPI_URL not set, skipping invoice generation')
    return
  }

  // Fire-and-forget: don't await/block the response to the client.
  // If this fails, the payment still succeeds — invoice can be
  // regenerated later by re-calling this with the same payment_id.
  fetch(`${url}/api/invoice/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ payment_id: paymentId }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text()
        console.error('[Invoice] Generation failed:', res.status, text)
      } else {
        console.log('[Invoice] Generation triggered for payment:', paymentId)
      }
    })
    .catch((err) => {
      console.error('[Invoice] Request error:', err)
    })
}
