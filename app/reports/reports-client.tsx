'use client'
import {
  IndianRupee, TrendingUp, TrendingDown, Minus,
  CalendarCheck, Users, Download, Clock,
} from 'lucide-react'

interface PlanStat {
  id: string
  name: string
  member_count: number
  price: number
}

interface GrowthPoint {
  month: string
  count: number
}

interface ExpiringMember {
  id: string
  end_date: string
  members: any
  membership_plans: any
}

interface Props {
  planStats: PlanStat[]
  revenueThisMonth: number
  revenueLastMonth: number
  totalAllTime: number
  totalCheckInsThisMonth: number
  monthlyGrowth: GrowthPoint[]
  expiringMembers: ExpiringMember[]
  gymName: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatINR(amount: number) {
  return '₹' + Math.round(amount).toLocaleString('en-IN')
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

const PLAN_COLORS: Record<string, string> = {
  basic: '#9CA3AF',
  standard: '#378ADD',
  premium: '#5B53C6',
}

function planColor(name: string) {
  const n = name.toLowerCase()
  if (n.includes('premium')) return PLAN_COLORS.premium
  if (n.includes('standard')) return PLAN_COLORS.standard
  return PLAN_COLORS.basic
}

// ── CSV export ────────────────────────────────────────────────────────────────
function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Inline bar chart ──────────────────────────────────────────────────────────
function BarChart({ data }: { data: GrowthPoint[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-semibold text-ink">{d.count > 0 ? d.count : ''}</span>
          <div
            className="w-full rounded-t-md bg-brand-light transition-all"
            style={{ height: `${Math.max((d.count / max) * 80, d.count > 0 ? 6 : 2)}px` }}
          />
          <span className="text-[10px] text-ink-muted">{d.month}</span>
        </div>
      ))}
    </div>
  )
}

// ── Donut chart (SVG) ─────────────────────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-full border-8 border-border">
        <span className="text-xs text-ink-muted">0</span>
      </div>
    )
  }

  let offset = 0
  const r = 40
  const c = 2 * Math.PI * r
  const cx = 56, cy = 56

  return (
    <svg viewBox="0 0 112 112" className="w-28 h-28">
      {data.map((d, i) => {
        const dash = (d.value / total) * c
        const gap = c - dash
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={16}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )
        offset += dash
        return el
      })}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={16} fontWeight="700" fill="#1F2937" fontFamily="Inter">
        {total}
      </text>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportsClient({
  planStats, revenueThisMonth, revenueLastMonth,
  totalAllTime, totalCheckInsThisMonth,
  monthlyGrowth, expiringMembers, gymName,
}: Props) {

  const totalMembers = planStats.reduce((s, p) => s + p.member_count, 0)

  const revDiff = revenueLastMonth > 0
    ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
    : null

  const donutData = planStats.map(p => ({
    label: p.name,
    value: p.member_count,
    color: planColor(p.name),
  }))

  function exportMembers() {
    const rows = [
      ['Plan', 'Members', 'Price'],
      ...planStats.map(p => [p.name, String(p.member_count), formatINR(p.price)]),
    ]
    downloadCSV(rows, `${gymName}-plans-${new Date().toISOString().split('T')[0]}.csv`)
  }

  function exportExpiring() {
    const rows = [
      ['Member', 'Phone', 'Plan', 'Expires', 'Days Left'],
      ...expiringMembers.map(m => [
        m.members?.full_name ?? '',
        m.members?.phone ?? '',
        m.membership_plans?.name ?? '',
        formatDate(m.end_date),
        String(daysUntil(m.end_date)),
      ]),
    ]
    downloadCSV(rows, `${gymName}-expiring-${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <main className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Reports</h1>
        <p className="mt-0.5 text-sm text-ink-muted">Overview of your gym's performance</p>
      </div>

      {/* Top stat cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Revenue this month',
            value: formatINR(revenueThisMonth),
            icon: IndianRupee,
            iconBg: 'bg-green-50',
            iconColor: 'text-green-600',
            sub: revDiff !== null
              ? `${revDiff >= 0 ? '+' : ''}${revDiff.toFixed(1)}% vs last month`
              : 'No data last month',
            subColor: revDiff === null ? 'text-ink-muted' : revDiff >= 0 ? 'text-green-600' : 'text-red-500',
          },
          {
            label: 'Revenue last month',
            value: formatINR(revenueLastMonth),
            icon: IndianRupee,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            sub: 'Previous month total',
            subColor: 'text-ink-muted',
          },
          {
            label: 'All time revenue',
            value: formatINR(totalAllTime),
            icon: TrendingUp,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            sub: 'Since gym started',
            subColor: 'text-ink-muted',
          },
          {
            label: 'Check-ins this month',
            value: String(totalCheckInsThisMonth),
            icon: CalendarCheck,
            iconBg: 'bg-brand-muted',
            iconColor: 'text-brand',
            sub: 'Total entries logged',
            subColor: 'text-ink-muted',
          },
        ].map(({ label, value, icon: Icon, iconBg, iconColor, sub, subColor }) => (
          <div key={label} className="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>
                <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
              </div>
              <span className="text-xs font-medium text-ink-muted">{label}</span>
            </div>
            <p className="text-xl font-bold text-ink">{value}</p>
            <p className={`mt-0.5 text-xs ${subColor}`}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Plan distribution */}
        <div className="rounded-xl border border-border bg-bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand" />
              <span className="text-sm font-semibold text-ink">Plan distribution</span>
            </div>
            <button
              onClick={exportMembers}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-bg-page"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>

          <div className="flex items-center gap-6">
            <DonutChart data={donutData} />
            <div className="flex-1 space-y-3">
              {planStats.map(p => (
                <div key={p.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: planColor(p.name) }} />
                      <span className="text-ink-secondary">{p.name}</span>
                    </div>
                    <span className="font-semibold text-ink">{p.member_count}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: totalMembers > 0 ? `${(p.member_count / totalMembers) * 100}%` : '0%',
                        background: planColor(p.name),
                      }}
                    />
                  </div>
                </div>
              ))}
              {planStats.length === 0 && (
                <p className="text-sm text-ink-muted">No plans yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Member growth chart */}
        <div className="rounded-xl border border-border bg-bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-ink">New members · last 6 months</span>
          </div>
          <BarChart data={monthlyGrowth} />
        </div>

        {/* Expiring members */}
        <div className="rounded-xl border border-border bg-bg-card shadow-sm overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-semibold text-ink">Expiring in next 30 days</span>
              <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-bold text-yellow-700">
                {expiringMembers.length}
              </span>
            </div>
            <button
              onClick={exportExpiring}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-bg-page"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>

          {expiringMembers.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-ink-muted">
              No members expiring in the next 30 days 🎉
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div className="hidden grid-cols-[1fr_140px_120px_80px] gap-4 border-b border-border bg-bg-page px-5 py-2.5 lg:grid">
                {['Member', 'Plan', 'Expires', 'Days left'].map(h => (
                  <span key={h} className="text-xs font-medium uppercase tracking-wide text-ink-muted">{h}</span>
                ))}
              </div>
              <ul className="divide-y divide-border">
                {expiringMembers.map((m: any) => {
                  const days = daysUntil(m.end_date)
                  return (
                    <li key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 lg:grid-cols-[1fr_140px_120px_80px]">
                      <div>
                        <p className="text-sm font-medium text-ink">{m.members?.full_name}</p>
                        <p className="text-xs text-ink-muted">{m.members?.phone}</p>
                      </div>
                      <span className="hidden text-sm text-ink-secondary lg:block">{m.membership_plans?.name}</span>
                      <span className="hidden text-sm text-ink-muted lg:block">{formatDate(m.end_date)}</span>
                      <span className={`text-sm font-semibold ${days <= 3 ? 'text-red-500' : days <= 7 ? 'text-orange-500' : 'text-yellow-600'}`}>
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
