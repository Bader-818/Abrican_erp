import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Download, Plus, Trash2 } from 'lucide-react'
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
import {
  deleteDocument,
  downloadDocument,
  fetchDocuments,
  type DocumentsQuery,
} from '@/api/documents.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/formatters'
import type { DocumentRecord, RelatedEntityType } from '@/types'
import { DocumentUploadDialog } from './DocumentUploadDialog'

const PAGE_SIZE = 20

const ENTITY_TYPE_LABELS: Record<RelatedEntityType, string> = {
  EMPLOYEE: 'Employee',
  VEHICLE: 'Vehicle',
  EQUIPMENT: 'Equipment',
  CONTRACT: 'Contract',
  CLIENT: 'Client',
  COMPANY: 'Company-wide',
}

type ExpiryFilter = 'ALL' | 'EXPIRED' | 'EXPIRING_30' | 'EXPIRING_90'

function linkedName(doc: DocumentRecord): string {
  if (doc.employee) return doc.employee.name
  if (doc.vehicle) return doc.vehicle.plateNumber
  if (doc.equipment) return doc.equipment.name
  if (doc.contract) return doc.contract.contractNumber
  if (doc.client) return doc.client.name
  return 'Company-wide'
}

export function DocumentsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('documents.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState<RelatedEntityType | 'ALL'>('ALL')
  const [expiry, setExpiry] = useState<ExpiryFilter>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleting, setDeleting] = useState<DocumentRecord | null>(null)

  const expiryParams: Partial<DocumentsQuery> =
    expiry === 'EXPIRED'
      ? { expired: true }
      : expiry === 'EXPIRING_30'
        ? { expiringWithinDays: 30 }
        : expiry === 'EXPIRING_90'
          ? { expiringWithinDays: 90 }
          : {}

  const { data, isLoading } = useQuery({
    queryKey: ['documents', { page, search: debouncedSearch, entityType, expiry }],
    queryFn: () =>
      fetchDocuments({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        relatedEntityType: entityType === 'ALL' ? undefined : entityType,
        ...expiryParams,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document deleted')
      setDeleting(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete document'))
      setDeleting(null)
    },
  })

  const downloadMutation = useMutation({
    mutationFn: downloadDocument,
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to download document')),
  })

  const columns: ColumnDef<DocumentRecord, unknown>[] = [
    { header: 'Document', accessorKey: 'documentType' },
    { header: 'Linked to', cell: ({ row }) => ENTITY_TYPE_LABELS[row.original.relatedEntityType] },
    { header: 'Record', cell: ({ row }) => linkedName(row.original) },
    { header: 'Issued', cell: ({ row }) => formatDate(row.original.issueDate) },
    { header: 'Expires', cell: ({ row }) => formatDate(row.original.expiryDate) },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.expiryStatus} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Download document"
            disabled={downloadMutation.isPending}
            onClick={() => downloadMutation.mutate(row.original)}
          >
            <Download className="h-4 w-4" />
          </Button>
          {canManage ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete document"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Central register of certificates, licences, and contracts with expiry tracking."
        actions={
          canManage ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Plus className="h-4 w-4" />
              Upload document
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by type or notes"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="w-72"
        />

        <Select
          value={entityType}
          onValueChange={(value) => {
            setEntityType(value as RelatedEntityType | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={expiry}
          onValueChange={(value) => {
            setExpiry(value as ExpiryFilter)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Any expiry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any expiry</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="EXPIRING_30">Expiring ≤ 30 days</SelectItem>
            <SelectItem value="EXPIRING_90">Expiring ≤ 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          emptyMessage="No documents found"
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

      {canManage ? <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} /> : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete document"
        description={
          deleting ? `Delete "${deleting.documentType}" for ${linkedName(deleting)}?` : ''
        }
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  )
}
