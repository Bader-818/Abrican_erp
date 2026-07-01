import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import {
  deleteAssignment,
  fetchAssignments,
  fetchUtilization,
} from '@/api/assignments.api'
import { UtilizationBar } from '@/components/charts'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDateTime } from '@/lib/formatters'
import type {
  Assignment,
  AssignmentStatus,
  ResourceType,
  UtilizationResource,
} from '@/types'
import { AssignmentFormDialog } from './AssignmentFormDialog'

const PAGE_SIZE = 20

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  EMPLOYEE: 'Employee',
  CREW: 'Crew',
  VEHICLE: 'Vehicle',
  EQUIPMENT: 'Equipment',
}

export function assignmentResourceName(a: Assignment): string {
  switch (a.resourceType) {
    case 'EMPLOYEE':
      return a.employee?.name ?? '—'
    case 'CREW':
      return a.crew?.name ?? '—'
    case 'VEHICLE':
      return a.vehicle?.plateNumber ?? '—'
    case 'EQUIPMENT':
      return a.equipment?.name ?? '—'
  }
}

function todayIso(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export function SchedulePage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('assignments.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [resourceType, setResourceType] = useState<ResourceType | 'ALL'>('ALL')
  const [status, setStatus] = useState<AssignmentStatus | 'ALL'>('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Assignment | null>(null)

  // Utilization window
  const [from, setFrom] = useState(todayIso(-7))
  const [to, setTo] = useState(todayIso(21))

  const { data, isLoading } = useQuery({
    queryKey: ['assignments', { page, resourceType, status }],
    queryFn: () =>
      fetchAssignments({
        page,
        pageSize: PAGE_SIZE,
        resourceType: resourceType === 'ALL' ? undefined : resourceType,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const { data: utilization, isLoading: utilLoading } = useQuery({
    queryKey: ['utilization', { from, to }],
    queryFn: () => fetchUtilization({ from, to }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignments'] })
      void queryClient.invalidateQueries({ queryKey: ['utilization'] })
      toast.success('Assignment removed')
      setDeleting(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to remove assignment'))
      setDeleting(null)
    },
  })

  const columns: ColumnDef<Assignment, unknown>[] = [
    {
      header: 'Job',
      cell: ({ row }) => (
        <Link to={`/jobs/${row.original.jobId}`} className="font-medium text-blue-700 hover:underline">
          {row.original.job.jobCode}
        </Link>
      ),
    },
    { header: 'Type', cell: ({ row }) => RESOURCE_TYPE_LABELS[row.original.resourceType] },
    { header: 'Resource', cell: ({ row }) => assignmentResourceName(row.original) },
    { header: 'Start', cell: ({ row }) => formatDateTime(row.original.startDatetime) },
    { header: 'End', cell: ({ row }) => formatDateTime(row.original.endDatetime) },
    {
      header: 'Hours',
      cell: ({ row }) => row.original.plannedHours ?? '—',
    },
    { header: 'Booking status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  if (canManage) {
    columns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove assignment"
            onClick={() => setDeleting(row.original)}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    })
  }

  const utilColumns: ColumnDef<UtilizationResource, unknown>[] = [
    { header: 'Type', cell: ({ row }) => RESOURCE_TYPE_LABELS[row.original.resourceType] },
    { header: 'Resource', accessorKey: 'name' },
    { header: 'Assignments', cell: ({ row }) => row.original.assignmentCount },
    { header: 'Assigned hrs', cell: ({ row }) => row.original.assignedHours },
    { header: 'Capacity hrs', cell: ({ row }) => row.original.capacityHours },
    {
      header: 'Utilization',
      cell: ({ row }) => <UtilizationBar pct={row.original.utilizationPct} />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduling"
        description="Resource assignments, conflict detection, and utilization."
        actions={
          canManage ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New assignment
            </Button>
          ) : null
        }
      />

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select
                value={resourceType}
                onValueChange={(v) => {
                  setResourceType(v as ResourceType | 'ALL')
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All types</SelectItem>
                  {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as AssignmentStatus | 'ALL')
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All booking statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All booking statuses</SelectItem>
                  <SelectItem value="PLANNED">Planned</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <DataTable
                columns={columns}
                data={data?.data ?? []}
                isLoading={isLoading}
                emptyMessage="No assignments found"
              />
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
          </div>
        </TabsContent>

        <TabsContent value="utilization">
          <div className="space-y-4">
            {utilization ? <UtilizationSummary resources={utilization.resources} /> : null}

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">From</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">To</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
              {utilization ? (
                <p className="pb-2 text-xs text-slate-500">
                  Working capacity: {utilization.capacityHours} hrs/resource (weekdays × 8h)
                </p>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <DataTable
                columns={utilColumns}
                data={utilization?.resources ?? []}
                isLoading={utilLoading}
                emptyMessage="No assignments in this window"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {canManage ? <AssignmentFormDialog open={formOpen} onOpenChange={setFormOpen} /> : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remove assignment"
        description={
          deleting
            ? `Remove ${assignmentResourceName(deleting)} from ${deleting.job.jobCode}?`
            : ''
        }
        confirmLabel="Remove"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  )
}

function UtilizationSummary({ resources }: { resources: UtilizationResource[] }) {
  if (resources.length === 0) return null
  const avg = Math.round(resources.reduce((s, r) => s + r.utilizationPct, 0) / resources.length)
  const overbooked = resources.filter((r) => r.utilizationPct > 100).length
  const totalHours = Math.round(resources.reduce((s, r) => s + r.assignedHours, 0))

  const cards = [
    { label: 'Resources booked', value: resources.length, tone: 'text-slate-900' },
    { label: 'Avg utilization', value: `${avg}%`, tone: 'text-slate-900' },
    {
      label: 'Overbooked',
      value: overbooked,
      tone: overbooked > 0 ? 'text-red-600' : 'text-slate-900',
    },
    { label: 'Total assigned hrs', value: totalHours, tone: 'text-slate-900' },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">{c.label}</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${c.tone}`}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}
