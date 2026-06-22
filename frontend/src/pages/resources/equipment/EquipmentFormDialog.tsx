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
import { createEquipment, updateEquipment } from '@/api/equipment.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { Equipment, EquipmentStatus } from '@/types'

const EQUIPMENT_STATUSES: EquipmentStatus[] = ['AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE']

const equipmentFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  equipmentType: z.string().min(2, 'Equipment type is required').max(100),
  serialNumber: z.string().max(100),
  ownershipType: z.enum(['OWNED', 'LEASED', 'RENTED']),
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE']),
  costRate: z
    .string()
    .refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), 'Enter a valid rate'),
  currentLocation: z.string().max(200),
  calibrationExpiry: z.string(),
  maintenanceDueDate: z.string(),
  notes: z.string().max(2000),
})

type EquipmentFormValues = z.infer<typeof equipmentFormSchema>

export interface EquipmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment?: Equipment | null
}

export function EquipmentFormDialog({ open, onOpenChange, equipment }: EquipmentFormDialogProps) {
  const mode = equipment ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      name: '',
      equipmentType: '',
      serialNumber: '',
      ownershipType: 'OWNED',
      status: 'AVAILABLE',
      costRate: '',
      currentLocation: '',
      calibrationExpiry: '',
      maintenanceDueDate: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: equipment?.name ?? '',
        equipmentType: equipment?.equipmentType ?? '',
        serialNumber: equipment?.serialNumber ?? '',
        ownershipType: equipment?.ownershipType ?? 'OWNED',
        status: equipment?.status ?? 'AVAILABLE',
        costRate: equipment?.costRate != null ? String(equipment.costRate) : '',
        currentLocation: equipment?.currentLocation ?? '',
        calibrationExpiry: equipment?.calibrationExpiry ? equipment.calibrationExpiry.slice(0, 10) : '',
        maintenanceDueDate: equipment?.maintenanceDueDate ? equipment.maintenanceDueDate.slice(0, 10) : '',
        notes: equipment?.notes ?? '',
      })
    }
  }, [open, equipment, reset])

  const mutation = useMutation({
    mutationFn: async (values: EquipmentFormValues) => {
      const payload = {
        name: values.name,
        equipmentType: values.equipmentType,
        serialNumber: values.serialNumber || undefined,
        ownershipType: values.ownershipType,
        status: values.status,
        costRate: values.costRate === '' ? undefined : Number(values.costRate),
        currentLocation: values.currentLocation || undefined,
        calibrationExpiry: values.calibrationExpiry || undefined,
        maintenanceDueDate: values.maintenanceDueDate || undefined,
        notes: values.notes || undefined,
      }
      return mode === 'create' ? createEquipment(payload) : updateEquipment(equipment!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment'] })
      toast.success(mode === 'create' ? 'Equipment created' : 'Equipment updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save equipment'))
    },
  })

  const ownershipType = watch('ownershipType')
  const status = watch('status')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New equipment' : 'Edit equipment'}</DialogTitle>
          <DialogDescription>Equipment record with calibration and maintenance tracking.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="equipment-name">Name</Label>
              <Input id="equipment-name" {...register('name')} />
              {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equipment-type">Equipment type</Label>
              <Input id="equipment-type" placeholder="e.g. Compressor" {...register('equipmentType')} />
              {errors.equipmentType ? (
                <p className="text-xs text-red-600">{errors.equipmentType.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equipment-serial">Serial number</Label>
              <Input id="equipment-serial" {...register('serialNumber')} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Ownership</Label>
              <Select
                value={ownershipType}
                onValueChange={(value) =>
                  setValue('ownershipType', value as EquipmentFormValues['ownershipType'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNED">Owned</SelectItem>
                  <SelectItem value="LEASED">Leased</SelectItem>
                  <SelectItem value="RENTED">Rented</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setValue('status', value as EquipmentFormValues['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equipment-rate">Cost rate (SAR/h)</Label>
              <Input id="equipment-rate" inputMode="decimal" {...register('costRate')} />
              {errors.costRate ? <p className="text-xs text-red-600">{errors.costRate.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="equipment-location">Current location</Label>
              <Input id="equipment-location" {...register('currentLocation')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equipment-calibration">Calibration expiry</Label>
              <Input id="equipment-calibration" type="date" {...register('calibrationExpiry')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equipment-maintenance">Maintenance due</Label>
              <Input id="equipment-maintenance" type="date" {...register('maintenanceDueDate')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="equipment-notes">Notes</Label>
            <Textarea id="equipment-notes" rows={2} {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Create equipment' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
