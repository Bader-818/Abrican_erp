import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { createRateCard, updateRateCard } from '@/api/contracts.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { RateCard } from '@/types'

const rateCardFormSchema = z.object({
  serviceLine: z.string().min(2, 'Service line must be at least 2 characters').max(100),
  itemCode: z.string().max(50).optional(),
  description: z.string().min(2, 'Description must be at least 2 characters').max(500),
  unit: z.string().min(1, 'Unit is required').max(30),
  unitPrice: z
    .string()
    .min(1, 'Unit price is required')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, 'Enter a valid amount'),
  vatApplicable: z.boolean(),
  effectiveDate: z.string().min(1, 'Effective date is required'),
})

type RateCardFormValues = z.infer<typeof rateCardFormSchema>

export interface RateCardFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId: string
  rateCard?: RateCard | null
}

export function RateCardFormDialog({ open, onOpenChange, contractId, rateCard }: RateCardFormDialogProps) {
  const mode = rateCard ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RateCardFormValues>({
    resolver: zodResolver(rateCardFormSchema),
    defaultValues: {
      serviceLine: '',
      itemCode: '',
      description: '',
      unit: '',
      unitPrice: '',
      vatApplicable: true,
      effectiveDate: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        serviceLine: rateCard?.serviceLine ?? '',
        itemCode: rateCard?.itemCode ?? '',
        description: rateCard?.description ?? '',
        unit: rateCard?.unit ?? '',
        unitPrice: rateCard ? String(rateCard.unitPrice) : '',
        vatApplicable: rateCard?.vatApplicable ?? true,
        effectiveDate: rateCard ? rateCard.effectiveDate.slice(0, 10) : '',
      })
    }
  }, [open, rateCard, reset])

  const mutation = useMutation({
    mutationFn: async (values: RateCardFormValues) => {
      const payload = {
        serviceLine: values.serviceLine,
        itemCode: values.itemCode || undefined,
        description: values.description,
        unit: values.unit,
        unitPrice: Number(values.unitPrice),
        vatApplicable: values.vatApplicable,
        effectiveDate: values.effectiveDate,
      }
      return mode === 'create'
        ? createRateCard(contractId, payload)
        : updateRateCard(contractId, rateCard!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contracts', contractId] })
      toast.success(mode === 'create' ? 'Rate card item added' : 'Rate card item updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save rate card item'))
    },
  })

  const vatApplicable = watch('vatApplicable')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New rate card item' : 'Edit rate card item'}</DialogTitle>
          <DialogDescription>Priced service line item under this contract.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="serviceLine">Service line</Label>
              <Input id="serviceLine" {...register('serviceLine')} />
              {errors.serviceLine ? (
                <p className="text-xs text-red-600">{errors.serviceLine.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="itemCode">Item code</Label>
              <Input id="itemCode" {...register('itemCode')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register('description')} />
            {errors.description ? <p className="text-xs text-red-600">{errors.description.message}</p> : null}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" placeholder="e.g. hour, km, m2" {...register('unit')} />
              {errors.unit ? <p className="text-xs text-red-600">{errors.unit.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unitPrice">Unit price (SAR)</Label>
              <Input id="unitPrice" inputMode="decimal" {...register('unitPrice')} />
              {errors.unitPrice ? <p className="text-xs text-red-600">{errors.unitPrice.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="effectiveDate">Effective date</Label>
              <Input id="effectiveDate" type="date" {...register('effectiveDate')} />
              {errors.effectiveDate ? (
                <p className="text-xs text-red-600">{errors.effectiveDate.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="vatApplicable"
              checked={vatApplicable}
              onCheckedChange={(checked) => setValue('vatApplicable', checked === true)}
            />
            <Label htmlFor="vatApplicable">VAT applicable</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Add item' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
