import { cn } from '@/lib/utils'

// --- status → semantic tone -------------------------------------------------

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const TONES: Record<Tone, { bar: string; stroke: string; text: string; dot: string }> = {
  success: { bar: 'bg-emerald-500', stroke: 'stroke-emerald-500', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  warning: { bar: 'bg-amber-500', stroke: 'stroke-amber-500', text: 'text-amber-600', dot: 'bg-amber-500' },
  danger: { bar: 'bg-red-500', stroke: 'stroke-red-500', text: 'text-red-600', dot: 'bg-red-500' },
  neutral: { bar: 'bg-slate-400', stroke: 'stroke-slate-400', text: 'text-slate-500', dot: 'bg-slate-400' },
  info: { bar: 'bg-blue-500', stroke: 'stroke-blue-500', text: 'text-blue-600', dot: 'bg-blue-500' },
}

const STATUS_SEMANTIC: Record<string, Tone> = {
  // green
  ACTIVE: 'success',
  AVAILABLE: 'success',
  COMPLETED: 'success',
  APPROVED: 'success',
  VALID: 'success',
  PAID: 'success',
  // amber
  PLANNED: 'warning',
  SCHEDULED: 'warning',
  ON_HOLD: 'warning',
  ASSIGNED: 'warning',
  IN_USE: 'warning',
  ON_LEAVE: 'warning',
  SICK: 'warning',
  CONSUMED: 'warning',
  PARTIALLY_PAID: 'warning',
  COSTING_REVIEW: 'warning',
  READY_FOR_INVOICE: 'warning',
  INVOICED: 'warning',
  EXPIRING_30: 'warning',
  EXPIRING_60: 'warning',
  EXPIRING_90: 'warning',
  // red
  EXPIRED: 'danger',
  TERMINATED: 'danger',
  MAINTENANCE: 'danger',
  OUT_OF_SERVICE: 'danger',
  // neutral
  DRAFT: 'neutral',
  CLOSED: 'neutral',
  INACTIVE: 'neutral',
  CANCELLED: 'neutral',
  NO_EXPIRY: 'neutral',
}

export function statusTone(status: string) {
  return TONES[STATUS_SEMANTIC[status] ?? 'info']
}

export function toneOf(tone: Tone) {
  return TONES[tone]
}

function humanize(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function segmentsFromStatusMap(data: Record<string, number>): DonutSegment[] {
  return Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([status, value]) => ({
      label: humanize(status),
      value,
      tone: STATUS_SEMANTIC[status] ?? 'info',
    }))
}

/** Utilization → tone: <=75% healthy, <=100% busy, >100% overbooked. */
export function utilizationTone(pct: number): Tone {
  if (pct > 100) return 'danger'
  if (pct > 75) return 'warning'
  return 'success'
}

// --- proportional horizontal bars -------------------------------------------

export function BarBreakdown({
  data,
  emptyLabel = 'No data',
}: {
  data: Record<string, number>
  emptyLabel?: string
}) {
  const entries = Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, v]) => sum + v, 0)

  if (entries.length === 0) {
    return <p className="py-4 text-sm text-slate-400">{emptyLabel}</p>
  }

  return (
    <div className="space-y-3">
      {entries.map(([status, count]) => {
        const tone = statusTone(status)
        const pct = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={status}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className={cn('h-2 w-2 rounded-full', tone.dot)} />
                {humanize(status)}
              </span>
              <span className="font-medium tabular-nums text-slate-700">{count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${Math.max(pct, 3)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- utilization bar (capped at 100%, color by load) ------------------------

export function UtilizationBar({ pct, width = 'w-28' }: { pct: number; width?: string }) {
  const capped = Math.min(pct, 100)
  const tone = toneOf(utilizationTone(pct))
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-2 overflow-hidden rounded-full bg-slate-100', width)}>
        <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${capped}%` }} />
      </div>
      <span className={cn('text-xs font-medium tabular-nums', tone.text)}>{pct}%</span>
    </div>
  )
}

// --- SVG donut --------------------------------------------------------------

export interface DonutSegment {
  label: string
  value: number
  tone: Tone
}

export function Donut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[]
  centerValue: number | string
  centerLabel: string
}) {
  const size = 132
  const thickness = 14
  const r = (size - thickness) / 2
  const cx = size / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  let acc = 0

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={cx} cy={cx} r={r} fill="none" strokeWidth={thickness} className="stroke-slate-100" />
          {total > 0 &&
            segments.map((seg) => {
              const frac = seg.value / total
              const dash = frac * circ
              const el = (
                <circle
                  key={seg.label}
                  cx={cx}
                  cy={cx}
                  r={r}
                  fill="none"
                  strokeWidth={thickness}
                  className={toneOf(seg.tone).stroke}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-acc}
                />
              )
              acc += dash
              return el
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-slate-900">{centerValue}</span>
          <span className="text-xs text-slate-400">{centerLabel}</span>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-sm', toneOf(seg.tone).dot)} />
            <span className="text-slate-600">{seg.label}</span>
            <span className="ml-auto font-medium tabular-nums text-slate-700">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- single segmented compliance bar ----------------------------------------

export function SegmentedBar({ segments }: { segments: { value: number; tone: Tone }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) {
    return <div className="h-3 w-full rounded-full bg-slate-100" />
  }
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
      {segments
        .filter((s) => s.value > 0)
        .map((s, i) => (
          <div
            key={i}
            className={cn('h-full', toneOf(s.tone).bar)}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
    </div>
  )
}
