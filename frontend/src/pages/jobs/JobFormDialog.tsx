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
import { fetchContracts } from '@/api/contracts.api'
import { fetchPurchaseOrders } from '@/api/purchase-orders.api'
import { createJob, updateJob } from '@/api/jobs.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { JobDetail, JobSummary } from '@/types'

const NONE = 'NONE'

const optionalAmount = z
  .string()
  .refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), 'Enter a valid amount')

const jobFormSchema = z
  .object({
    title: z.string().min(2, 'Title must be at least 2 characters').max(200),
    clientId: z.string().min(1, 'Client is required'),
    contractId: z.string(),
    purchaseOrderId: z.string(),
    serviceType: z.string().min(2, 'Service type is required').max(100),
    location: z.string().min(2, 'Location is required').max(200),
    region: z.string().max(100),
    plannedStartDate: z.string().min(1, 'Start date is required'),
    plannedEndDate: z.string().min(1, 'End date is required'),
    jobValue: optionalAmount,
    costBudget: optionalAmount,
    description: z.string().max(2000),
  })
  .refine((values) => new Date(values.plannedEndDate) > new Date(values.plannedStartDate), {
    message: 'Planned end date must be after the start date',
    path: ['plannedEndDate'],
  })

type JobFormValues = z.infer<typeof jobFormSchema>

export interface JobFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job?: JobSummary | JobDetail | null
}

export function JobFormDialog({ open, onOpenChange, job }: JobFormDialogProps) {
  const mode = job ? 'edit' : 'create'
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
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: '',
      clientId: '',
      contractId: NONE,
      purchaseOrderId: NONE,
      serviceType: '',
      location: '',
      region: '',
      plannedStartDate: '',
      plannedEndDate: '',
      jobValue: '',
      costBudget: '',
      description: '',
    },
  })

  const clientId = watch('clientId')
  const contractId = watch('contractId')
  const purchaseOrderId = watch('purchaseOrderId')

  const { data: clientContracts } = useQuery({
    queryKey: ['contracts', { clientId, pageSize: 100 }],
    queryFn: () => fetchContracts({ clientId, pageSize: 100 }),
    enabled: open && !!clientId,
  })

  const { data: clientPos } = useQuery({
    queryKey: ['purchase-orders', { clientId, pageSize: 100 }],
    queryFn: () => fetchPurchaseOrders({ clientId, pageSize: 100 }),
    enabled: open && !!clientId,
  })

  useEffect(() => {
    if (open) {
      reset({
        title: job?.title ?? '',
        clientId: job?.client.id ?? '',
        contractId: job?.contract?.id ?? NONE,
        purchaseOrderId: job?.purchaseOrder?.id ?? NONE,
        serviceType: job?.serviceType ?? '',
        location: job?.location ?? '',
        region: job?.region ?? '',
        plannedStartDate: job ? job.plannedStartDate.slice(0, 10) : '',
        plannedEndDate: job ? job.plannedEndDate.slice(0, 10) : '',
        jobValue: job?.jobValue != null ? String(job.jobValue) : '',
        costBudget: job && 'costBudget' in job && job.costBudget != null ? String(job.costBudget) : '',
        description: (job && 'description' in job && job.description) || '',
      })
    }
  }, [open, job, reset])

  const mutation = useMutation({
    mutationFn: async (values: JobFormValues) => {
      const payload = {
        title: values.title,
        clientId: values.clientId,
        contractId: values.contractId === NONE ? null : values.contractId,
        purchaseOrderId: values.purchaseOrderId === NONE ? null : values.purchaseOrderId,
        serviceType: values.serviceType,
        location: values.location,
        region: values.region || undefined,
        plannedStartDate: values.plannedStartDate,
        plannedEndDate: values.plannedEndDate,
        jobValue: values.jobValue === '' ? undefined : Number(values.jobValue),
        costBudget: values.costBudget === '' ? undefined : Number(values.costBudget),
        description: values.description || undefined,
      }
      if (mode === 'create') {
        const { contractId: contractValue, purchaseOrderId: poValue, ...rest } = payload
        return createJob({
          ...rest,
          ...(contractValue ? { contractId: contractValue } : {}),
          ...(poValue ? { purchaseOrderId: poValue } : {}),
        })
      }
      return updateJob(job!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.success(mode === 'create' ? 'Job created' : 'Job updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save job'))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New job' : 'Edit job'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a job under a client, optionally linked to a contract and purchase order. A job code is assigned automatically.'
              : `Update details for ${job?.jobCode}. Status changes are made from the job page.`}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} />
            {errors.title ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select
                value={clientId}
                onValueChange={(value) => {
                  setValue('clientId', value, { shouldValidate: true })
                  setValue('contractId', NONE)
                  setValue('purchaseOrderId', NONE)
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
                  <SelectItem value={NONE}>No contract</SelectItem>
                  {clientContracts?.data.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.contractNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Purchase order (optional)</Label>
              <Select
                value={purchaseOrderId}
                onValueChange={(value) => setValue('purchaseOrderId', value)}
                disabled={!clientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No PO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No PO</SelectItem>
                  {clientPos?.data.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.poNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="serviceType">Service type</Label>
              <Input id="serviceType" placeholder="e.g. Pipeline Maintenance" {...register('serviceType')} />
              {errors.serviceType ? (
                <p className="text-xs text-red-600">{errors.serviceType.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...register('location')} />
              {errors.location ? <p className="text-xs text-red-600">{errors.location.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="region">Region</Label>
              <Input id="region" placeholder="e.g. Eastern Province" {...register('region')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="plannedStartDate">Planned start</Label>
              <Input id="plannedStartDate" type="date" {...register('plannedStartDate')} />
              {errors.plannedStartDate ? (
                <p className="text-xs text-red-600">{errors.plannedStartDate.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plannedEndDate">Planned end</Label>
              <Input id="plannedEndDate" type="date" {...register('plannedEndDate')} />
              {errors.plannedEndDate ? (
                <p className="text-xs text-red-600">{errors.plannedEndDate.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="jobValue">Job value (SAR)</Label>
              <Input id="jobValue" inputMode="decimal" {...register('jobValue')} />
              {errors.jobValue ? <p className="text-xs text-red-600">{errors.jobValue.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="costBudget">Cost budget (SAR)</Label>
              <Input id="costBudget" inputMode="decimal" {...register('costBudget')} />
              {errors.costBudget ? <p className="text-xs text-red-600">{errors.costBudget.message}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register('description')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Create job' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
