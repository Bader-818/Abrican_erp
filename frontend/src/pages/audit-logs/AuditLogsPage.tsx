import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { Pagination } from '@/components/Pagination'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetchAuditLogs } from '@/api/audit-logs.api'
import { formatDateTime } from '@/lib/formatters'
import type { AuditAction, AuditLog } from '@/types'

const PAGE_SIZE = 20

const ACTION_OPTIONS: AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'STATUS_CHANGE',
  'OVERRIDE',
  'APPROVE',
  'REJECT',
  'TOKEN_REUSE_DETECTED',
  'PASSWORD_CHANGED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'ACCOUNT_LOCKED',
  'SESSION_REVOKED',
]

const ACTION_VARIANTS: Record<AuditAction, NonNullable<BadgeProps['variant']>> = {
  CREATE: 'success',
  UPDATE: 'brand',
  DELETE: 'danger',
  LOGIN: 'default',
  LOGOUT: 'default',
  STATUS_CHANGE: 'warning',
  OVERRIDE: 'danger',
  APPROVE: 'success',
  REJECT: 'danger',
  TOKEN_REUSE_DETECTED: 'danger',
  PASSWORD_CHANGED: 'warning',
  MFA_ENABLED: 'success',
  MFA_DISABLED: 'warning',
  ACCOUNT_LOCKED: 'danger',
  SESSION_REVOKED: 'warning',
}

export function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<AuditAction | 'ALL'>('ALL')
  const [entityType, setEntityType] = useState('')
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { page, action, entityType }],
    queryFn: () =>
      fetchAuditLogs({
        page,
        pageSize: PAGE_SIZE,
        action: action === 'ALL' ? undefined : action,
        entityType: entityType.trim() || undefined,
      }),
  })

  const columns: ColumnDef<AuditLog, unknown>[] = [
    {
      header: 'Time',
      accessorKey: 'createdAt',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>
      ),
    },
    {
      header: 'User',
      cell: ({ row }) => row.original.user?.name ?? 'System',
    },
    {
      header: 'Action',
      cell: ({ row }) => <Badge variant={ACTION_VARIANTS[row.original.action]}>{row.original.action}</Badge>,
    },
    {
      header: 'Entity',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-slate-900">{row.original.entityType}</p>
          <p className="text-xs text-slate-400">{row.original.entityId}</p>
        </div>
      ),
    },
    {
      header: 'Comment',
      cell: ({ row }) => row.original.comment ?? '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" onClick={() => setSelectedLog(row.original)} aria-label="View details">
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="System-wide activity and change history." />

      <div className="flex flex-wrap gap-3">
        <Select
          value={action}
          onValueChange={(value) => {
            setAction(value as AuditAction | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All actions</SelectItem>
            {ACTION_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter by entity type (e.g. User)"
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value)
            setPage(1)
          }}
          className="w-64"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No audit log entries found" />
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

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedLog?.action} — {selectedLog?.entityType}
            </DialogTitle>
            <DialogDescription>
              {selectedLog ? formatDateTime(selectedLog.createdAt) : null}
              {selectedLog?.comment ? ` · ${selectedLog.comment}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Old value</p>
              <pre className="max-h-72 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                {selectedLog?.oldValue ? JSON.stringify(selectedLog.oldValue, null, 2) : '—'}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">New value</p>
              <pre className="max-h-72 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                {selectedLog?.newValue ? JSON.stringify(selectedLog.newValue, null, 2) : '—'}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
