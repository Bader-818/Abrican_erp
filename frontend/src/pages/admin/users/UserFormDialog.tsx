import { useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/Spinner'
import { fetchRoles } from '@/api/roles.api'
import { createUser, updateUser } from '@/api/users.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { UserSummary } from '@/types'

// Mirrors the backend password policy (is-strong-password.validator.ts):
// 12-128 chars with at least 3 of: lowercase, uppercase, number, symbol.
const PASSWORD_MESSAGE =
  'Password must be 12-128 characters and include at least 3 of: lowercase, uppercase, number, symbol'

function isStrongPassword(value: string): boolean {
  if (value.length < 12 || value.length > 128) return false
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(value))
  return classes.length >= 3
}

function buildSchema(mode: 'create' | 'edit') {
  return z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: z.string().refine(
      (value) => (mode === 'edit' && value === '' ? true : isStrongPassword(value)),
      PASSWORD_MESSAGE,
    ),
    roleId: z.string().min(1, 'Role is required'),
    status: z.enum(['ACTIVE', 'INACTIVE']),
  })
}

type UserFormValues = z.infer<ReturnType<typeof buildSchema>>

export interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: UserSummary | null
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const mode = user ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(buildSchema(mode)),
    defaultValues: { name: '', email: '', password: '', roleId: '', status: 'ACTIVE' },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: user?.name ?? '',
        email: user?.email ?? '',
        password: '',
        roleId: user?.role.id ?? '',
        status: user?.status ?? 'ACTIVE',
      })
    }
  }, [open, user, reset])

  const mutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (mode === 'create') {
        return createUser({
          name: values.name,
          email: values.email,
          password: values.password,
          roleId: values.roleId,
          status: values.status,
        })
      }
      return updateUser(user!.id, {
        name: values.name,
        email: values.email,
        roleId: values.roleId,
        status: values.status,
        ...(values.password ? { password: values.password } : {}),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(mode === 'create' ? 'User created' : 'User updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save user'))
    },
  })

  const status = watch('status')
  const roleId = watch('roleId')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New user' : 'Edit user'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new user account and assign a role.'
              : 'Update account details, role, or status.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{mode === 'create' ? 'Password' : 'New password (optional)'}</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={(value) => setValue('roleId', value, { shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.roleId ? <p className="text-xs text-red-600">{errors.roleId.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setValue('status', value as UserFormValues['status'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Create user' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
