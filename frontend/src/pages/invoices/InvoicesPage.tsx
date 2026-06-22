import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { fetchInvoices } from '@/api/invoices.api'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { InvoiceStatus, InvoiceSummary } from '@/types'

const PAGE_SIZE = 20
const STATUSES: InvoiceStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SUBMITTED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
]

export function InvoicesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InvoiceStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { page, search: debouncedSearch, status }],
    queryFn: () =>
      fetchInvoices({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const columns: ColumnDef<InvoiceSummary, unknown>[] = [
    {
      header: 'Number',
      cell: ({ row }) => (
        <Link to={`/invoices/${row.original.id}`} className="font-medium text-blue-700 hover:underline">
          {row.original.invoiceNumber}
        </Link>
      ),
    },
    { header: 'Client', cell: ({ row }) => row.original.client.name },
    { header: 'Invoice date', cell: ({ row }) => formatDate(row.original.invoiceDate) },
    { header: 'Due date', cell: ({ row }) => formatDate(row.original.dueDate) },
    { header: 'Total', cell: ({ row }) => formatCurrency(row.original.totalAmount) },
    { header: 'Outstanding', cell: ({ row }) => formatCurrency(row.original.outstandingAmount) },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Bill issued jobs and track receivables. Create invoices from an approved estimate."
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by number or client"
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
            setStatus(value as InvoiceStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-52">
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
        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No invoices found" />
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
    </div>
  )
}
