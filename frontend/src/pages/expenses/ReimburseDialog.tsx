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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/Spinner'
import { reimburseExpense, type ReimbursePayload } from '@/api/expenses.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { PaymentMethod } from '@/types'

type ReimburseAction = ReimbursePayload['status']
const ACTIONS: { value: ReimburseAction; label: string }[] = [
  { value: 'COMPENSATED', label: 'Compensated (paid back)' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'DECLINED', label: 'Declined' },
]
const METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CHECK', 'CASH', 'CARD', 'OTHER']

export interface ReimburseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expenseId: string
  onDone?: () => void
}

export function ReimburseDialog({ open, onOpenChange, expenseId, onDone }: ReimburseDialogProps) {
  const [status, setStatus] = useState<ReimburseAction>('COMPENSATED')
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setStatus('COMPENSATED')
    setMethod('BANK_TRANSFER')
    setReference('')
    setDate(new Date().toISOString().slice(0, 10))
    setNote('')
  }, [open])

  const mutation = useMutation({
    mutationFn: () =>
      reimburseExpense(expenseId, {
        status,
        note: note.trim() || undefined,
        ...(status === 'COMPENSATED'
          ? { method, reference: reference.trim() || undefined, date }
          : {}),
      }),
    onSuccess: () => {
      toast.success('Reimbursement updated')
      onOpenChange(false)
      onDone?.()
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to update reimbursement')),
  })

  const isPaid = status === 'COMPENSATED'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reimbursement</DialogTitle>
          <DialogDescription>Record how this employee's out-of-pocket expense is being settled.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Outcome</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ReimburseAction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isPaid ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reimb-date">Paid on</Label>
                <Input id="reimb-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="reimb-ref">Reference (optional)</Label>
                <Input id="reimb-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="reimb-note">Note (optional)</Label>
            <Textarea id="reimb-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
