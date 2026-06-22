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
import { fetchClients } from '@/api/clients.api'
import { fetchContracts } from '@/api/contracts.api'
import { createPurchaseOrder, updatePurchaseOrder } from '@/api/purchase-orders.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types'

const PO_STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED']

const NO_CONTRACT = 'NONE'

const poFormSchema = z
  .object({
    clientId: z.string().min(1, 'Client is required'),
    contractId: z.string(),
    poNumber: z.string().min(2, 'PO number must be at least 2 characters').max(50),
    poValue: z
      .string()
      .min(1, 'PO value is required')
      .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, 'Enter a valid amount'),
    issueDate: z.string().min(1, 'Issue date is required'),
    expiryDate: z.string().min(1, 'Expiry date is required'),
    status: z.enum(['DRAFT', 'ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED']),
  })
  .refine((values) => new Date(values.expiryDate) > new Date(values.issueDate), {
    message: 'Expiry date must be after issue date',
    path: ['expiryDate'],
  })

type PoFormValues = z.infer<typeof poFormSchema>

export interface PurchaseOrderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchaseOrder?: PurchaseOrder | null
}

export function PurchaseOrderFormDialog({ open, onOpenChange, purchaseOrder }: PurchaseOrderFormDialogProps) {
  const mode = purchaseOrder ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const { data: clients } = useQuery({
    queryKey: ['clients', { pageSize: 100 }],
    queryFn: () => fetchClients({ pageSize: 100 }),
    enabled: open,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PoFormValues>({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      clientId: '',
      contractId: NO_CONTRACT,
      poNumber: '',
      poValue: '',
      issueDate: '',
      expiryDate: '',
      status: 'DRAFT',
    },
  })

  const clientId = watch('clientId')
  const contractId = watch('contractId')
  const status = watch('status')

  const { data: clientContracts } = useQuery({
    queryKey: ['contracts', { clientId, pageSize: 100 }],
    queryFn: () => fetchContracts({ clientId, pageSize: 100 }),
    enabled: open && !!clientId,
  })

  useEffect(() => {
    if (open) {
      reset({
        clientId: purchaseOrder?.client.id ?? '',
        contractId: purchaseOrder?.contract?.id ?? NO_CONTRACT,
        poNumber: purchaseOrder?.poNumber ?? '',
        poValue: purchaseOrder ? String(purchaseOrder.poValue) : '',
        issueDate: purchaseOrder ? purchaseOrder.issueDate.slice(0, 10) : '',
        expiryDate: purchaseOrder ? purchaseOrder.expiryDate.slice(0, 10) : '',
        status: purchaseOrder?.status ?? 'DRAFT',
      })
    }
  }, [open, purchaseOrder, reset])

  const mutation = useMutation({
    mutationFn: async (values: PoFormValues) => {
      const payload = {
        clientId: values.clientId,
        contractId: values.contractId === NO_CONTRACT ? null : values.contractId,
        poNumber: values.poNumber,
        poValue: Number(values.poValue),
        issueDate: values.issueDate,
        expiryDate: values.expiryDate,
        status: values.status,
      }
      if (mode === 'create') {
        const { contractId: contractIdValue, ...rest } = payload
        return createPurchaseOrder({
          ...rest,
          ...(contractIdValue ? { contractId: contractIdValue } : {}),
        })
      }
      return updatePurchaseOrder(purchaseOrder!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success(mode === 'create' ? 'Purchase order created' : 'Purchase order updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save purchase order'))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New purchase order' : 'Edit purchase order'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Register a client purchase order, optionally under a contract.'
              : 'Update purchase order details and status.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select
              value={clientId}
              onValueChange={(value) => {
                setValue('clientId', value, { shouldValidate: true })
                setValue('contractId', NO_CONTRACT)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.data.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId ? <p className="text-xs text-red-600">{errors.clientId.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Contract (optional)</Label>
            <Select
              value={contractId}
              onValueChange={(value) => setValue('contractId', value)}
              disabled={!clientId}
            >
              <SelectTrigger>
                <SelectValue placeholder="No contract" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CONTRACT}>No contract</SelectItem>
                {clientContracts?.data.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>
                    {contract.contractNumber} — {contract.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="poNumber">PO number</Label>
              <Input id="poNumber" {...register('poNumber')} />
              {errors.poNumber ? <p className="text-xs text-red-600">{errors.poNumber.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="poValue">PO value (SAR)</Label>
              <Input id="poValue" inputMode="decimal" {...register('poValue')} />
              {errors.poValue ? <p className="text-xs text-red-600">{errors.poValue.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="issueDate">Issue date</Label>
              <Input id="issueDate" type="date" {...register('issueDate')} />
              {errors.issueDate ? <p className="text-xs text-red-600">{errors.issueDate.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiryDate">Expiry date</Label>
              <Input id="expiryDate" type="date" {...register('expiryDate')} />
              {errors.expiryDate ? <p className="text-xs text-red-600">{errors.expiryDate.message}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setValue('status', value as PoFormValues['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PO_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value.charAt(0) + value.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Create purchase order' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
