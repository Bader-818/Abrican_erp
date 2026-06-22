import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, FileText, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Spinner } from '@/components/Spinner'
import { RejectDialog } from '@/components/RejectDialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import {
  approveExpense,
  fetchExpense,
  fetchExpenseReceipt,
  postExpense,
  rejectExpense,
  submitExpense,
} from '@/api/expenses.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { openBlobInNewTab } from '@/lib/open-blob'
import { ReimburseDialog } from './ReimburseDialog'

export function ExpenseDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('expenses.manage')
  const canApprove = hasPermission('expenses.approve')
  const [rejecting, setRejecting] = useState(false)
  const [reimbursing, setReimbursing] = useState(false)

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => fetchExpense(id),
    enabled: !!id,
  })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['expense', id] })
    void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    void queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
  }
  const onErr = (verb: string) => (e: unknown) => toast.error(getApiErrorMessage(e, `Failed to ${verb}`))
  const submitM = useMutation({ mutationFn: () => submitExpense(id), onSuccess: () => { refresh(); toast.success('Submitted') }, onError: onErr('submit') })
  const approveM = useMutation({ mutationFn: () => approveExpense(id), onSuccess: () => { refresh(); toast.success('Approved') }, onError: onErr('approve') })
  const postM = useMutation({ mutationFn: () => postExpense(id), onSuccess: () => { refresh(); toast.success('Posted to costing') }, onError: onErr('post') })
  const rejectM = useMutation({ mutationFn: (reason: string) => rejectExpense(id, reason), onSuccess: () => { refresh(); toast.success('Rejected'); setRejecting(false) }, onError: onErr('reject') })

  async function viewReceipt() {
    try {
      openBlobInNewTab(await fetchExpenseReceipt(id))
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Failed to open receipt'))
    }
  }

  if (isLoading || !expense) return <div className="flex justify-center py-20"><Spinner /></div>

  const s = expense.approvalStatus
  const editable = s === 'DRAFT' || s === 'REJECTED'
  const canReimburse = canApprove && expense.reimbursable && (s === 'APPROVED' || s === 'POSTED')

  return (
    <div className="space-y-6">
      <Link to="/expenses" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to expenses
      </Link>

      <PageHeader
        title={`${expense.category.replace(/_/g, ' ').toLowerCase()} · ${formatCurrency(expense.totalAmount, expense.currency)}`}
        description={`${formatDate(expense.expenseDate)}${expense.vendor ? ` · ${expense.vendor}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canManage && editable ? (
              <Button onClick={() => submitM.mutate()} disabled={submitM.isPending}>
                <Send className="h-4 w-4" /> Submit
              </Button>
            ) : null}
            {canApprove && s === 'SUBMITTED' ? (
              <>
                <Button onClick={() => approveM.mutate()} disabled={approveM.isPending}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button variant="outline" onClick={() => setRejecting(true)}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              </>
            ) : null}
            {canApprove && s === 'APPROVED' ? (
              <Button onClick={() => postM.mutate()} disabled={postM.isPending}>
                <Check className="h-4 w-4" /> Post to costing
              </Button>
            ) : null}
            {canReimburse ? (
              <Button variant="outline" onClick={() => setReimbursing(true)}>Reimbursement</Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Detail label="Status"><StatusBadge status={s} /></Detail>
        <Detail label="Amount (excl. VAT)">{formatCurrency(expense.amountBeforeVat, expense.currency)}</Detail>
        <Detail label="VAT">{formatCurrency(expense.vatAmount, expense.currency)}</Detail>
        <Detail label="Total">{formatCurrency(expense.totalAmount, expense.currency)}</Detail>
      </div>

      {s === 'REJECTED' && expense.rejectionReason ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="font-medium">Rejected:</span> {expense.rejectionReason}
        </div>
      ) : null}

      {expense.unallocated ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This expense has no job or asset allocation — it won't be attributed to any job's cost.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Detail label="Job">{expense.job ? `${expense.job.jobCode} — ${expense.job.title}` : '—'}</Detail>
        <Detail label="Employee">{expense.employee?.name ?? '—'}</Detail>
        <Detail label="Vehicle">{expense.vehicle ? `${expense.vehicle.plateNumber} (${expense.vehicle.vehicleType})` : '—'}</Detail>
        <Detail label="Equipment">{expense.equipment?.name ?? '—'}</Detail>
      </div>

      {expense.description ? <Section title="Description">{expense.description}</Section> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Detail label="Receipt">
          {expense.receiptName ? (
            <button type="button" onClick={viewReceipt} className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              <FileText className="h-4 w-4" /> {expense.receiptName}
            </button>
          ) : '—'}
        </Detail>
        <Detail label="Created by">{expense.createdBy?.name ?? '—'}</Detail>
        <Detail label="Approved by">{expense.approvedBy ? `${expense.approvedBy.name} · ${formatDate(expense.approvedAt)}` : '—'}</Detail>
      </div>

      {expense.reimbursable ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Reimbursement</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <Detail label="Status"><StatusBadge status={expense.reimbursementStatus} /></Detail>
            <Detail label="Method">{expense.reimbursementMethod ? expense.reimbursementMethod.replace(/_/g, ' ').toLowerCase() : '—'}</Detail>
            <Detail label="Reference">{expense.reimbursementRef ?? '—'}</Detail>
            <Detail label="Paid on">{expense.reimbursedAt ? formatDate(expense.reimbursedAt) : '—'}</Detail>
          </div>
          {expense.reimbursementNote ? <p className="mt-3 text-sm text-slate-700"><span className="font-medium">Note:</span> {expense.reimbursementNote}</p> : null}
        </div>
      ) : null}

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Reject expense"
        isLoading={rejectM.isPending}
        onConfirm={(reason) => rejectM.mutate(reason)}
      />
      <ReimburseDialog open={reimbursing} onOpenChange={setReimbursing} expenseId={id} onDone={refresh} />
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="mt-1 text-sm capitalize text-slate-900">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{title}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-800">{children}</p>
    </div>
  )
}
