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
import { deleteContract, fetchContracts } from '@/api/contracts.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { ContractStatus, ContractSummary } from '@/types'
import { ContractFormDialog } from './ContractFormDialog'

const PAGE_SIZE = 20

const CONTRACT_STATUSES: ContractStatus[] = ['DRAFT', 'ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED']

export function ContractsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('contracts.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ContractStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const [formOpen, setFormOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<ContractSummary | null>(null)
  const [deletingContract, setDeletingContract] = useState<ContractSummary | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', { page, search: debouncedSearch, status }],
    queryFn: () =>
      fetchContracts({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteContract,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contracts'] })
      toast.success('Contract deleted')
      setDeletingContract(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete contract'))
      setDeletingContract(null)
    },
  })

  const columns: ColumnDef<ContractSummary, unknown>[] = [
    {
      header: 'Contract no.',
      cell: ({ row }) => (
        <Link to={`/contracts/${row.original.id}`} className="font-medium text-blue-700 hover:underline">
          {row.original.contractNumber}
        </Link>
      ),
    },
    { header: 'Title', accessorKey: 'title' },
    { header: 'Client', cell: ({ row }) => row.original.client.name },
    { header: 'Start', cell: ({ row }) => formatDate(row.original.startDate) },
    { header: 'End', cell: ({ row }) => formatDate(row.original.endDate) },
    { header: 'Value', cell: ({ row }) => formatCurrency(row.original.contractValue) },
    { header: 'Remaining', cell: ({ row }) => formatCurrency(row.original.remainingValue) },
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
            aria-label="Edit contract"
            onClick={() => {
              setEditingContract(row.original)
              setFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete contract"
            onClick={() => setDeletingContract(row.original)}
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
        title="Contracts"
        description="Client contracts, values, and validity periods."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingContract(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New contract
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by number, title, or client"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="w-72"
        />

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as ContractStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {CONTRACT_STATUSES.map((value) => (
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
          emptyMessage="No contracts found"
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
        <ContractFormDialog open={formOpen} onOpenChange={setFormOpen} contract={editingContract} />
      ) : null}

      <ConfirmDialog
        open={!!deletingContract}
        onOpenChange={(open) => !open && setDeletingContract(null)}
        title="Delete contract"
        description={`Are you sure you want to delete "${deletingContract?.contractNumber}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingContract && deleteMutation.mutate(deletingContract.id)}
      />
    </div>
  )
}
