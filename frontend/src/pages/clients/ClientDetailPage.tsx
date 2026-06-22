import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { deleteContact, fetchClient } from '@/api/clients.api'
import { fetchContracts } from '@/api/contracts.api'
import { fetchPurchaseOrders } from '@/api/purchase-orders.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { ClientContact, ContractSummary, PurchaseOrder } from '@/types'
import { ClientFormDialog } from './ClientFormDialog'
import { ContactFormDialog } from './ContactFormDialog'

const CLIENT_TYPE_LABELS: Record<string, string> = {
  GOVERNMENT: 'Government',
  SEMI_GOVERNMENT: 'Semi-government',
  PRIVATE: 'Private',
  CONTRACTOR: 'Contractor',
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value ?? '—'}</dd>
    </div>
  )
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('clients.manage')
  const canViewContracts = hasPermission('contracts.view')
  const canViewPOs = hasPermission('purchase_orders.view')
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [contactFormOpen, setContactFormOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null)
  const [deletingContact, setDeletingContact] = useState<ClientContact | null>(null)

  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => fetchClient(id!),
    enabled: !!id,
  })

  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', { clientId: id }],
    queryFn: () => fetchContracts({ clientId: id, pageSize: 100 }),
    enabled: !!id && canViewContracts,
  })

  const { data: purchaseOrders, isLoading: posLoading } = useQuery({
    queryKey: ['purchase-orders', { clientId: id }],
    queryFn: () => fetchPurchaseOrders({ clientId: id, pageSize: 100 }),
    enabled: !!id && canViewPOs,
  })

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => deleteContact(id!, contactId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients', id] })
      toast.success('Contact deleted')
      setDeletingContact(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete contact'))
      setDeletingContact(null)
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (!client) {
    return <p className="py-16 text-center text-sm text-slate-500">Client not found.</p>
  }

  const contactColumns: ColumnDef<ClientContact, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Role', cell: ({ row }) => row.original.role ?? '—' },
    { header: 'Phone', cell: ({ row }) => row.original.phone ?? '—' },
    { header: 'Email', cell: ({ row }) => row.original.email ?? '—' },
  ]

  if (canManage) {
    contactColumns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit contact"
            onClick={() => {
              setEditingContact(row.original)
              setContactFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete contact"
            onClick={() => setDeletingContact(row.original)}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    })
  }

  const contractColumns: ColumnDef<ContractSummary, unknown>[] = [
    {
      header: 'Contract no.',
      cell: ({ row }) => (
        <Link to={`/contracts/${row.original.id}`} className="font-medium text-blue-700 hover:underline">
          {row.original.contractNumber}
        </Link>
      ),
    },
    { header: 'Title', accessorKey: 'title' },
    { header: 'Start', cell: ({ row }) => formatDate(row.original.startDate) },
    { header: 'End', cell: ({ row }) => formatDate(row.original.endDate) },
    { header: 'Value', cell: ({ row }) => formatCurrency(row.original.contractValue) },
    { header: 'Remaining', cell: ({ row }) => formatCurrency(row.original.remainingValue) },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  const poColumns: ColumnDef<PurchaseOrder, unknown>[] = [
    { header: 'PO number', cell: ({ row }) => <span className="font-medium">{row.original.poNumber}</span> },
    { header: 'Contract', cell: ({ row }) => row.original.contract?.contractNumber ?? '—' },
    { header: 'Value', cell: ({ row }) => formatCurrency(row.original.poValue, row.original.currency) },
    {
      header: 'Remaining',
      cell: ({ row }) => formatCurrency(row.original.remainingAmount, row.original.currency),
    },
    { header: 'Issued', cell: ({ row }) => formatDate(row.original.issueDate) },
    { header: 'Expires', cell: ({ row }) => formatDate(row.original.expiryDate) },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/clients"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to clients
        </Link>
      </div>

      <PageHeader
        title={client.name}
        description={`${CLIENT_TYPE_LABELS[client.clientType]} client`}
        actions={
          canManage ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit client
            </Button>
          ) : null
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({client.contacts.length})</TabsTrigger>
          {canViewContracts ? (
            <TabsTrigger value="contracts">Contracts ({client._count.contracts})</TabsTrigger>
          ) : null}
          {canViewPOs ? (
            <TabsTrigger value="purchase-orders">
              Purchase orders ({client._count.purchaseOrders})
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Status" value={<StatusBadge status={client.status} />} />
              <DetailField label="Client type" value={CLIENT_TYPE_LABELS[client.clientType]} />
              <DetailField
                label="Payment terms"
                value={client.paymentTermsDays != null ? `${client.paymentTermsDays} days` : null}
              />
              <DetailField label="VAT number" value={client.vatNumber} />
              <DetailField label="CR number" value={client.crNumber} />
              <DetailField label="Created" value={formatDate(client.createdAt)} />
              <div className="sm:col-span-2 lg:col-span-3">
                <DetailField label="Billing address" value={client.billingAddress} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <DetailField label="Notes" value={client.notes} />
              </div>
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <div className="space-y-4">
            {canManage ? (
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setEditingContact(null)
                    setContactFormOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  New contact
                </Button>
              </div>
            ) : null}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <DataTable columns={contactColumns} data={client.contacts} emptyMessage="No contacts yet" />
            </div>
          </div>
        </TabsContent>

        {canViewContracts ? (
          <TabsContent value="contracts">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <DataTable
                columns={contractColumns}
                data={contracts?.data ?? []}
                isLoading={contractsLoading}
                emptyMessage="No contracts for this client"
              />
            </div>
          </TabsContent>
        ) : null}

        {canViewPOs ? (
          <TabsContent value="purchase-orders">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <DataTable
                columns={poColumns}
                data={purchaseOrders?.data ?? []}
                isLoading={posLoading}
                emptyMessage="No purchase orders for this client"
              />
            </div>
          </TabsContent>
        ) : null}
      </Tabs>

      {canManage ? (
        <>
          <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} />
          <ContactFormDialog
            open={contactFormOpen}
            onOpenChange={setContactFormOpen}
            clientId={client.id}
            contact={editingContact}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={!!deletingContact}
        onOpenChange={(open) => !open && setDeletingContact(null)}
        title="Delete contact"
        description={`Are you sure you want to delete "${deletingContact?.name}"?`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteContactMutation.isPending}
        onConfirm={() => deletingContact && deleteContactMutation.mutate(deletingContact.id)}
      />
    </div>
  )
}
