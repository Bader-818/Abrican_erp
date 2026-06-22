import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
import { createClient, updateClient } from '@/api/clients.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { ClientDetail, ClientSummary } from '@/types'

const CLIENT_TYPES = [
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'SEMI_GOVERNMENT', label: 'Semi-government' },
  { value: 'PRIVATE', label: 'Private' },
  { value: 'CONTRACTOR', label: 'Contractor' },
] as const

const clientFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  clientType: z.enum(['GOVERNMENT', 'SEMI_GOVERNMENT', 'PRIVATE', 'CONTRACTOR']),
  vatNumber: z.string().max(50).optional(),
  crNumber: z.string().max(50).optional(),
  billingAddress: z.string().max(500).optional(),
  paymentTermsDays: z
    .string()
    .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 0), 'Enter a whole number of days'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  notes: z.string().max(2000).optional(),
})

type ClientFormValues = z.infer<typeof clientFormSchema>

export interface ClientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: ClientSummary | ClientDetail | null
}

export function ClientFormDialog({ open, onOpenChange, client }: ClientFormDialogProps) {
  const mode = client ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: '',
      clientType: 'PRIVATE',
      vatNumber: '',
      crNumber: '',
      billingAddress: '',
      paymentTermsDays: '',
      status: 'ACTIVE',
      notes: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: client?.name ?? '',
        clientType: client?.clientType ?? 'PRIVATE',
        vatNumber: client?.vatNumber ?? '',
        crNumber: client?.crNumber ?? '',
        billingAddress: (client && 'billingAddress' in client && client.billingAddress) || '',
        paymentTermsDays: client?.paymentTermsDays != null ? String(client.paymentTermsDays) : '',
        status: client?.status ?? 'ACTIVE',
        notes: (client && 'notes' in client && client.notes) || '',
      })
    }
  }, [open, client, reset])

  const mutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const payload = {
        name: values.name,
        clientType: values.clientType,
        vatNumber: values.vatNumber || undefined,
        crNumber: values.crNumber || undefined,
        billingAddress: values.billingAddress || undefined,
        paymentTermsDays: values.paymentTermsDays === '' ? undefined : Number(values.paymentTermsDays),
        status: values.status,
        notes: values.notes || undefined,
      }
      return mode === 'create' ? createClient(payload) : updateClient(client!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success(mode === 'create' ? 'Client created' : 'Client updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save client'))
    },
  })

  const clientType = watch('clientType')
  const status = watch('status')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New client' : 'Edit client'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Register a new client organization.'
              : 'Update client details and status.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client type</Label>
              <Select
                value={clientType}
                onValueChange={(value) => setValue('clientType', value as ClientFormValues['clientType'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setValue('status', value as ClientFormValues['status'])}
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vatNumber">VAT number</Label>
              <Input id="vatNumber" {...register('vatNumber')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crNumber">CR number</Label>
              <Input id="crNumber" {...register('crNumber')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="billingAddress">Billing address</Label>
            <Input id="billingAddress" {...register('billingAddress')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paymentTermsDays">Payment terms (days)</Label>
            <Input id="paymentTermsDays" inputMode="numeric" {...register('paymentTermsDays')} />
            {errors.paymentTermsDays ? (
              <p className="text-xs text-red-600">{errors.paymentTermsDays.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Create client' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
