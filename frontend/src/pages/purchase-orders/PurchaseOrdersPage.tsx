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
import { deletePurchaseOrder, fetchPurchaseOrders } from '@/api/purchase-orders.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types'
import { PurchaseOrderFormDialog } from './PurchaseOrderFormDialog'

const PAGE_SIZE = 20

const PO_STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED']

export function PurchaseOrdersPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('purchase_orders.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PurchaseOrderStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const [formOpen, setFormOpen] = useState(false)
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null)
  const [deletingPo, setDeletingPo] = useState<PurchaseOrder | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', { page, search: debouncedSearch, status }],
    queryFn: () =>
      fetchPurchaseOrders({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePurchaseOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order deleted')
      setDeletingPo(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete purchase order'))
      setDeletingPo(null)
    },
  })

  const columns: ColumnDef<PurchaseOrder, unknown>[] = [
    { header: 'PO number', cell: ({ row }) => <span className="font-medium">{row.original.poNumber}</span> },
    {
      header: 'Client',
      cell: ({ row }) => (
        <Link to={`/clients/${row.original.client.id}`} className="text-blue-700 hover:underline">
          {row.original.client.name}
        </Link>
      ),
    },
    {
      header: 'Contract',
      cell: ({ row }) =>
        row.original.contract ? (
          <Link to={`/contracts/${row.original.contract.id}`} className="text-blue-700 hover:underline">
            {row.original.contract.contractNumber}
          </Link>
        ) : (
          '—'
        ),
    },
    { header: 'Value', cell: ({ row }) => formatCurrency(row.original.poValue, row.original.currency) },
    {
      header: 'Remaining',
      cell: ({ row }) => formatCurrency(row.original.remainingAmount, row.original.currency),
    },
    { header: 'Issued', cell: ({ row }) => formatDate(row.original.issueDate) },
    { header: 'Expires', cell: ({ row }) => formatDate(row.original.expiryDate) },
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
            aria-label="Edit purchase order"
            onClick={() => {
              setEditingPo(row.original)
              setFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete purchase order"
            onClick={() => setDeletingPo(row.original)}
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
        title="Purchase Orders"
        description="Client purchase orders, values, and validity."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingPo(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New purchase order
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by PO number, client, or contract"
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
            setStatus(value as PurchaseOrderStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {PO_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value.charAt(0) + value.slice(1).toLowerCase()}
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
          emptyMessage="No purchase orders found"
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
        <PurchaseOrderFormDialog open={formOpen} onOpenChange={setFormOpen} purchaseOrder={editingPo} />
      ) : null}

      <ConfirmDialog
        open={!!deletingPo}
        onOpenChange={(open) => !open && setDeletingPo(null)}
        title="Delete purchase order"
        description={`Are you sure you want to delete "${deletingPo?.poNumber}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingPo && deleteMutation.mutate(deletingPo.id)}
      />
    </div>
  )
}
