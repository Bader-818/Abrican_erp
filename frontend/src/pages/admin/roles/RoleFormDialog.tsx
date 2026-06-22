import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/Spinner'
import { createRole, fetchPermissions, updateRole } from '@/api/roles.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatPermissionLabel } from '@/lib/formatters'
import type { Permission, Role } from '@/types'

const roleFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  permissionKeys: z.array(z.string()),
})

type RoleFormValues = z.infer<typeof roleFormSchema>

// Required for the frontend session to keep working (`/auth/me`); always
// kept in sync regardless of whether it's shown in the permission matrix.
const ALWAYS_INCLUDED_PERMISSIONS = ['auth.me']

export interface RoleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: Role | null
}

function groupPermissions(permissions: Permission[]): [string, Permission[]][] {
  const groups = new Map<string, Permission[]>()
  for (const permission of permissions) {
    if (ALWAYS_INCLUDED_PERMISSIONS.includes(permission.key)) continue
    const [prefix] = permission.key.split('.')
    if (!groups.has(prefix)) groups.set(prefix, [])
    groups.get(prefix)!.push(permission)
  }
  return Array.from(groups.entries())
}

export function RoleFormDialog({ open, onOpenChange, role }: RoleFormDialogProps) {
  const mode = role ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const { data: permissions } = useQuery({ queryKey: ['permissions'], queryFn: fetchPermissions })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: '', description: '', permissionKeys: [] },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: role?.name ?? '',
        description: role?.description ?? '',
        permissionKeys: role?.permissions ?? [],
      })
    }
  }, [open, role, reset])

  const mutation = useMutation({
    mutationFn: async (values: RoleFormValues) => {
      const permissionKeys = Array.from(new Set([...values.permissionKeys, ...ALWAYS_INCLUDED_PERMISSIONS]))
      const payload = { name: values.name, description: values.description, permissionKeys }
      if (mode === 'create') {
        return createRole(payload)
      }
      return updateRole(role!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success(mode === 'create' ? 'Role created' : 'Role updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save role'))
    },
  })

  const selectedPermissions = watch('permissionKeys')
  const groupedPermissions = useMemo(() => groupPermissions(permissions ?? []), [permissions])

  function togglePermission(key: string, checked: boolean) {
    const current = new Set(selectedPermissions)
    if (checked) current.add(key)
    else current.delete(key)
    setValue('permissionKeys', Array.from(current), { shouldDirty: true })
  }

  function toggleGroup(groupKeys: string[], checked: boolean) {
    const current = new Set(selectedPermissions)
    for (const key of groupKeys) {
      if (checked) current.add(key)
      else current.delete(key)
    }
    setValue('permissionKeys', Array.from(current), { shouldDirty: true })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New role' : 'Edit role'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new role and choose its permissions.'
              : 'Update the role name, description, and permissions.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...register('description')} />
            {errors.description ? <p className="text-xs text-red-600">{errors.description.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Permissions</Label>
            <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200 p-3">
              <div className="grid gap-4 sm:grid-cols-2">
                {groupedPermissions.map(([group, perms]) => {
                  const allChecked = perms.every((p) => selectedPermissions.includes(p.key))
                  const someChecked = perms.some((p) => selectedPermissions.includes(p.key))
                  return (
                    <div key={group} className="space-y-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900">
                        <Checkbox
                          checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                          onCheckedChange={(checked) => toggleGroup(perms.map((p) => p.key), checked === true)}
                        />
                        {formatPermissionLabel(group)}
                      </label>
                      <div className="ml-6 space-y-1.5">
                        {perms.map((permission) => (
                          <label key={permission.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                            <Checkbox
                              checked={selectedPermissions.includes(permission.key)}
                              onCheckedChange={(checked) => togglePermission(permission.key, checked === true)}
                            />
                            {formatPermissionLabel(permission.key.split('.').slice(1).join('.'))}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Create role' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
