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
import { deleteClient, fetchClients } from '@/api/clients.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { ClientStatus, ClientSummary, ClientType } from '@/types'
import { ClientFormDialog } from './ClientFormDialog'

const PAGE_SIZE = 20

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  GOVERNMENT: 'Government',
  SEMI_GOVERNMENT: 'Semi-government',
  PRIVATE: 'Private',
  CONTRACTOR: 'Contractor',
}

export function ClientsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('clients.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [clientType, setClientType] = useState<ClientType | 'ALL'>('ALL')
  const [status, setStatus] = useState<ClientStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const [formOpen, setFormOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientSummary | null>(null)
  const [deletingClient, setDeletingClient] = useState<ClientSummary | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { page, search: debouncedSearch, clientType, status }],
    queryFn: () =>
      fetchClients({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        clientType: clientType === 'ALL' ? undefined : clientType,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client deleted')
      setDeletingClient(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete client'))
      setDeletingClient(null)
    },
  })

  const columns: ColumnDef<ClientSummary, unknown>[] = [
    {
      header: 'Name',
      cell: ({ row }) => (
        <Link to={`/clients/${row.original.id}`} className="font-medium text-blue-700 hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { header: 'Type', cell: ({ row }) => CLIENT_TYPE_LABELS[row.original.clientType] },
    { header: 'VAT no.', cell: ({ row }) => row.original.vatNumber ?? '—' },
    {
      header: 'Payment terms',
      cell: ({ row }) =>
        row.original.paymentTermsDays != null ? `${row.original.paymentTermsDays} days` : '—',
    },
    { header: 'Contracts', cell: ({ row }) => row.original._count.contracts },
    { header: 'POs', cell: ({ row }) => row.original._count.purchaseOrders },
    { header: 'Jobs', cell: ({ row }) => row.original._count.jobs },
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
            aria-label="Edit client"
            onClick={() => {
              setEditingClient(row.original)
              setFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete client"
            onClick={() => setDeletingClient(row.original)}
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
        title="Clients"
        description="Client organizations, contacts, and commercial terms."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingClient(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New client
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name, VAT, or CR number"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="w-72"
        />

        <Select
          value={clientType}
          onValueChange={(value) => {
            setClientType(value as ClientType | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as ClientStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No clients found" />
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
        <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} client={editingClient} />
      ) : null}

      <ConfirmDialog
        open={!!deletingClient}
        onOpenChange={(open) => !open && setDeletingClient(null)}
        title="Delete client"
        description={`Are you sure you want to delete "${deletingClient?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingClient && deleteMutation.mutate(deletingClient.id)}
      />
    </div>
  )
}
