import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { fetchEstimates } from '@/api/estimates.api'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { EstimateStatus, EstimateSummary } from '@/types'
import { EstimateFormDialog } from './EstimateFormDialog'

const PAGE_SIZE = 20

const STATUSES: EstimateStatus[] = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED']

export function EstimatesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('estimates.manage')

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EstimateStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)
  const [formOpen, setFormOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['estimates', { page, search: debouncedSearch, status }],
    queryFn: () =>
      fetchEstimates({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const columns: ColumnDef<EstimateSummary, unknown>[] = [
    {
      header: 'Number',
      cell: ({ row }) => (
        <Link to={`/estimates/${row.original.id}`} className="font-medium text-blue-700 hover:underline">
          {row.original.estimateNumber}
        </Link>
      ),
    },
    { header: 'Title', accessorKey: 'title' },
    {
      header: 'Client',
      cell: ({ row }) => row.original.client.name,
    },
    { header: 'Job type', accessorKey: 'jobType' },
    { header: 'Total', cell: ({ row }) => formatCurrency(row.original.totalAmount) },
    { header: 'Valid until', cell: ({ row }) => formatDate(row.original.validUntil) },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estimates"
        description="Price jobs from contract rates, quote the client, then convert to a job."
        actions={
          canManage ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New estimate
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
          className="w-80"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as EstimateStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No estimates found" />
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

      {canManage ? <EstimateFormDialog open={formOpen} onOpenChange={setFormOpen} /> : null}
    </div>
  )
}
