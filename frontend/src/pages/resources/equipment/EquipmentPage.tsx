import { useState } from 'react'
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
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { deleteEquipment, fetchEquipment } from '@/api/equipment.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/formatters'
import type { Equipment, EquipmentStatus } from '@/types'
import { EquipmentFormDialog } from './EquipmentFormDialog'

const PAGE_SIZE = 20

const EQUIPMENT_STATUSES: EquipmentStatus[] = ['AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE']

function ExpiryCell({ value }: { value: string | null }) {
  if (!value) return <span>—</span>
  const date = new Date(value)
  const soon = date.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
  const past = date.getTime() < Date.now()
  return (
    <span className={cn(past ? 'font-medium text-red-600' : soon ? 'font-medium text-amber-600' : undefined)}>
      {formatDate(value)}
    </span>
  )
}

export function EquipmentPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('equipment.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EquipmentStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const [formOpen, setFormOpen] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)
  const [deletingEquipment, setDeletingEquipment] = useState<Equipment | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['equipment', { page, search: debouncedSearch, status }],
    queryFn: () =>
      fetchEquipment({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEquipment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Equipment deleted')
      setDeletingEquipment(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete equipment'))
      setDeletingEquipment(null)
    },
  })

  const columns: ColumnDef<Equipment, unknown>[] = [
    { header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { header: 'Type', accessorKey: 'equipmentType' },
    { header: 'Serial', cell: ({ row }) => row.original.serialNumber ?? '—' },
    { header: 'Location', cell: ({ row }) => row.original.currentLocation ?? '—' },
    { header: 'Ownership', cell: ({ row }) => <StatusBadge status={row.original.ownershipType} /> },
    { header: 'Calibration', cell: ({ row }) => <ExpiryCell value={row.original.calibrationExpiry} /> },
    { header: 'Maintenance due', cell: ({ row }) => <ExpiryCell value={row.original.maintenanceDueDate} /> },
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
            aria-label="Edit equipment"
            onClick={() => {
              setEditingEquipment(row.original)
              setFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete equipment"
            onClick={() => setDeletingEquipment(row.original)}
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
        title="Equipment"
        description="Equipment inventory with calibration and maintenance tracking."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingEquipment(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New equipment
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name, type, serial, or location"
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
            setStatus(value as EquipmentStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {EQUIPMENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          emptyMessage="No equipment found"
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

      {canManage ? (
        <EquipmentFormDialog open={formOpen} onOpenChange={setFormOpen} equipment={editingEquipment} />
      ) : null}

      <ConfirmDialog
        open={!!deletingEquipment}
        onOpenChange={(open) => !open && setDeletingEquipment(null)}
        title="Delete equipment"
        description={`Are you sure you want to delete "${deletingEquipment?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingEquipment && deleteMutation.mutate(deletingEquipment.id)}
      />
    </div>
  )
}
