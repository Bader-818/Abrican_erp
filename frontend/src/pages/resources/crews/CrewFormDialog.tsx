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
import { fetchEmployees } from '@/api/employees.api'
import { createCrew, updateCrew } from '@/api/crews.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { CrewDetail, CrewSummary } from '@/types'

const NO_SUPERVISOR = 'NONE'

const crewFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  supervisorId: z.string(),
  serviceCapability: z.string().max(200),
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'INACTIVE']),
})

type CrewFormValues = z.infer<typeof crewFormSchema>

export interface CrewFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  crew?: CrewSummary | CrewDetail | null
}

export function CrewFormDialog({ open, onOpenChange, crew }: CrewFormDialogProps) {
  const mode = crew ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const { data: employees } = useQuery({
    queryKey: ['employees', { pageSize: 100, status: 'ACTIVE' }],
    queryFn: () => fetchEmployees({ pageSize: 100, status: 'ACTIVE' }),
    enabled: open,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CrewFormValues>({
    resolver: zodResolver(crewFormSchema),
    defaultValues: { name: '', supervisorId: NO_SUPERVISOR, serviceCapability: '', status: 'AVAILABLE' },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: crew?.name ?? '',
        supervisorId: crew?.supervisor?.id ?? NO_SUPERVISOR,
        serviceCapability: crew?.serviceCapability ?? '',
        status: crew?.status ?? 'AVAILABLE',
      })
    }
  }, [open, crew, reset])

  const mutation = useMutation({
    mutationFn: async (values: CrewFormValues) => {
      const payload = {
        name: values.name,
        supervisorId: values.supervisorId === NO_SUPERVISOR ? undefined : values.supervisorId,
        serviceCapability: values.serviceCapability || undefined,
        status: values.status,
      }
      return mode === 'create' ? createCrew(payload) : updateCrew(crew!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crews'] })
      toast.success(mode === 'create' ? 'Crew created' : 'Crew updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save crew'))
    },
  })

  const supervisorId = watch('supervisorId')
  const status = watch('status')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New crew' : 'Edit crew'}</DialogTitle>
          <DialogDescription>A named team of employees assignable to jobs as a unit.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="crew-name">Name</Label>
            <Input id="crew-name" {...register('name')} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Supervisor</Label>
            <Select value={supervisorId} onValueChange={(value) => setValue('supervisorId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="No supervisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUPERVISOR}>No supervisor</SelectItem>
                {employees?.data.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name} — {employee.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="crew-capability">Service capability</Label>
            <Input
              id="crew-capability"
              placeholder="e.g. Pipeline maintenance, pigging"
              {...register('serviceCapability')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setValue('status', value as CrewFormValues['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Create crew' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
