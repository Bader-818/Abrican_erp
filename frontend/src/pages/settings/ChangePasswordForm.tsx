import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/Spinner'
import { changePassword } from '@/api/auth.api'
import { useAuth } from '@/hooks/useAuth'
import { getApiErrorMessage } from '@/lib/api-error'

const strongPassword = z
  .string()
  .min(12, 'At least 12 characters')
  .max(128, 'At most 128 characters')
  .refine(
    (v) => [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(v)).length >= 3,
    'Use at least 3 of: lowercase, uppercase, number, symbol',
  )

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export function ChangePasswordForm({ onSuccess }: { onSuccess?: () => void }) {
  const { refreshUser } = useAuth()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: async () => {
      toast.success('Password changed. Other sessions were signed out.')
      reset()
      await refreshUser()
      onSuccess?.()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to change password')),
  })

  return (
    <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} />
        {errors.currentPassword ? <p className="text-xs text-red-600">{errors.currentPassword.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} />
        {errors.newPassword ? <p className="text-xs text-red-600">{errors.newPassword.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
        {errors.confirmPassword ? <p className="text-xs text-red-600">{errors.confirmPassword.message}</p> : null}
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? <Spinner /> : null}
        Change password
      </Button>
    </form>
  )
}
