import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { deleteJob, fetchJobs } from '@/api/jobs.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { ALL_JOB_STATUSES, JOB_STATUS_LABELS } from '@/lib/job-status'
import type { JobStatus, JobSummary } from '@/types'
import { JobFormDialog } from './JobFormDialog'

const PAGE_SIZE = 20

export function JobsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('jobs.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<JobStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const [formOpen, setFormOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<JobSummary | null>(null)
  const [deletingJob, setDeletingJob] = useState<JobSummary | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', { page, search: debouncedSearch, status }],
    queryFn: () =>
      fetchJobs({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Job deleted')
      setDeletingJob(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete job'))
      setDeletingJob(null)
    },
  })

  const columns: ColumnDef<JobSummary, unknown>[] = [
    {
      header: 'Job code',
      cell: ({ row }) => (
        <Link to={`/jobs/${row.original.id}`} className="font-medium text-blue-700 hover:underline">
          {row.original.jobCode}
        </Link>
      ),
    },
    { header: 'Title', accessorKey: 'title' },
    {
      header: 'Client',
      cell: ({ row }) => (
        <Link to={`/clients/${row.original.client.id}`} className="text-blue-700 hover:underline">
          {row.original.client.name}
        </Link>
      ),
    },
    { header: 'Service', accessorKey: 'serviceType' },
    { header: 'Location', accessorKey: 'location' },
    { header: 'Planned start', cell: ({ row }) => formatDate(row.original.plannedStartDate) },
    { header: 'Planned end', cell: ({ row }) => formatDate(row.original.plannedEndDate) },
    { header: 'Value', cell: ({ row }) => formatCurrency(row.original.jobValue) },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  if (canManage) {
    columns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit job"
            onClick={() => {
              setEditingJob(row.original)
              setFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete job"
            onClick={() => setDeletingJob(row.original)}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Operational jobs across their full lifecycle."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingJob(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New job
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by code, title, location, or client"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="w-80"
        />

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as JobStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {ALL_JOB_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {JOB_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No jobs found" />
        {data ? (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            onPageChange={setPage}
          />
        ) : null}
      </div>

      {canManage ? <JobFormDialog open={formOpen} onOpenChange={setFormOpen} job={editingJob} /> : null}

      <ConfirmDialog
        open={!!deletingJob}
        onOpenChange={(open) => !open && setDeletingJob(null)}
        title="Delete job"
        description={`Are you sure you want to delete "${deletingJob?.jobCode}"? Only draft or cancelled jobs can be deleted.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingJob && deleteMutation.mutate(deletingJob.id)}
      />
    </div>
  )
}
