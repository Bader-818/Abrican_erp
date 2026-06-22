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
import { useAuth } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { deleteEmployee, fetchEmployees } from '@/api/employees.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { AvailabilityStatus, Employee, EmployeeStatus } from '@/types'
import { EmployeeFormDialog } from './EmployeeFormDialog'

const PAGE_SIZE = 20

const AVAILABILITY_STATUSES: AvailabilityStatus[] = ['AVAILABLE', 'ASSIGNED', 'ON_LEAVE', 'SICK', 'INACTIVE']

export function EmployeesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('employees.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [availability, setAvailability] = useState<AvailabilityStatus | 'ALL'>('ALL')
  const [status, setStatus] = useState<EmployeeStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const [formOpen, setFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['employees', { page, search: debouncedSearch, availability, status }],
    queryFn: () =>
      fetchEmployees({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        availabilityStatus: availability === 'ALL' ? undefined : availability,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee deleted')
      setDeletingEmployee(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete employee'))
      setDeletingEmployee(null)
    },
  })

  const columns: ColumnDef<Employee, unknown>[] = [
    { header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { header: 'Role', accessorKey: 'role' },
    { header: 'Department', cell: ({ row }) => row.original.department ?? '—' },
    {
      header: 'Crew',
      cell: ({ row }) =>
        row.original.crewMemberships.length > 0
          ? row.original.crewMemberships.map((m) => m.crew.name).join(', ')
          : '—',
    },
    { header: 'Availability', cell: ({ row }) => <StatusBadge status={row.original.availabilityStatus} /> },
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
            aria-label="Edit employee"
            onClick={() => {
              setEditingEmployee(row.original)
              setFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete employee"
            onClick={() => setDeletingEmployee(row.original)}
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
        title="Employees"
        description="Workforce roster, roles, and availability."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingEmployee(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New employee
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name, role, or department"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="w-72"
        />

        <Select
          value={availability}
          onValueChange={(value) => {
            setAvailability(value as AvailabilityStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All availability</SelectItem>
            {AVAILABILITY_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as EmployeeStatus | 'ALL')
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
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          emptyMessage="No employees found"
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
        <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editingEmployee} />
      ) : null}

      <ConfirmDialog
        open={!!deletingEmployee}
        onOpenChange={(open) => !open && setDeletingEmployee(null)}
        title="Delete employee"
        description={`Are you sure you want to delete "${deletingEmployee?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingEmployee && deleteMutation.mutate(deletingEmployee.id)}
      />
    </div>
  )
}
