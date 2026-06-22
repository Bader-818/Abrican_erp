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
import { createVehicle, updateVehicle } from '@/api/vehicles.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { Vehicle, VehicleStatus } from '@/types'

const VEHICLE_STATUSES: VehicleStatus[] = ['AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE']

const optionalNumber = (message: string) =>
  z.string().refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), message)

const vehicleFormSchema = z.object({
  plateNumber: z.string().min(2, 'Plate number is required').max(20),
  vehicleType: z.string().min(2, 'Vehicle type is required').max(100),
  make: z.string().max(50),
  model: z.string().max(50),
  year: z
    .string()
    .refine((value) => value === '' || (/^\d{4}$/.test(value) && Number(value) >= 1950), 'Enter a valid year'),
  ownershipType: z.enum(['OWNED', 'LEASED', 'RENTED']),
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE']),
  odometer: optionalNumber('Enter a valid odometer reading'),
  fuelType: z.string().max(30),
  registrationExpiry: z.string(),
  insuranceExpiry: z.string(),
  inspectionExpiry: z.string(),
  costRate: optionalNumber('Enter a valid rate'),
  notes: z.string().max(2000),
})

type VehicleFormValues = z.infer<typeof vehicleFormSchema>

export interface VehicleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle | null
}

export function VehicleFormDialog({ open, onOpenChange, vehicle }: VehicleFormDialogProps) {
  const mode = vehicle ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      plateNumber: '',
      vehicleType: '',
      make: '',
      model: '',
      year: '',
      ownershipType: 'OWNED',
      status: 'AVAILABLE',
      odometer: '',
      fuelType: '',
      registrationExpiry: '',
      insuranceExpiry: '',
      inspectionExpiry: '',
      costRate: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        plateNumber: vehicle?.plateNumber ?? '',
        vehicleType: vehicle?.vehicleType ?? '',
        make: vehicle?.make ?? '',
        model: vehicle?.model ?? '',
        year: vehicle?.year != null ? String(vehicle.year) : '',
        ownershipType: vehicle?.ownershipType ?? 'OWNED',
        status: vehicle?.status ?? 'AVAILABLE',
        odometer: vehicle?.odometer != null ? String(vehicle.odometer) : '',
        fuelType: vehicle?.fuelType ?? '',
        registrationExpiry: vehicle?.registrationExpiry ? vehicle.registrationExpiry.slice(0, 10) : '',
        insuranceExpiry: vehicle?.insuranceExpiry ? vehicle.insuranceExpiry.slice(0, 10) : '',
        inspectionExpiry: vehicle?.inspectionExpiry ? vehicle.inspectionExpiry.slice(0, 10) : '',
        costRate: vehicle?.costRate != null ? String(vehicle.costRate) : '',
        notes: vehicle?.notes ?? '',
      })
    }
  }, [open, vehicle, reset])

  const mutation = useMutation({
    mutationFn: async (values: VehicleFormValues) => {
      const payload = {
        plateNumber: values.plateNumber,
        vehicleType: values.vehicleType,
        make: values.make || undefined,
        model: values.model || undefined,
        year: values.year === '' ? undefined : Number(values.year),
        ownershipType: values.ownershipType,
        status: values.status,
        odometer: values.odometer === '' ? undefined : Number(values.odometer),
        fuelType: values.fuelType || undefined,
        registrationExpiry: values.registrationExpiry || undefined,
        insuranceExpiry: values.insuranceExpiry || undefined,
        inspectionExpiry: values.inspectionExpiry || undefined,
        costRate: values.costRate === '' ? undefined : Number(values.costRate),
        notes: values.notes || undefined,
      }
      return mode === 'create' ? createVehicle(payload) : updateVehicle(vehicle!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success(mode === 'create' ? 'Vehicle created' : 'Vehicle updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save vehicle'))
    },
  })

  const ownershipType = watch('ownershipType')
  const status = watch('status')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New vehicle' : 'Edit vehicle'}</DialogTitle>
          <DialogDescription>Fleet vehicle record with registration and expiry tracking.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-plate">Plate number</Label>
              <Input id="vehicle-plate" {...register('plateNumber')} />
              {errors.plateNumber ? <p className="text-xs text-red-600">{errors.plateNumber.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-type">Vehicle type</Label>
              <Input id="vehicle-type" placeholder="e.g. Flatbed Truck" {...register('vehicleType')} />
              {errors.vehicleType ? <p className="text-xs text-red-600">{errors.vehicleType.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-year">Year</Label>
              <Input id="vehicle-year" inputMode="numeric" {...register('year')} />
              {errors.year ? <p className="text-xs text-red-600">{errors.year.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-make">Make</Label>
              <Input id="vehicle-make" {...register('make')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-model">Model</Label>
              <Input id="vehicle-model" {...register('model')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-fuel">Fuel type</Label>
              <Input id="vehicle-fuel" {...register('fuelType')} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Ownership</Label>
              <Select
                value={ownershipType}
                onValueChange={(value) => setValue('ownershipType', value as VehicleFormValues['ownershipType'])}
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
                onValueChange={(value) => setValue('status', value as VehicleFormValues['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-odometer">Odometer (km)</Label>
              <Input id="vehicle-odometer" inputMode="numeric" {...register('odometer')} />
              {errors.odometer ? <p className="text-xs text-red-600">{errors.odometer.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-reg">Registration expiry</Label>
              <Input id="vehicle-reg" type="date" {...register('registrationExpiry')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-ins">Insurance expiry</Label>
              <Input id="vehicle-ins" type="date" {...register('insuranceExpiry')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-insp">Inspection expiry</Label>
              <Input id="vehicle-insp" type="date" {...register('inspectionExpiry')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-rate">Cost rate (SAR/day)</Label>
              <Input id="vehicle-rate" inputMode="decimal" {...register('costRate')} />
              {errors.costRate ? <p className="text-xs text-red-600">{errors.costRate.message}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vehicle-notes">Notes</Label>
            <Textarea id="vehicle-notes" rows={2} {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Create vehicle' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
