import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Coins, FileWarning, Landmark, PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { Spinner } from '@/components/Spinner'
import { Input } from '@/components/ui/input'
import { BarBreakdown, Donut, type DonutSegment } from '@/components/charts'
import { useAuth } from '@/hooks/useAuth'
import { fetchFinanceDashboard } from '@/api/dashboard.api'
import { formatCurrency } from '@/lib/formatters'
import type { AgingBuckets, FinanceDashboard } from '@/types'

const AGING_LABELS: Record<keyof AgingBuckets, string> = {
  current: 'Current (0–30d)',
  d31_60: '31–60 days',
  d61_90: '61–90 days',
  d90_plus: '90+ days',
}
const AGING_TONES: Record<keyof AgingBuckets, DonutSegment['tone']> = {
  current: 'success',
  d31_60: 'warning',
  d61_90: 'warning',
  d90_plus: 'danger',
}

function firstOfMonthIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function FinanceDashboardPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('dashboard.finance.view')

  const [from, setFrom] = useState(firstOfMonthIso())
  const [to, setTo] = useState(todayIso())

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'finance', { from, to }],
    queryFn: () => fetchFinanceDashboard({ from, to }),
    enabled: canView,
  })

  if (!canView) {
    return <EmptyState title="You do not have access to the finance dashboard." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance dashboard"
        description="Revenue, receivables, profit, expenses, and VAT for the selected period."
        actions={
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </div>
        }
      />

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <FinanceContent data={data} />
      )}
    </div>
  )
}

function FinanceContent({ data }: { data: FinanceDashboard }) {
  const agingSegments: DonutSegment[] = (Object.keys(data.receivables.aging) as (keyof AgingBuckets)[]).map(
    (k) => ({ label: AGING_LABELS[k], value: data.receivables.aging[k], tone: AGING_TONES[k] }),
  )
  const netVatPositive = data.vat.net >= 0

  return (
    <div className="space-y-6">
      {/* Revenue & cash */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Billed revenue" value={formatCurrency(data.revenue.invoicedTotal)} hint="issued invoices (incl. VAT)" icon={Banknote} tone="blue" />
        <Kpi label="Collected" value={formatCurrency(data.revenue.collected)} hint="payments received" icon={Wallet} tone="emerald" />
        <Kpi label="Outstanding" value={formatCurrency(data.receivables.totalOutstanding)} hint="all unpaid invoices" icon={Coins} tone="amber" />
        <Kpi label="Overdue" value={formatCurrency(data.receivables.overdueAmount)} hint="past due date" icon={FileWarning} tone={data.receivables.overdueAmount > 0 ? 'red' : 'slate'} />
      </div>

      {/* Profit & expenses */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Gross profit"
          value={formatCurrency(data.profit.grossProfit)}
          hint={`${data.profit.jobsReviewed} job(s) cost-reviewed`}
          icon={TrendingUp}
          tone={data.profit.grossProfit >= 0 ? 'emerald' : 'red'}
        />
        <Kpi
          label="Avg margin"
          value={data.profit.avgMarginPct === null ? '—' : `${data.profit.avgMarginPct.toFixed(1)}%`}
          icon={PiggyBank}
          tone="violet"
        />
        <Kpi label="Expenses posted" value={formatCurrency(data.expenses.total)} icon={Receipt} tone="slate" />
        <Kpi
          label="Net VAT"
          value={formatCurrency(data.vat.net)}
          hint={netVatPositive ? 'payable to ZATCA' : 'reclaimable'}
          icon={Landmark}
          tone={netVatPositive ? 'amber' : 'emerald'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Receivables aging">
          <Donut
            segments={agingSegments}
            centerValue={formatCurrency(data.receivables.totalOutstanding)}
            centerLabel="outstanding"
          />
        </Panel>
        <Panel title="Invoices by status">
          <BarBreakdown data={data.invoicesByStatus} emptyLabel="No invoices yet" />
        </Panel>
        <Panel title="Expenses by category">
          {Object.keys(data.expenses.byCategory).length === 0 ? (
            <p className="py-4 text-sm text-slate-400">No posted expenses in this period</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {Object.entries(data.expenses.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <dt className="capitalize text-slate-600">{cat.toLowerCase().replace(/_/g, ' ')}</dt>
                    <dd className="tabular-nums text-slate-800">{formatCurrency(amount)}</dd>
                  </div>
                ))}
            </dl>
          )}
        </Panel>
      </div>

      {/* VAT + unbilled summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Output VAT (on sales)" value={formatCurrency(data.vat.output)} />
        <MiniStat label="Input VAT (on expenses)" value={formatCurrency(data.vat.input)} />
        <MiniStat
          label="Unbilled completed work"
          value={formatCurrency(data.unbilled.value)}
          hint={`${data.unbilled.count} job(s) not yet invoiced`}
        />
      </div>
    </div>
  )
}

const KPI_TONES: Record<string, { bg: string; icon: string; value: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', value: 'text-slate-900' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', value: 'text-slate-900' },
  red: { bg: 'bg-red-50', icon: 'text-red-600', value: 'text-red-700' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', value: 'text-slate-900' },
  slate: { bg: 'bg-slate-100', icon: 'text-slate-600', value: 'text-slate-900' },
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'slate',
}: {
  label: string
  value: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: keyof typeof KPI_TONES
}) {
  const t = KPI_TONES[tone]
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.bg}`}>
          <Icon className={`h-5 w-5 ${t.icon}`} />
        </span>
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${t.value}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </div>
  )
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}
