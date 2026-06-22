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
import { deleteCrew, fetchCrews } from '@/api/crews.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { CrewStatus, CrewSummary } from '@/types'
import { CrewFormDialog } from './CrewFormDialog'

const PAGE_SIZE = 20

export function CrewsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('crews.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CrewStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const [formOpen, setFormOpen] = useState(false)
  const [editingCrew, setEditingCrew] = useState<CrewSummary | null>(null)
  const [deletingCrew, setDeletingCrew] = useState<CrewSummary | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['crews', { page, search: debouncedSearch, status }],
    queryFn: () =>
      fetchCrews({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCrew,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crews'] })
      toast.success('Crew deleted')
      setDeletingCrew(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete crew'))
      setDeletingCrew(null)
    },
  })

  const columns: ColumnDef<CrewSummary, unknown>[] = [
    {
      header: 'Name',
      cell: ({ row }) => (
        <Link
          to={`/resources/crews/${row.original.id}`}
          className="font-medium text-blue-700 hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    { header: 'Supervisor', cell: ({ row }) => row.original.supervisor?.name ?? '—' },
    { header: 'Capability', cell: ({ row }) => row.original.serviceCapability ?? '—' },
    { header: 'Members', cell: ({ row }) => row.original._count.members },
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
            aria-label="Edit crew"
            onClick={() => {
              setEditingCrew(row.original)
              setFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete crew"
            onClick={() => setDeletingCrew(row.original)}
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
        title="Crews"
        description="Named teams assignable to jobs as a unit."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingCrew(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New crew
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name, capability, or supervisor"
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
            setStatus(value as CrewStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="AVAILABLE">Available</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No crews found" />
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

      {canManage ? <CrewFormDialog open={formOpen} onOpenChange={setFormOpen} crew={editingCrew} /> : null}

      <ConfirmDialog
        open={!!deletingCrew}
        onOpenChange={(open) => !open && setDeletingCrew(null)}
        title="Delete crew"
        description={`Are you sure you want to delete "${deletingCrew?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingCrew && deleteMutation.mutate(deletingCrew.id)}
      />
    </div>
  )
}
