import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { fetchJobCosting, markJobReadyForInvoice, reviewJobCosting } from '@/api/costing.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDateTime } from '@/lib/formatters'
import type { JobCostBreakdown, JobStatus } from '@/types'

const REVENUE_BASIS_LABEL: Record<JobCostBreakdown['revenueBasis'], string> = {
  INVOICED: 'from issued invoices (ex-VAT)',
  JOB_VALUE: 'from the quoted job value',
  NONE: 'not available',
}

function pct(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}%`
}

export function JobCostingPanel({ jobId, status }: { jobId: string; status: JobStatus }) {
  const { hasPermission } = useAuth()
  const canReview = hasPermission('jobs.costing_review')
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['job-costing', jobId],
    queryFn: () => fetchJobCosting(jobId),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['job-costing', jobId] })
    void queryClient.invalidateQueries({ queryKey: ['jobs', jobId] })
    void queryClient.invalidateQueries({ queryKey: ['jobs'] })
  }

  const reviewMutation = useMutation({
    mutationFn: () => reviewJobCosting(jobId),
    onSuccess: () => {
      invalidate()
      toast.success('Cost review saved')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to run cost review')),
  })

  const readyMutation = useMutation({
    mutationFn: () => markJobReadyForInvoice(jobId),
    onSuccess: () => {
      invalidate()
      toast.success('Job marked ready for invoice')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to mark ready for invoice')),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }
  if (error || !data) {
    return <p className="py-16 text-center text-sm text-slate-500">Costing is unavailable for this job.</p>
  }

  const canRunReview = status === 'COMPLETED' || status === 'COSTING_REVIEW'
  const canMarkReady = status === 'COSTING_REVIEW' && !!data.costReviewedAt
  const profitTone = data.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
  const expenseCategories = Object.entries(data.expensesByCategory)

  return (
    <div className="space-y-4">
      {status === 'COMPLETED' && !data.costReviewedAt ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Figures below are a live preview. Run the cost review to save them and move the job into
          costing review.
        </p>
      ) : null}

      {/* Headline profitability */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue" value={formatCurrency(data.revenue)} hint={REVENUE_BASIS_LABEL[data.revenueBasis]} />
        <Kpi label="Actual cost" value={formatCurrency(data.actualCost)} />
        <Kpi label="Gross profit" value={formatCurrency(data.grossProfit)} tone={profitTone} />
        <Kpi label="Gross margin" value={pct(data.grossMarginPct)} tone={profitTone} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cost breakdown */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Cost breakdown</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Labour (timesheets)" value={formatCurrency(data.labourCost)} />
            <Row label="Vehicles" value={formatCurrency(data.vehicleCost)} />
            <Row label="Equipment" value={formatCurrency(data.equipmentCost)} />
            <Row label="Expenses (posted)" value={formatCurrency(data.expensesTotal)} />
            {expenseCategories.length > 0 ? (
              <div className="pl-4">
                {expenseCategories.map(([cat, amount]) => (
                  <Row key={cat} label={cat.toLowerCase()} value={formatCurrency(amount)} muted />
                ))}
              </div>
            ) : null}
            <div className="border-t border-slate-200 pt-2">
              <Row label="Total actual cost" value={formatCurrency(data.actualCost)} strong />
            </div>
          </dl>
        </div>

        {/* Budget & review status */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Budget & review</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Cost budget" value={formatCurrency(data.costBudget)} />
            <Row
              label="Variance (actual − budget)"
              value={data.costVariance === null ? '—' : formatCurrency(data.costVariance)}
              tone={data.costVariance !== null && data.costVariance > 0 ? 'text-red-700' : undefined}
            />
            <Row
              label="Cost reviewed"
              value={data.costReviewedAt ? formatDateTime(data.costReviewedAt) : 'Not yet reviewed'}
            />
          </dl>

          {data.warnings.length > 0 ? (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Data gaps ({data.warnings.length})
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-800">
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {canReview ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canRunReview ? (
            <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>
              {reviewMutation.isPending ? <Spinner /> : null}
              {data.costReviewedAt ? 'Recompute cost review' : 'Run cost review'}
            </Button>
          ) : null}
          {canMarkReady ? (
            <Button variant="outline" onClick={() => readyMutation.mutate()} disabled={readyMutation.isPending}>
              {readyMutation.isPending ? <Spinner /> : null}
              Mark ready for invoice
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? 'text-slate-900'}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

function Row({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
  tone?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={`${muted ? 'capitalize text-slate-400' : 'text-slate-600'}`}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold text-slate-900' : tone ?? 'text-slate-800'}`}>
        {value}
      </dd>
    </div>
  )
}
