import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { KeyRound, LogOut, MoreVertical, Pencil, Plus, ShieldOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { fetchRoles } from '@/api/roles.api'
import {
  adminDisableMfa,
  adminForceLogout,
  deleteUser,
  fetchUsers,
} from '@/api/users.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { UserStatus, UserSummary } from '@/types'
import { UserFormDialog } from './UserFormDialog'
import { ResetPasswordDialog } from './ResetPasswordDialog'

const PAGE_SIZE = 20

export function UsersPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('users.manage')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleId, setRoleId] = useState<string>('ALL')
  const [status, setStatus] = useState<UserStatus | 'ALL'>('ALL')
  const debouncedSearch = useDebouncedValue(search)

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null)
  const [deletingUser, setDeletingUser] = useState<UserSummary | null>(null)
  const [resettingUser, setResettingUser] = useState<UserSummary | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    user: UserSummary
    type: 'disable-mfa' | 'force-logout'
  } | null>(null)

  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles })

  const { data, isLoading } = useQuery({
    queryKey: ['users', { page, search: debouncedSearch, roleId, status }],
    queryFn: () =>
      fetchUsers({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        roleId: roleId === 'ALL' ? undefined : roleId,
        status: status === 'ALL' ? undefined : status,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted')
      setDeletingUser(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete user'))
      setDeletingUser(null)
    },
  })

  const disableMfaMutation = useMutation({
    mutationFn: adminDisableMfa,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('MFA disabled for user')
      setConfirmAction(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to disable MFA'))
      setConfirmAction(null)
    },
  })

  const forceLogoutMutation = useMutation({
    mutationFn: adminForceLogout,
    onSuccess: (res) => {
      toast.success(`Signed the user out of ${res.revoked} session(s)`)
      setConfirmAction(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to sign the user out'))
      setConfirmAction(null)
    },
  })

  const columns: ColumnDef<UserSummary, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Role', cell: ({ row }) => row.original.role.name },
    {
      header: 'MFA',
      cell: ({ row }) =>
        row.original.mfaEnabled ? (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">On</span>
        ) : (
          <span className="text-xs text-slate-400">Off</span>
        ),
    },
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
            aria-label="Edit user"
            onClick={() => {
              setEditingUser(row.original)
              setFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete user"
            onClick={() => setDeletingUser(row.original)}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setResettingUser(row.original)}>
                <KeyRound className="mr-2 h-4 w-4" />
                Reset password
              </DropdownMenuItem>
              {row.original.mfaEnabled ? (
                <DropdownMenuItem onSelect={() => setConfirmAction({ user: row.original, type: 'disable-mfa' })}>
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Disable MFA
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => setConfirmAction({ user: row.original, type: 'force-logout' })}>
                <LogOut className="mr-2 h-4 w-4" />
                Force sign-out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage user accounts and role assignments."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditingUser(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New user
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name or email"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="w-64"
        />

        <Select
          value={roleId}
          onValueChange={(value) => {
            setRoleId(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {roles?.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as UserStatus | 'ALL')
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
        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No users found" />
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
        <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editingUser} />
      ) : null}

      <ConfirmDialog
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        title="Delete user"
        description={`Are you sure you want to delete "${deletingUser?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
      />

      {canManage ? (
        <ResetPasswordDialog
          open={!!resettingUser}
          onOpenChange={(open) => !open && setResettingUser(null)}
          user={resettingUser}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.type === 'disable-mfa' ? 'Disable MFA' : 'Force sign-out'}
        description={
          confirmAction?.type === 'disable-mfa'
            ? `Turn off two-factor authentication for "${confirmAction?.user.name}"? They can re-enable it from their security settings.`
            : `Sign "${confirmAction?.user.name}" out of all sessions on every device?`
        }
        confirmLabel={confirmAction?.type === 'disable-mfa' ? 'Disable MFA' : 'Sign out'}
        destructive
        isLoading={disableMfaMutation.isPending || forceLogoutMutation.isPending}
        onConfirm={() => {
          if (!confirmAction) return
          if (confirmAction.type === 'disable-mfa') disableMfaMutation.mutate(confirmAction.user.id)
          else forceLogoutMutation.mutate(confirmAction.user.id)
        }}
      />
    </div>
  )
}
