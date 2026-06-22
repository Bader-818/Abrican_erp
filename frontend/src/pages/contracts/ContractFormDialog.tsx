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
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/Spinner'
import { fetchClients } from '@/api/clients.api'
import { createContract, updateContract } from '@/api/contracts.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { ContractDetail, ContractStatus, ContractSummary } from '@/types'

const CONTRACT_STATUSES: ContractStatus[] = ['DRAFT', 'ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED']

const contractFormSchema = z
  .object({
    clientId: z.string().min(1, 'Client is required'),
    contractNumber: z.string().min(2, 'Contract number must be at least 2 characters').max(50),
    title: z.string().min(2, 'Title must be at least 2 characters').max(200),
    scope: z.string().max(2000).optional(),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    contractValue: z
      .string()
      .min(1, 'Contract value is required')
      .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, 'Enter a valid amount'),
    paymentTermsDays: z
      .string()
      .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 0), 'Enter a whole number of days'),
    status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED']),
  })
  .refine((values) => new Date(values.endDate) > new Date(values.startDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  })

type ContractFormValues = z.infer<typeof contractFormSchema>

export interface ContractFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract?: ContractSummary | ContractDetail | null
  defaultClientId?: string
}

export function ContractFormDialog({ open, onOpenChange, contract, defaultClientId }: ContractFormDialogProps) {
  const mode = contract ? 'edit' : 'create'
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
  } = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      clientId: '',
      contractNumber: '',
      title: '',
      scope: '',
      startDate: '',
      endDate: '',
      contractValue: '',
      paymentTermsDays: '',
      status: 'DRAFT',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        clientId: contract?.client.id ?? defaultClientId ?? '',
        contractNumber: contract?.contractNumber ?? '',
        title: contract?.title ?? '',
        scope: (contract && 'scope' in contract && contract.scope) || '',
        startDate: contract ? contract.startDate.slice(0, 10) : '',
        endDate: contract ? contract.endDate.slice(0, 10) : '',
        contractValue: contract ? String(contract.contractValue) : '',
        paymentTermsDays: contract?.paymentTermsDays != null ? String(contract.paymentTermsDays) : '',
        status: contract?.status ?? 'DRAFT',
      })
    }
  }, [open, contract, defaultClientId, reset])

  const mutation = useMutation({
    mutationFn: async (values: ContractFormValues) => {
      const payload = {
        clientId: values.clientId,
        contractNumber: values.contractNumber,
        title: values.title,
        scope: values.scope || undefined,
        startDate: values.startDate,
        endDate: values.endDate,
        contractValue: Number(values.contractValue),
        paymentTermsDays: values.paymentTermsDays === '' ? undefined : Number(values.paymentTermsDays),
        status: values.status,
      }
      return mode === 'create' ? createContract(payload) : updateContract(contract!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contracts'] })
      toast.success(mode === 'create' ? 'Contract created' : 'Contract updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save contract'))
    },
  })

  const clientId = watch('clientId')
  const status = watch('status')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New contract' : 'Edit contract'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Register a new client contract.'
              : 'Update contract details and status.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={(value) => setValue('clientId', value, { shouldValidate: true })}>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contractNumber">Contract number</Label>
              <Input id="contractNumber" {...register('contractNumber')} />
              {errors.contractNumber ? (
                <p className="text-xs text-red-600">{errors.contractNumber.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setValue('status', value as ContractFormValues['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.charAt(0) + value.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} />
            {errors.title ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scope">Scope</Label>
            <Textarea id="scope" rows={3} {...register('scope')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              {errors.startDate ? <p className="text-xs text-red-600">{errors.startDate.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
              {errors.endDate ? <p className="text-xs text-red-600">{errors.endDate.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contractValue">Contract value (SAR)</Label>
              <Input id="contractValue" inputMode="decimal" {...register('contractValue')} />
              {errors.contractValue ? (
                <p className="text-xs text-red-600">{errors.contractValue.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentTermsDays">Payment terms (days)</Label>
              <Input id="paymentTermsDays" inputMode="numeric" {...register('paymentTermsDays')} />
              {errors.paymentTermsDays ? (
                <p className="text-xs text-red-600">{errors.paymentTermsDays.message}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Create contract' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
