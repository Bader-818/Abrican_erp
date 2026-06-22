import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Check, MoreVertical, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { RejectDialog } from '@/components/RejectDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import {
  approveExpense,
  deleteExpense,
  fetchExpenses,
  postExpense,
  rejectExpense,
  submitExpense,
} from '@/api/expenses.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { ApprovalStatus, ExpenseSummary } from '@/types'
import { ExpenseFormDialog } from './ExpenseFormDialog'

const PAGE_SIZE = 20
const STATUSES: ApprovalStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED']
const EDITABLE = (s: ApprovalStatus) => s === 'DRAFT' || s === 'REJECTED'

function allocationLabel(e: ExpenseSummary): string {
  if (e.job) return e.job.jobCode
  if (e.employee) return e.employee.name
  if (e.vehicleId) return 'Vehicle'
  if (e.equipmentId) return 'Equipment'
  return '—'
}

export function ExpensesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('expenses.manage')
  const canApprove = hasPermission('expenses.approve')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<ApprovalStatus | 'ALL'>('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseSummary | null>(null)
  const [deleting, setDeleting] = useState<ExpenseSummary | null>(null)
  const [rejecting, setRejecting] = useState<ExpenseSummary | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', { page, status }],
    queryFn: () =>
      fetchExpenses({ page, pageSize: PAGE_SIZE, approvalStatus: status === 'ALL' ? undefined : status }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] })
  }
  const onErr = (verb: string) => (e: unknown) => toast.error(getApiErrorMessage(e, `Failed to ${verb}`))
  const submitM = useMutation({ mutationFn: submitExpense, onSuccess: () => { invalidate(); toast.success('Submitted') }, onError: onErr('submit') })
  const approveM = useMutation({ mutationFn: approveExpense, onSuccess: () => { invalidate(); toast.success('Approved') }, onError: onErr('approve') })
  const postM = useMutation({ mutationFn: postExpense, onSuccess: () => { invalidate(); toast.success('Posted') }, onError: onErr('post') })
  const rejectM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectExpense(id, reason),
    onSuccess: () => { invalidate(); toast.success('Rejected'); setRejecting(null) },
    onError: onErr('reject'),
  })
  const deleteM = useMutation({ mutationFn: deleteExpense, onSuccess: () => { invalidate(); toast.success('Deleted'); setDeleting(null) }, onError: onErr('delete') })

  const columns: ColumnDef<ExpenseSummary, unknown>[] = [
    {
      header: 'Date',
      cell: ({ row }) => (
        <Link to={`/expenses/${row.original.id}`} className="font-medium text-brand-600 hover:underline">
          {formatDate(row.original.expenseDate)}
        </Link>
      ),
    },
    { header: 'Category', cell: ({ row }) => <span className="capitalize">{row.original.category.replace(/_/g, ' ').toLowerCase()}</span> },
    { header: 'Vendor', cell: ({ row }) => row.original.vendor ?? '—' },
    {
      header: 'Allocation',
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1">
          {allocationLabel(row.original)}
          {row.original.unallocated ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="Unallocated" /> : null}
        </span>
      ),
    },
    { header: 'Total', cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount, row.original.currency)}</span> },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.approvalStatus} /> },
    {
      header: 'Reimbursement',
      cell: ({ row }) =>
        row.original.reimbursable ? <StatusBadge status={row.original.reimbursementStatus} /> : <span className="text-slate-400">—</span>,
    },
  ]

  if (canManage || canApprove) {
    columns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const e = row.original
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Actions"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManage && EDITABLE(e.approvalStatus) ? (
                  <>
                    <DropdownMenuItem onSelect={() => { setEditing(e); setFormOpen(true) }}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => submitM.mutate(e.id)}>
                      <Send className="mr-2 h-4 w-4" /> Submit
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canApprove && e.approvalStatus === 'SUBMITTED' ? (
                  <>
                    <DropdownMenuItem onSelect={() => approveM.mutate(e.id)}>
                      <Check className="mr-2 h-4 w-4" /> Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setRejecting(e)}>
                      <X className="mr-2 h-4 w-4" /> Reject
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canApprove && e.approvalStatus === 'APPROVED' ? (
                  <DropdownMenuItem onSelect={() => postM.mutate(e.id)}>
                    <Check className="mr-2 h-4 w-4" /> Post to costing
                  </DropdownMenuItem>
                ) : null}
                {canManage && EDITABLE(e.approvalStatus) ? (
                  <DropdownMenuItem onSelect={() => setDeleting(e)}>
                    <Trash2 className="mr-2 h-4 w-4 text-red-600" /> Delete
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Direct & overhead costs, submitted for approval. Posted expenses feed job costing."
        actions={
          canManage ? (
            <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" /> New expense
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v as ApprovalStatus | 'ALL'); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          emptyMessage="No expenses"
        />
        {data ? <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} /> : null}
      </div>

      {canManage ? <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} expense={editing} /> : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete expense"
        description={`Delete the ${deleting ? deleting.category.toLowerCase() : ''} expense from ${deleting ? formatDate(deleting.expenseDate) : ''}?`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteM.isPending}
        onConfirm={() => deleting && deleteM.mutate(deleting.id)}
      />
      <RejectDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject expense"
        isLoading={rejectM.isPending}
        onConfirm={(reason) => rejecting && rejectM.mutate({ id: rejecting.id, reason })}
      />
    </div>
  )
}
