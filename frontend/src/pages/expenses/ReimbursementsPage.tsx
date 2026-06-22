import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Spinner } from '@/components/Spinner'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { fetchReimbursementSummary } from '@/api/expenses.api'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { ExpenseSummary } from '@/types'
import { ReimburseDialog } from './ReimburseDialog'

export function ReimbursementsPage() {
  const { hasPermission } = useAuth()
  const canApprove = hasPermission('expenses.approve')
  const [reimbursing, setReimbursing] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reimbursements'],
    queryFn: fetchReimbursementSummary,
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursements"
        description="Approved out-of-pocket expenses grouped by employee. Compensate, delay, or decline each one."
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase text-slate-500">Total outstanding to employees</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(data?.totalOwed ?? 0)}</p>
      </div>

      {!data || data.employees.length === 0 ? (
        <EmptyState title="No reimbursable expenses" description="Approved reimbursable expenses will appear here." />
      ) : (
        <div className="space-y-6">
          {data.employees.map((group) => (
            <div key={group.employee.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-slate-500" />
                  <span className="font-medium text-slate-900">{group.employee.name}</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <span>Owed: <span className="font-medium text-slate-900">{formatCurrency(group.totalOwed)}</span></span>
                  <span>Pending: {formatCurrency(group.pending)}</span>
                  <span>Delayed: {formatCurrency(group.delayed)}</span>
                  <span>Compensated: {formatCurrency(group.compensated)}</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2 font-semibold">Date</th>
                    <th className="px-4 py-2 font-semibold">Category</th>
                    <th className="px-4 py-2 font-semibold">Amount</th>
                    <th className="px-4 py-2 font-semibold">Reimbursement</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {group.expenses.map((e: ExpenseSummary) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <Link to={`/expenses/${e.id}`} className="text-brand-600 hover:underline">{formatDate(e.expenseDate)}</Link>
                      </td>
                      <td className="px-4 py-2 capitalize">{e.category.replace(/_/g, ' ').toLowerCase()}</td>
                      <td className="px-4 py-2 font-medium">{formatCurrency(e.totalAmount, e.currency)}</td>
                      <td className="px-4 py-2"><StatusBadge status={e.reimbursementStatus} /></td>
                      <td className="px-4 py-2 text-right">
                        {canApprove ? (
                          <Button variant="outline" size="sm" onClick={() => setReimbursing(e.id)}>Update</Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {reimbursing ? (
        <ReimburseDialog
          open={!!reimbursing}
          onOpenChange={(o) => !o && setReimbursing(null)}
          expenseId={reimbursing}
          onDone={() => void refetch()}
        />
      ) : null}
    </div>
  )
}
