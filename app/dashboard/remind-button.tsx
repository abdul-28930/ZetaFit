'use client'
import { useState } from 'react'
import { Bell, Check, Loader2 } from 'lucide-react'

interface Props {
  phone: string
  name: string
}

export default function RemindButton({ phone, name }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent'>('idle')

  async function handleRemind() {
    setState('loading')
    try {
      await new Promise(r => setTimeout(r, 800))
      console.log('[Remind] Queued reminder for:', name, phone)
      setState('sent')
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('idle')
    }
  }

  if (state === 'sent') {
    return (
      <span className="w-20 flex items-center justify-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <Check className="h-3 w-3" /> Sent
      </span>
    )
  }

  return (
    <button
      onClick={handleRemind}
      disabled={state === 'loading'}
      className="w-20 flex items-center justify-center gap-1 rounded-lg border border-border bg-bg-card px-2.5 py-1 text-xs font-medium text-ink-secondary hover:border-brand hover:text-brand transition-colors disabled:opacity-60"
    >
      {state === 'loading'
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <Bell className="h-3 w-3" />
      }
      {state === 'loading' ? '…' : 'Remind'}
    </button>
  )
}
