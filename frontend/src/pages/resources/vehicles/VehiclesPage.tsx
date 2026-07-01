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
import { deleteVehicle, fetchVehicles } from '@/api/vehicles.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/formatters'
import type { Vehicle, VehicleStatus } from '@/types'
import { VehicleFormDialog } from './VehicleFormDialog'

const PAGE_SIZE = 20

const VEHICLE_STATUSES: VehicleStatus[] = ['AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE']

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

export function VehiclesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('vehicles.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<VehicleStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const [formOpen, setFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', { page, search: debouncedSearch, status }],
    queryFn: () =>
      fetchVehicles({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Vehicle deleted')
      setDeletingVehicle(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete vehicle'))
      setDeletingVehicle(null)
    },
  })

  const columns: ColumnDef<Vehicle, unknown>[] = [
    { header: 'Door No.', cell: ({ row }) => row.original.doorNumber ?? '—' },
    { header: 'Manufacturer', cell: ({ row }) => row.original.make ?? '—' },
    { header: 'Type', cell: ({ row }) => (row.original.vehicleClass ? <StatusBadge status={row.original.vehicleClass} /> : '—') },
    { header: 'Car Color', cell: ({ row }) => row.original.color ?? '—' },
    { header: 'Plate No.', cell: ({ row }) => <span className="font-medium">{row.original.plateNumber}</span> },
    { header: 'رقم اللوحة', cell: ({ row }) => <span dir="rtl">{row.original.plateNumberAr ?? '—'}</span> },
    { header: 'Expiration date', cell: ({ row }) => <ExpiryCell value={row.original.registrationExpiry} /> },
    { header: 'Plate Color', cell: ({ row }) => row.original.plateColor ?? '—' },
    { header: 'GOV Inspection', cell: ({ row }) => <ExpiryCell value={row.original.inspectionExpiry} /> },
    { header: 'OC', cell: ({ row }) => <ExpiryCell value={row.original.operatingCardExpiry} /> },
    { header: 'Aramco Sticker', cell: ({ row }) => <ExpiryCell value={row.original.aramcoStickerExpiry} /> },
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
            aria-label="Edit vehicle"
            onClick={() => {
              setEditingVehicle(row.original)
              setFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete vehicle"
            onClick={() => setDeletingVehicle(row.original)}
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
        title="Vehicles"
        description="Fleet roster with registration, insurance, and inspection tracking."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingVehicle(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New vehicle
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by plate, type, make, or model"
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
            setStatus(value as VehicleStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {VEHICLE_STATUSES.map((value) => (
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
          emptyMessage="No vehicles found"
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
        <VehicleFormDialog open={formOpen} onOpenChange={setFormOpen} vehicle={editingVehicle} />
      ) : null}

      <ConfirmDialog
        open={!!deletingVehicle}
        onOpenChange={(open) => !open && setDeletingVehicle(null)}
        title="Delete vehicle"
        description={`Are you sure you want to delete "${deletingVehicle?.plateNumber}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingVehicle && deleteMutation.mutate(deletingVehicle.id)}
      />
    </div>
  )
}
