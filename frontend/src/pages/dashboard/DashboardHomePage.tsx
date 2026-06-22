import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  CalendarClock,
  FileWarning,
  HardHat,
  ScrollText,
  ShieldCheck,
  Truck,
  UsersRound,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { fetchAssetsDashboard, fetchOperationsDashboard } from '@/api/dashboard.api'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  BarBreakdown,
  Donut,
  type DonutSegment,
  UtilizationBar,
  segmentsFromStatusMap,
} from '@/components/charts'
import type { ResourceType } from '@/types'

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  EMPLOYEE: 'Employee',
  CREW: 'Crew',
  VEHICLE: 'Vehicle',
  EQUIPMENT: 'Equipment',
}

type KpiTone = 'emerald' | 'blue' | 'amber' | 'red' | 'slate' | 'violet'

const KPI_TONES: Record<KpiTone, { iconBg: string; icon: string; value: string }> = {
  emerald: { iconBg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-600' },
  blue: { iconBg: 'bg-blue-50', icon: 'text-blue-600', value: 'text-slate-900' },
  amber: { iconBg: 'bg-amber-50', icon: 'text-amber-600', value: 'text-amber-600' },
  red: { iconBg: 'bg-red-50', icon: 'text-red-600', value: 'text-red-600' },
  slate: { iconBg: 'bg-slate-100', icon: 'text-slate-500', value: 'text-slate-900' },
  violet: { iconBg: 'bg-violet-50', icon: 'text-violet-600', value: 'text-slate-900' },
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'slate',
  to,
}: {
  label: string
  value: number | string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: KpiTone
  to?: string
}) {
  const t = KPI_TONES[tone]
  const inner = (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', t.iconBg)}>
          <Icon className={cn('h-5 w-5', t.icon)} />
        </span>
      </div>
      <p className={cn('mt-3 text-3xl font-semibold tabular-nums', t.value)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
  return to ? (
    <Link to={to} className="block">
      {inner}
    </Link>
  ) : (
    inner
  )
}

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</h2>
  )
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const ms = new Date(date).getTime() - Date.now()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function ExpiryPill({ date }: { date: string | null }) {
  const days = daysUntil(date)
  if (days === null) return <span className="text-xs text-slate-400">No expiry</span>
  if (days < 0)
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        {Math.abs(days)}d overdue
      </span>
    )
  const tone = days <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tone)}>in {days}d</span>
}

export function DashboardHomePage() {
  const { user, hasPermission } = useAuth()
  const canViewOps = hasPermission('dashboard.operations.view')
  const canViewAssets = hasPermission('dashboard.assets.view')

  const { data: ops, isLoading: opsLoading } = useQuery({
    queryKey: ['dashboard', 'operations'],
    queryFn: fetchOperationsDashboard,
    enabled: canViewOps,
  })

  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ['dashboard', 'assets'],
    queryFn: fetchAssetsDashboard,
    enabled: canViewAssets,
  })

  const totalAssignments = ops
    ? Object.values(ops.assignmentsByStatus).reduce((a, b) => a + b, 0)
    : 0
  const totalJobs = ops ? Object.values(ops.jobsByStatus).reduce((a, b) => a + b, 0) : 0

  const docsAttention = assets
    ? assets.documentExpiry.expired + assets.documentExpiry.expiring30
    : 0

  const complianceSegments: DonutSegment[] = assets
    ? [
        { label: 'Valid', value: assets.documentExpiry.valid, tone: 'success' },
        {
          label: 'Expiring (≤90d)',
          value:
            assets.documentExpiry.expiring30 +
            assets.documentExpiry.expiring60 +
            assets.documentExpiry.expiring90,
          tone: 'warning',
        },
        { label: 'Expired', value: assets.documentExpiry.expired, tone: 'danger' },
        { label: 'No expiry', value: assets.documentExpiry.noExpiry, tone: 'neutral' },
      ]
    : []

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${user?.name ?? ''}`}
        description="Operational snapshot across jobs, scheduling, resources, and compliance."
      />

      {!canViewOps && !canViewAssets ? (
        <p className="text-sm text-slate-500">You don't have access to dashboard metrics.</p>
      ) : null}

      {/* ---------------------------------------------------------------- Operations */}
      {canViewOps ? (
        <section className="space-y-4">
          <SectionTitle>Operations</SectionTitle>

          {opsLoading || !ops ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Active jobs"
                  value={ops.activeJobs}
                  hint={`${totalJobs} jobs total`}
                  icon={Briefcase}
                  tone="emerald"
                  to="/jobs"
                />
                <KpiCard
                  label="Starting in 30 days"
                  value={ops.upcomingJobs}
                  icon={CalendarClock}
                  tone="blue"
                  to="/jobs"
                />
                <KpiCard
                  label="Contracts near expiry"
                  value={ops.contractsNearExpiry}
                  hint="within 60 days"
                  icon={ScrollText}
                  tone={ops.contractsNearExpiry > 0 ? 'amber' : 'slate'}
                  to="/contracts"
                />
                <KpiCard
                  label="POs near expiry"
                  value={ops.posNearExpiry}
                  hint="within 60 days"
                  icon={FileWarning}
                  tone={ops.posNearExpiry > 0 ? 'amber' : 'slate'}
                  to="/purchase-orders"
                />
              </div>

              <div className="grid items-start gap-4 lg:grid-cols-3">
                <Panel title="Jobs by status">
                  <BarBreakdown data={ops.jobsByStatus} />
                </Panel>

                {/* Middle column stacks the two short cards so it fills the
                    height next to the tall "Jobs by status" list. */}
                <div className="space-y-4">
                  <Panel title="Assignments">
                    <Donut
                      segments={segmentsFromStatusMap(ops.assignmentsByStatus)}
                      centerValue={totalAssignments}
                      centerLabel="bookings"
                    />
                  </Panel>

                  <Panel
                    title="Resource utilization · next 14 days"
                    action={
                      <Link to="/scheduling" className="text-xs font-medium text-blue-600 hover:underline">
                        Open scheduling
                      </Link>
                    }
                  >
                    {ops.topUtilization.length === 0 ? (
                      <p className="py-2 text-sm text-slate-400">No resources booked in this window</p>
                    ) : (
                      <ul className="space-y-3">
                        {ops.topUtilization.map((r) => (
                          <li key={`${r.resourceType}-${r.resourceId}`} className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-700">{r.name}</p>
                              <p className="text-xs text-slate-400">
                                {RESOURCE_TYPE_LABELS[r.resourceType]} · {r.assignmentCount} booking
                                {r.assignmentCount === 1 ? '' : 's'} · {r.assignedHours}h
                              </p>
                            </div>
                            <UtilizationBar pct={r.utilizationPct} width="w-32" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </div>

                <Panel
                  title="Recent jobs"
                  action={
                    <Link to="/jobs" className="text-xs font-medium text-blue-600 hover:underline">
                      View all
                    </Link>
                  }
                >
                  <ul className="divide-y divide-slate-100">
                    {ops.recentJobs.map((job) => (
                      <li key={job.id} className="flex items-center justify-between gap-2 py-2">
                        <Link to={`/jobs/${job.id}`} className="min-w-0">
                          <p className="truncate text-sm font-medium text-blue-700 hover:underline">
                            {job.jobCode}
                          </p>
                          <p className="truncate text-xs text-slate-500">{job.client.name}</p>
                        </Link>
                        <StatusBadge status={job.status} />
                      </li>
                    ))}
                    {ops.recentJobs.length === 0 ? (
                      <li className="py-3 text-sm text-slate-400">No jobs yet</li>
                    ) : null}
                  </ul>
                </Panel>
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* ----------------------------------------------------- Resources & compliance */}
      {canViewAssets ? (
        <section className="space-y-4">
          <SectionTitle>Resources &amp; compliance</SectionTitle>

          {assetsLoading || !assets ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Employees" value={assets.resourceCounts.employees} icon={HardHat} tone="violet" to="/resources/employees" />
                <KpiCard label="Crews" value={assets.resourceCounts.crews} icon={UsersRound} tone="violet" to="/resources/crews" />
                <KpiCard label="Vehicles" value={assets.resourceCounts.vehicles} icon={Truck} tone="violet" to="/resources/vehicles" />
                <KpiCard
                  label="Docs needing attention"
                  value={docsAttention}
                  hint="expired or ≤30 days"
                  icon={FileWarning}
                  tone={docsAttention > 0 ? 'red' : 'slate'}
                  to="/documents"
                />
              </div>

              <div className="grid items-start gap-4 lg:grid-cols-3">
                <Panel title="Vehicles by status">
                  <Donut
                    segments={segmentsFromStatusMap(assets.vehiclesByStatus)}
                    centerValue={assets.resourceCounts.vehicles}
                    centerLabel="vehicles"
                  />
                </Panel>

                <Panel title="Equipment by status">
                  <Donut
                    segments={segmentsFromStatusMap(assets.equipmentByStatus)}
                    centerValue={assets.resourceCounts.equipment}
                    centerLabel="equipment"
                  />
                </Panel>

                <Panel title="Document compliance">
                  <Donut
                    segments={complianceSegments}
                    centerValue={assets.documentExpiry.total}
                    centerLabel="documents"
                  />
                </Panel>
              </div>

              <Panel
                title="Documents expiring soon"
                action={<ShieldCheck className="h-4 w-4 text-slate-400" />}
              >
                <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                  {assets.expiringSoon.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <Link to="/documents" className="text-sm font-medium text-blue-700 hover:underline">
                          {doc.documentType}
                        </Link>
                        <p className="truncate text-xs text-slate-500">
                          {doc.relatedEntityType.toLowerCase()} · {doc.record}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-slate-500">{formatDate(doc.expiryDate)}</span>
                        <ExpiryPill date={doc.expiryDate} />
                      </div>
                    </li>
                  ))}
                  {assets.expiringSoon.length === 0 ? (
                    <li className="py-3 text-sm text-slate-400">Nothing expiring in the next 90 days</li>
                  ) : null}
                </ul>
              </Panel>
            </>
          )}
        </section>
      ) : null}
    </div>
  )
}
