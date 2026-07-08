import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { fetchJob } from '@/api/jobs.api'
import { deleteAssignment, fetchAssignments } from '@/api/assignments.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters'
import { ALLOWED_TRANSITIONS } from '@/lib/job-status'
import type { Assignment, JobStatusHistoryEntry } from '@/types'
import { ChangeStatusDialog } from './ChangeStatusDialog'
import { JobCostingPanel } from './JobCostingPanel'
import { JobFormDialog } from './JobFormDialog'
import { AssignmentFormDialog } from '../scheduling/AssignmentFormDialog'
import { assignmentResourceName } from '../scheduling/SchedulePage'

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value ?? '—'}</dd>
    </div>
  )
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('jobs.manage')
  const canChangeStatus = hasPermission('jobs.status_change')
  const canViewAssignments = hasPermission('assignments.view')
  const canManageAssignments = hasPermission('assignments.manage')
  const canViewCosting = hasPermission('jobs.costing_view')
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [deletingAssignment, setDeletingAssignment] = useState<Assignment | null>(null)

  const { data: job, isLoading } = useQuery({
    queryKey: ['jobs', id],
    queryFn: () => fetchJob(id!),
    enabled: !!id,
  })

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments', { jobId: id }],
    queryFn: () => fetchAssignments({ jobId: id, pageSize: 100 }),
    enabled: !!id && canViewAssignments,
  })

  const deleteAssignmentMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignments', { jobId: id }] })
      void queryClient.invalidateQueries({ queryKey: ['jobs', id] })
      toast.success('Assignment removed')
      setDeletingAssignment(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to remove assignment'))
      setDeletingAssignment(null)
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (!job) {
    return <p className="py-16 text-center text-sm text-slate-500">Job not found.</p>
  }

  const hasTransitions = ALLOWED_TRANSITIONS[job.status].length > 0

  const historyColumns: ColumnDef<JobStatusHistoryEntry, unknown>[] = [
    {
      header: 'Transition',
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          {row.original.fromStatus ? <StatusBadge status={row.original.fromStatus} /> : '—'}
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <StatusBadge status={row.original.toStatus} />
        </span>
      ),
    },
    { header: 'Changed by', cell: ({ row }) => row.original.changedBy.name },
    { header: 'Reason', cell: ({ row }) => row.original.reason ?? '—' },
    { header: 'When', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  ]

  const assignmentColumns: ColumnDef<Assignment, unknown>[] = [
    { header: 'Type', cell: ({ row }) => row.original.resourceType.toLowerCase() },
    { header: 'Resource', cell: ({ row }) => assignmentResourceName(row.original) },
    { header: 'Start', cell: ({ row }) => formatDateTime(row.original.startDatetime) },
    { header: 'End', cell: ({ row }) => formatDateTime(row.original.endDatetime) },
    { header: 'Hours', cell: ({ row }) => row.original.plannedHours ?? '—' },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  if (canManageAssignments) {
    assignmentColumns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove assignment"
            onClick={() => setDeletingAssignment(row.original)}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to jobs
        </Link>
      </div>

      <PageHeader
        title={`${job.jobCode} — ${job.title}`}
        description={job.client.name}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} className="text-sm" />
            {canChangeStatus && hasTransitions ? (
              <Button onClick={() => setStatusOpen(true)}>Change status</Button>
            ) : null}
            {canManage ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit job
              </Button>
            ) : null}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canViewAssignments ? (
            <TabsTrigger value="assignments">Assignments ({job._count.assignments})</TabsTrigger>
          ) : null}
          {canViewCosting ? <TabsTrigger value="costing">Costing</TabsTrigger> : null}
          <TabsTrigger value="history">Status history ({job.statusHistory.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Status" value={<StatusBadge status={job.status} />} />
              <DetailField
                label="Client"
                value={
                  <Link to={`/clients/${job.client.id}`} className="text-blue-700 hover:underline">
                    {job.client.name}
                  </Link>
                }
              />
              <DetailField
                label="Contract"
                value={
                  job.contract ? (
                    <Link to={`/contracts/${job.contract.id}`} className="text-blue-700 hover:underline">
                      {job.contract.contractNumber}
                    </Link>
                  ) : null
                }
              />
              <DetailField label="Purchase order" value={job.purchaseOrder?.poNumber} />
              <DetailField label="Service type" value={job.serviceType} />
              <DetailField label="Location" value={job.location} />
              <DetailField label="Region" value={job.region} />
              <DetailField label="Planned start" value={formatDate(job.plannedStartDate)} />
              <DetailField label="Planned end" value={formatDate(job.plannedEndDate)} />
              <DetailField label="Actual start" value={formatDate(job.actualStartDate)} />
              <DetailField label="Actual end" value={formatDate(job.actualEndDate)} />
              <DetailField label="Assignments" value={job._count.assignments} />
              <DetailField label="Job value" value={formatCurrency(job.jobValue)} />
              <DetailField label="Cost budget" value={formatCurrency(job.costBudget)} />
              <DetailField label="Created" value={formatDate(job.createdAt)} />
              <div className="sm:col-span-2 lg:col-span-3">
                <DetailField label="Description" value={job.description} />
              </div>
            </dl>
          </div>
        </TabsContent>

        {canViewAssignments ? (
          <TabsContent value="assignments">
            <div className="space-y-4">
              {canManageAssignments ? (
                <div className="flex justify-end">
                  <Button onClick={() => setAssignOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Assign resource
                  </Button>
                </div>
              ) : null}
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <DataTable
                  columns={assignmentColumns}
                  data={assignments?.data ?? []}
                  isLoading={assignmentsLoading}
                  emptyMessage="No resources assigned yet"
                />
              </div>
            </div>
          </TabsContent>
        ) : null}

        {canViewCosting ? (
          <TabsContent value="costing">
            <JobCostingPanel jobId={job.id} status={job.status} />
          </TabsContent>
        ) : null}

        <TabsContent value="history">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <DataTable
              columns={historyColumns}
              data={job.statusHistory}
              emptyMessage="No status changes yet"
            />
          </div>
        </TabsContent>
      </Tabs>

      {canManage ? <JobFormDialog open={editOpen} onOpenChange={setEditOpen} job={job} /> : null}
      {canChangeStatus ? (
        <ChangeStatusDialog open={statusOpen} onOpenChange={setStatusOpen} job={job} />
      ) : null}
      {canManageAssignments ? (
        <AssignmentFormDialog open={assignOpen} onOpenChange={setAssignOpen} lockedJobId={job.id} />
      ) : null}

      <ConfirmDialog
        open={!!deletingAssignment}
        onOpenChange={(open) => !open && setDeletingAssignment(null)}
        title="Remove assignment"
        description={
          deletingAssignment
            ? `Remove ${assignmentResourceName(deletingAssignment)} from this job?`
            : ''
        }
        confirmLabel="Remove"
        destructive
        isLoading={deleteAssignmentMutation.isPending}
        onConfirm={() => deletingAssignment && deleteAssignmentMutation.mutate(deletingAssignment.id)}
      />
    </div>
  )
}
