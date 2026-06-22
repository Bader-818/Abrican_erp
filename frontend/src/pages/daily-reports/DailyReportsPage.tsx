import { useState } from 'react'
import { Link } from 'react-router-dom'
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
  approveDailyReport,
  deleteDailyReport,
  fetchDailyReports,
  rejectDailyReport,
  submitDailyReport,
} from '@/api/daily-reports.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/formatters'
import type { ApprovalStatus, DailyReportSummary } from '@/types'
import { DailyReportFormDialog } from './DailyReportFormDialog'

const PAGE_SIZE = 20
const STATUSES: ApprovalStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']
const EDITABLE = (s: ApprovalStatus) => s === 'DRAFT' || s === 'REJECTED'

export function DailyReportsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('daily_reports.manage')
  const canApprove = hasPermission('daily_reports.approve')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<ApprovalStatus | 'ALL'>('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DailyReportSummary | null>(null)
  const [deleting, setDeleting] = useState<DailyReportSummary | null>(null)
  const [rejecting, setRejecting] = useState<DailyReportSummary | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['daily-reports', { page, status }],
    queryFn: () =>
      fetchDailyReports({ page, pageSize: PAGE_SIZE, approvalStatus: status === 'ALL' ? undefined : status }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['daily-reports'] })
  }
  const onErr = (verb: string) => (e: unknown) => toast.error(getApiErrorMessage(e, `Failed to ${verb}`))

  const submitM = useMutation({ mutationFn: submitDailyReport, onSuccess: () => { invalidate(); toast.success('Submitted') }, onError: onErr('submit') })
  const approveM = useMutation({ mutationFn: approveDailyReport, onSuccess: () => { invalidate(); toast.success('Approved') }, onError: onErr('approve') })
  const rejectM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectDailyReport(id, reason),
    onSuccess: () => { invalidate(); toast.success('Rejected'); setRejecting(null) },
    onError: onErr('reject'),
  })
  const deleteM = useMutation({ mutationFn: deleteDailyReport, onSuccess: () => { invalidate(); toast.success('Deleted'); setDeleting(null) }, onError: onErr('delete') })

  const columns: ColumnDef<DailyReportSummary, unknown>[] = [
    {
      header: 'Date',
      cell: ({ row }) => (
        <Link to={`/daily-reports/${row.original.id}`} className="font-medium text-blue-700 hover:underline">
          {formatDate(row.original.reportDate)}
        </Link>
      ),
    },
    { header: 'Job', cell: ({ row }) => `${row.original.job.jobCode}` },
    { header: 'Supervisor', cell: ({ row }) => row.original.supervisor?.name ?? '—' },
    { header: 'Progress', cell: ({ row }) => (row.original.progressPct != null ? `${Number(row.original.progressPct)}%` : '—') },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.approvalStatus} /> },
  ]

  if (canManage || canApprove) {
    columns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Actions"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManage && EDITABLE(r.approvalStatus) ? (
                  <>
                    <DropdownMenuItem onSelect={() => { setEditing(r); setFormOpen(true) }}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => submitM.mutate(r.id)}>
                      <Send className="mr-2 h-4 w-4" /> Submit
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canApprove && r.approvalStatus === 'SUBMITTED' ? (
                  <>
                    <DropdownMenuItem onSelect={() => approveM.mutate(r.id)}>
                      <Check className="mr-2 h-4 w-4" /> Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setRejecting(r)}>
                      <X className="mr-2 h-4 w-4" /> Reject
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canManage && EDITABLE(r.approvalStatus) ? (
                  <DropdownMenuItem onSelect={() => setDeleting(r)}>
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
        title="Daily reports"
        description="Field reports submitted by supervisors for approval."
        actions={
          canManage ? (
            <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" /> New report
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
        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No daily reports" />
        {data ? <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} /> : null}
      </div>

      {canManage ? <DailyReportFormDialog open={formOpen} onOpenChange={setFormOpen} report={editing} /> : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete daily report"
        description={`Delete the report for ${deleting ? formatDate(deleting.reportDate) : ''}?`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteM.isPending}
        onConfirm={() => deleting && deleteM.mutate(deleting.id)}
      />
      <RejectDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject daily report"
        isLoading={rejectM.isPending}
        onConfirm={(reason) => rejecting && rejectM.mutate({ id: rejecting.id, reason })}
      />
    </div>
  )
}
