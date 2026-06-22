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
import { deleteRateCard, fetchContract } from '@/api/contracts.api'
import { fetchPurchaseOrders } from '@/api/purchase-orders.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { PurchaseOrder, RateCard } from '@/types'
import { ContractFormDialog } from './ContractFormDialog'
import { RateCardFormDialog } from './RateCardFormDialog'

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value ?? '—'}</dd>
    </div>
  )
}

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('contracts.manage')
  const canViewPOs = hasPermission('purchase_orders.view')
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [rateCardFormOpen, setRateCardFormOpen] = useState(false)
  const [editingRateCard, setEditingRateCard] = useState<RateCard | null>(null)
  const [deletingRateCard, setDeletingRateCard] = useState<RateCard | null>(null)

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contracts', id],
    queryFn: () => fetchContract(id!),
    enabled: !!id,
  })

  const { data: purchaseOrders, isLoading: posLoading } = useQuery({
    queryKey: ['purchase-orders', { contractId: id }],
    queryFn: () => fetchPurchaseOrders({ contractId: id, pageSize: 100 }),
    enabled: !!id && canViewPOs,
  })

  const deleteRateCardMutation = useMutation({
    mutationFn: (rateCardId: string) => deleteRateCard(id!, rateCardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contracts', id] })
      toast.success('Rate card item deleted')
      setDeletingRateCard(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete rate card item'))
      setDeletingRateCard(null)
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (!contract) {
    return <p className="py-16 text-center text-sm text-slate-500">Contract not found.</p>
  }

  const rateCardColumns: ColumnDef<RateCard, unknown>[] = [
    { header: 'Service line', accessorKey: 'serviceLine' },
    { header: 'Item code', cell: ({ row }) => row.original.itemCode ?? '—' },
    { header: 'Description', accessorKey: 'description' },
    { header: 'Unit', accessorKey: 'unit' },
    {
      header: 'Unit price',
      cell: ({ row }) => formatCurrency(row.original.unitPrice, row.original.currency),
    },
    { header: 'VAT', cell: ({ row }) => (row.original.vatApplicable ? 'Yes' : 'No') },
    { header: 'Effective', cell: ({ row }) => formatDate(row.original.effectiveDate) },
  ]

  if (canManage) {
    rateCardColumns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit rate card item"
            onClick={() => {
              setEditingRateCard(row.original)
              setRateCardFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete rate card item"
            onClick={() => setDeletingRateCard(row.original)}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    })
  }

  const poColumns: ColumnDef<PurchaseOrder, unknown>[] = [
    { header: 'PO number', cell: ({ row }) => <span className="font-medium">{row.original.poNumber}</span> },
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
          to="/contracts"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to contracts
        </Link>
      </div>

      <PageHeader
        title={`${contract.contractNumber} — ${contract.title}`}
        description={contract.client.name}
        actions={
          canManage ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit contract
            </Button>
          ) : null
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rate-cards">Rate cards ({contract.rateCards.length})</TabsTrigger>
          {canViewPOs ? (
            <TabsTrigger value="purchase-orders">
              Purchase orders ({contract._count.purchaseOrders})
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Status" value={<StatusBadge status={contract.status} />} />
              <DetailField
                label="Client"
                value={
                  <Link to={`/clients/${contract.client.id}`} className="text-blue-700 hover:underline">
                    {contract.client.name}
                  </Link>
                }
              />
              <DetailField
                label="Payment terms"
                value={contract.paymentTermsDays != null ? `${contract.paymentTermsDays} days` : null}
              />
              <DetailField label="Start date" value={formatDate(contract.startDate)} />
              <DetailField label="End date" value={formatDate(contract.endDate)} />
              <DetailField label="Created" value={formatDate(contract.createdAt)} />
              <DetailField label="Contract value" value={formatCurrency(contract.contractValue)} />
              <DetailField label="Consumed" value={formatCurrency(contract.consumedValue)} />
              <DetailField label="Remaining" value={formatCurrency(contract.remainingValue)} />
              <div className="sm:col-span-2 lg:col-span-3">
                <DetailField label="Scope" value={contract.scope} />
              </div>
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="rate-cards">
          <div className="space-y-4">
            {canManage ? (
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setEditingRateCard(null)
                    setRateCardFormOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  New rate card item
                </Button>
              </div>
            ) : null}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <DataTable
                columns={rateCardColumns}
                data={contract.rateCards}
                emptyMessage="No rate card items yet"
              />
            </div>
          </div>
        </TabsContent>

        {canViewPOs ? (
          <TabsContent value="purchase-orders">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <DataTable
                columns={poColumns}
                data={purchaseOrders?.data ?? []}
                isLoading={posLoading}
                emptyMessage="No purchase orders under this contract"
              />
            </div>
          </TabsContent>
        ) : null}
      </Tabs>

      {canManage ? (
        <>
          <ContractFormDialog open={editOpen} onOpenChange={setEditOpen} contract={contract} />
          <RateCardFormDialog
            open={rateCardFormOpen}
            onOpenChange={setRateCardFormOpen}
            contractId={contract.id}
            rateCard={editingRateCard}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={!!deletingRateCard}
        onOpenChange={(open) => !open && setDeletingRateCard(null)}
        title="Delete rate card item"
        description={`Are you sure you want to delete "${deletingRateCard?.description}"?`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteRateCardMutation.isPending}
        onConfirm={() => deletingRateCard && deleteRateCardMutation.mutate(deletingRateCard.id)}
      />
    </div>
  )
}
