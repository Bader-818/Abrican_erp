import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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
import { Spinner } from '@/components/Spinner'
import { adminResetPassword } from '@/api/users.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { UserSummary } from '@/types'

/** Generate a reasonably strong temporary password (meets the policy). */
function generateTempPassword(): string {
  const sets = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%^&*?']
  const all = sets.join('')
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  let pw = sets.map(pick).join('')
  for (let i = pw.length; i < 16; i++) pw += pick(all)
  return pw
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

export interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserSummary | null
}

export function ResetPasswordDialog({ open, onOpenChange, user }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (open) setPassword(generateTempPassword())
  }, [open])

  const mutation = useMutation({
    mutationFn: () => adminResetPassword(user!.id, password),
    onSuccess: () => {
      toast.success('Temporary password set. The user must change it on next login.')
      onOpenChange(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to reset password')),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a temporary password for <span className="font-medium">{user?.name}</span>. They’ll be
            signed out everywhere and required to change it on next login. Share it securely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="temp-password">Temporary password</Label>
          <div className="flex gap-2">
            <Input id="temp-password" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
            <Button type="button" variant="outline" onClick={() => setPassword(generateTempPassword())}>
              Regenerate
            </Button>
          </div>
          <p className="text-xs text-slate-400">Min 12 chars, at least 3 of: lowercase, uppercase, number, symbol.</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || password.length < 12}>
            {mutation.isPending ? <Spinner /> : null}
            Reset password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
