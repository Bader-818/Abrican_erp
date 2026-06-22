import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/Spinner'

export interface RejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  isLoading?: boolean
  onConfirm: (reason: string) => void
}

export function RejectDialog({ open, onOpenChange, title = 'Reject', isLoading, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Optionally tell the submitter what needs fixing. They can revise and resubmit.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Reason (optional)</Label>
          <Textarea id="reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={() => onConfirm(reason)} disabled={isLoading}>
            {isLoading ? <Spinner /> : null}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
