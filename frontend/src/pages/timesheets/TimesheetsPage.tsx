import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Check, MoreVertical, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
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
  approveTimesheet,
  deleteTimesheet,
  fetchTimesheets,
  rejectTimesheet,
  submitTimesheet,
} from '@/api/timesheets.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/formatters'
import type { ApprovalStatus, TimesheetSummary } from '@/types'
import { TimesheetFormDialog } from './TimesheetFormDialog'

const PAGE_SIZE = 20
const STATUSES: ApprovalStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']
const EDITABLE = (s: ApprovalStatus) => s === 'DRAFT' || s === 'REJECTED'
const total = (t: TimesheetSummary) =>
  Number(t.regularHours) + Number(t.overtimeHours) + Number(t.standbyHours) + Number(t.travelHours)

export function TimesheetsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('timesheets.manage')
  const canApprove = hasPermission('timesheets.approve')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<ApprovalStatus | 'ALL'>('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TimesheetSummary | null>(null)
  const [deleting, setDeleting] = useState<TimesheetSummary | null>(null)
  const [rejecting, setRejecting] = useState<TimesheetSummary | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['timesheets', { page, status }],
    queryFn: () =>
      fetchTimesheets({ page, pageSize: PAGE_SIZE, approvalStatus: status === 'ALL' ? undefined : status }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['timesheets'] })
  }
  const onErr = (verb: string) => (e: unknown) => toast.error(getApiErrorMessage(e, `Failed to ${verb}`))
  const submitM = useMutation({ mutationFn: submitTimesheet, onSuccess: () => { invalidate(); toast.success('Submitted') }, onError: onErr('submit') })
  const approveM = useMutation({ mutationFn: approveTimesheet, onSuccess: () => { invalidate(); toast.success('Approved') }, onError: onErr('approve') })
  const rejectM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTimesheet(id, reason),
    onSuccess: () => { invalidate(); toast.success('Rejected'); setRejecting(null) },
    onError: onErr('reject'),
  })
  const deleteM = useMutation({ mutationFn: deleteTimesheet, onSuccess: () => { invalidate(); toast.success('Deleted'); setDeleting(null) }, onError: onErr('delete') })

  const columns: ColumnDef<TimesheetSummary, unknown>[] = [
    { header: 'Date', cell: ({ row }) => formatDate(row.original.workDate) },
    { header: 'Job', cell: ({ row }) => row.original.job.jobCode },
    { header: 'Resource', cell: ({ row }) => row.original.employee?.name ?? row.original.crew?.name ?? '—' },
    { header: 'Regular', cell: ({ row }) => Number(row.original.regularHours) },
    { header: 'OT', cell: ({ row }) => Number(row.original.overtimeHours) },
    { header: 'Standby', cell: ({ row }) => Number(row.original.standbyHours) },
    { header: 'Travel', cell: ({ row }) => Number(row.original.travelHours) },
    { header: 'Total', cell: ({ row }) => <span className="font-medium">{total(row.original)}h</span> },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.approvalStatus} /> },
  ]

  if (canManage || canApprove) {
    columns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const t = row.original
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Actions"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManage && EDITABLE(t.approvalStatus) ? (
                  <>
                    <DropdownMenuItem onSelect={() => { setEditing(t); setFormOpen(true) }}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => submitM.mutate(t.id)}>
                      <Send className="mr-2 h-4 w-4" /> Submit
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canApprove && t.approvalStatus === 'SUBMITTED' ? (
                  <>
                    <DropdownMenuItem onSelect={() => approveM.mutate(t.id)}>
                      <Check className="mr-2 h-4 w-4" /> Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setRejecting(t)}>
                      <X className="mr-2 h-4 w-4" /> Reject
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canManage && EDITABLE(t.approvalStatus) ? (
                  <DropdownMenuItem onSelect={() => setDeleting(t)}>
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
        title="Timesheets"
        description="Labor hours per job, submitted for approval. Approved hours feed job costing."
        actions={
          canManage ? (
            <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" /> New timesheet
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
        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No timesheets" />
        {data ? <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} /> : null}
      </div>

      {canManage ? <TimesheetFormDialog open={formOpen} onOpenChange={setFormOpen} timesheet={editing} /> : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete timesheet"
        description={`Delete the timesheet for ${deleting ? formatDate(deleting.workDate) : ''}?`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteM.isPending}
        onConfirm={() => deleting && deleteM.mutate(deleting.id)}
      />
      <RejectDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject timesheet"
        isLoading={rejectM.isPending}
        onConfirm={(reason) => rejecting && rejectM.mutate({ id: rejecting.id, reason })}
      />
    </div>
  )
}
