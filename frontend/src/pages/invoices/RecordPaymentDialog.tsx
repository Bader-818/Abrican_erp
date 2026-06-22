import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { createPayment } from '@/api/payments.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency } from '@/lib/formatters'
import type { PaymentMethod } from '@/types'

const METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CHECK', 'CASH', 'CARD', 'OTHER']

export interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  outstanding: string
}

export function RecordPaymentDialog({ open, onOpenChange, invoiceId, outstanding }: RecordPaymentDialogProps) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER')
  const [referenceNumber, setReference] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setAmount(outstanding)
      setPaymentDate(new Date().toISOString().slice(0, 10))
      setMethod('BANK_TRANSFER')
      setReference('')
      setNotes('')
    }
  }, [open, outstanding])

  const mutation = useMutation({
    mutationFn: () =>
      createPayment({
        invoiceId,
        amount: Number(amount),
        paymentDate: paymentDate || undefined,
        method,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
      void queryClient.invalidateQueries({ queryKey: ['aging'] })
      toast.success('Payment recorded')
      onOpenChange(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to record payment')),
  })

  function onSubmit() {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return toast.error('Enter a valid amount')
    if (n > Number(outstanding)) return toast.error(`Amount exceeds the outstanding balance (${formatCurrency(outstanding)})`)
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Outstanding balance: {formatCurrency(outstanding)}. Recording a payment updates the invoice and job status automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount (SAR)</Label>
              <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Payment date</Label>
              <Input id="pay-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m.replace(/_/g, ' ').toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Reference (optional)</Label>
              <Input id="pay-ref" value={referenceNumber} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Notes (optional)</Label>
            <Textarea id="pay-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : null}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
