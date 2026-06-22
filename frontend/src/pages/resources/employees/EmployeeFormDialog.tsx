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
import { Spinner } from '@/components/Spinner'
import { createEmployee, updateEmployee } from '@/api/employees.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { AvailabilityStatus, Employee } from '@/types'

const AVAILABILITY_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'SICK', label: 'Sick' },
  { value: 'INACTIVE', label: 'Inactive' },
]

const employeeFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.string().min(2, 'Role is required').max(100),
  department: z.string().max(100),
  costRate: z
    .string()
    .refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), 'Enter a valid rate'),
  availabilityStatus: z.enum(['AVAILABLE', 'ASSIGNED', 'ON_LEAVE', 'SICK', 'INACTIVE']),
  phone: z.string().max(30),
  email: z
    .string()
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Enter a valid email address'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
})

type EmployeeFormValues = z.infer<typeof employeeFormSchema>

export interface EmployeeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee | null
}

export function EmployeeFormDialog({ open, onOpenChange, employee }: EmployeeFormDialogProps) {
  const mode = employee ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: '',
      role: '',
      department: '',
      costRate: '',
      availabilityStatus: 'AVAILABLE',
      phone: '',
      email: '',
      status: 'ACTIVE',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: employee?.name ?? '',
        role: employee?.role ?? '',
        department: employee?.department ?? '',
        costRate: employee?.costRate != null ? String(employee.costRate) : '',
        availabilityStatus: employee?.availabilityStatus ?? 'AVAILABLE',
        phone: employee?.phone ?? '',
        email: employee?.email ?? '',
        status: employee?.status ?? 'ACTIVE',
      })
    }
  }, [open, employee, reset])

  const mutation = useMutation({
    mutationFn: async (values: EmployeeFormValues) => {
      const payload = {
        name: values.name,
        role: values.role,
        department: values.department || undefined,
        costRate: values.costRate === '' ? undefined : Number(values.costRate),
        availabilityStatus: values.availabilityStatus,
        phone: values.phone || undefined,
        email: values.email || undefined,
        status: values.status,
      }
      return mode === 'create' ? createEmployee(payload) : updateEmployee(employee!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success(mode === 'create' ? 'Employee created' : 'Employee updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save employee'))
    },
  })

  const availabilityStatus = watch('availabilityStatus')
  const status = watch('status')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New employee' : 'Edit employee'}</DialogTitle>
          <DialogDescription>Workforce record used for crews and job assignments.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="employee-name">Name</Label>
            <Input id="employee-name" {...register('name')} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="employee-role">Role</Label>
              <Input id="employee-role" placeholder="e.g. Pipeline Technician" {...register('role')} />
              {errors.role ? <p className="text-xs text-red-600">{errors.role.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employee-department">Department</Label>
              <Input id="employee-department" {...register('department')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Availability</Label>
              <Select
                value={availabilityStatus}
                onValueChange={(value) =>
                  setValue('availabilityStatus', value as EmployeeFormValues['availabilityStatus'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setValue('status', value as EmployeeFormValues['status'])}
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

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="employee-costRate">Cost rate (SAR/h)</Label>
              <Input id="employee-costRate" inputMode="decimal" {...register('costRate')} />
              {errors.costRate ? <p className="text-xs text-red-600">{errors.costRate.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employee-phone">Phone</Label>
              <Input id="employee-phone" {...register('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employee-email">Email</Label>
              <Input id="employee-email" type="email" {...register('email')} />
              {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Create employee' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
