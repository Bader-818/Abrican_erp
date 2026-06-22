import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { deleteRole, fetchRoles } from '@/api/roles.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { Role } from '@/types'
import { RoleFormDialog } from './RoleFormDialog'

export function RolesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('roles.manage')
  const queryClient = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deletingRole, setDeletingRole] = useState<Role | null>(null)

  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles })

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role deleted')
      setDeletingRole(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete role'))
      setDeletingRole(null)
    },
  })

  const columns: ColumnDef<Role, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Description',
      cell: ({ row }) => <span className="text-slate-500">{row.original.description ?? '—'}</span>,
    },
    {
      header: 'Permissions',
      cell: ({ row }) => row.original.permissions.length,
    },
    {
      header: 'Users',
      cell: ({ row }) => row.original.userCount,
    },
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
            aria-label="Edit role"
            onClick={() => {
              setEditingRole(row.original)
              setFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete role"
            onClick={() => setDeletingRole(row.original)}
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
        title="Roles"
        description="Manage roles and the permissions granted to each."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingRole(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New role
            </Button>
          ) : null
        }
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} data={roles ?? []} isLoading={isLoading} emptyMessage="No roles found" />
      </div>

      {canManage ? (
        <RoleFormDialog open={formOpen} onOpenChange={setFormOpen} role={editingRole} />
      ) : null}

      <ConfirmDialog
        open={!!deletingRole}
        onOpenChange={(open) => !open && setDeletingRole(null)}
        title="Delete role"
        description={`Are you sure you want to delete "${deletingRole?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingRole && deleteMutation.mutate(deletingRole.id)}
      />
    </div>
  )
}
