'use client'
import { useState } from 'react'
import {
  Search, CheckCircle2, XCircle, Phone,
  CalendarCheck, Clock, ScanLine, Loader2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CheckIn {
  id: string
  checked_in_at: string
  result: string
  method: string
  members: any
}

interface CheckInResult {
  result: 'allowed' | 'blocked'
  member: {
    id: string
    full_name: string
    initials: string
    phone: string
    plan_name: string | null
    end_date: string | null
    days_remaining: number | null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(name: string) {
  const colors = ['#1D9E75', '#378ADD', '#5B53C6', '#C2587A', '#E08A3C', '#0F6E56']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AttendanceClient({ todayCheckIns: initial }: { todayCheckIns: CheckIn[] }) {
  const [phone, setPhone] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState('')
  const [todayCheckIns, setTodayCheckIns] = useState<CheckIn[]>(initial)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return

    setSearching(true)
    setResult(null)
    setError('')
    console.log('[Attendance] Searching phone:', phone)

    const res = await fetch('/api/attendance/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim(), method: 'phone' }),
    })

    const json = await res.json()
    console.log('[Attendance] Check-in result:', json)

    if (!res.ok) {
      setError(json.error ?? 'Member not found')
      setSearching(false)
      return
    }

    setResult(json)

    // Add to today's log immediately
    if (json.result && json.member) {
      const newCheckIn: CheckIn = {
        id: Date.now().toString(),
        checked_in_at: new Date().toISOString(),
        result: json.result,
        method: 'phone',
        members: {
          id: json.member.id,
          full_name: json.member.full_name,
          initials: json.member.initials,
        },
      }
      setTodayCheckIns(prev => [newCheckIn, ...prev])
    }

    setSearching(false)
  }

  function clearResult() {
    setResult(null)
    setError('')
    setPhone('')
  }

  const isAllowed = result?.result === 'allowed'

  return (
    <main className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Attendance</h1>
        <p className="mt-0.5 text-sm text-ink-muted">Search by phone number to check in a member</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Left — search + result */}
        <div className="flex flex-col gap-4">
          {/* Search box */}
          <div className="rounded-xl border border-border bg-bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-ink">Member check-in</p>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Enter phone number…"
                  type="tel"
                  className="h-11 w-full rounded-lg border border-border-medium bg-bg-input pl-10 pr-3 text-sm text-ink focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand-light/30"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !phone.trim()}
                className="flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
              >
                {searching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Search className="h-4 w-4" />
                }
                {searching ? 'Checking…' : 'Check in'}
              </button>
            </form>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3">
                <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Result card */}
          {result && (
            <div className={`rounded-xl border-2 p-5 shadow-sm ${isAllowed ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow"
                    style={{ background: avatarColor(result.member.full_name) }}
                  >
                    {result.member.initials}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink">{result.member.full_name}</p>
                    <p className="text-sm text-ink-secondary">{result.member.phone}</p>
                  </div>
                </div>

                {/* Allow / Block badge */}
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${isAllowed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  {isAllowed
                    ? <><CheckCircle2 className="h-4 w-4" /> ALLOWED</>
                    : <><XCircle className="h-4 w-4" /> BLOCKED</>
                  }
                </div>
              </div>

              {/* Details */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: 'Plan', value: result.member.plan_name ?? 'No plan' },
                  { label: 'Expires', value: formatDate(result.member.end_date) },
                  { label: 'Days left', value: result.member.days_remaining !== null ? `${result.member.days_remaining}d` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-white/70 p-2.5 text-center">
                    <p className="text-xs text-ink-muted">{label}</p>
                    <p className={`mt-0.5 text-sm font-semibold ${!isAllowed ? 'text-red-700' : 'text-ink'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {!isAllowed && (
                <p className="mt-3 text-sm font-medium text-red-700">
                  ⚠️ Membership expired or inactive. Ask member to renew before entry.
                </p>
              )}

              <button
                onClick={clearResult}
                className="mt-4 w-full rounded-lg border border-current py-2 text-sm font-semibold text-ink-secondary hover:bg-white/50"
              >
                Clear · scan next member
              </button>
            </div>
          )}

          {/* Empty state — no search yet */}
          {!result && !error && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-medium py-14">
              <ScanLine className="h-10 w-10 text-ink-muted mb-3" />
              <p className="text-sm font-medium text-ink">Enter a phone number to check in</p>
              <p className="mt-1 text-xs text-ink-muted">The system will verify membership and log attendance</p>
            </div>
          )}
        </div>

        {/* Right — today's log */}
        <div className="rounded-xl border border-border bg-bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-brand" />
              <span className="text-sm font-semibold text-ink">Today's check-ins</span>
            </div>
            <span className="rounded-full bg-brand-muted px-2.5 py-0.5 text-xs font-bold text-brand">
              {todayCheckIns.length}
            </span>
          </div>

          {todayCheckIns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Clock className="h-8 w-8 text-ink-muted mb-2" />
              <p className="text-sm text-ink-muted">No check-ins yet today</p>
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-[480px] overflow-y-auto">
              {todayCheckIns.map(c => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: avatarColor(c.members?.full_name ?? '') }}
                  >
                    {c.members?.initials ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.members?.full_name ?? 'Unknown'}</p>
                    <p className="text-xs capitalize text-ink-muted">{c.method}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-ink-muted">{formatTime(c.checked_in_at)}</span>
                    {c.result === 'allowed'
                      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : <XCircle className="h-4 w-4 text-red-500" />
                    }
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
