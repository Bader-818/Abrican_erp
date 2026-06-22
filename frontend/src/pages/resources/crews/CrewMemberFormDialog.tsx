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
import { addCrewMember, updateCrewMember } from '@/api/crews.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { CrewMember } from '@/types'

const memberFormSchema = z
  .object({
    employeeId: z.string().min(1, 'Employee is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string(),
    status: z.enum(['ACTIVE', 'INACTIVE']),
  })
  .refine((values) => !values.endDate || new Date(values.endDate) > new Date(values.startDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  })

type MemberFormValues = z.infer<typeof memberFormSchema>

export interface CrewMemberFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  crewId: string
  member?: CrewMember | null
}

export function CrewMemberFormDialog({ open, onOpenChange, crewId, member }: CrewMemberFormDialogProps) {
  const mode = member ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const { data: employees } = useQuery({
    queryKey: ['employees', { pageSize: 100, status: 'ACTIVE' }],
    queryFn: () => fetchEmployees({ pageSize: 100, status: 'ACTIVE' }),
    enabled: open && mode === 'create',
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: { employeeId: '', startDate: '', endDate: '', status: 'ACTIVE' },
  })

  useEffect(() => {
    if (open) {
      reset({
        employeeId: member?.employee.id ?? '',
        startDate: member ? member.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        endDate: member?.endDate ? member.endDate.slice(0, 10) : '',
        status: member?.status ?? 'ACTIVE',
      })
    }
  }, [open, member, reset])

  const mutation = useMutation({
    mutationFn: async (values: MemberFormValues) => {
      if (mode === 'create') {
        return addCrewMember(crewId, {
          employeeId: values.employeeId,
          startDate: values.startDate,
          endDate: values.endDate || undefined,
        })
      }
      return updateCrewMember(crewId, member!.id, {
        startDate: values.startDate,
        endDate: values.endDate || undefined,
        status: values.status,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crews'] })
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success(mode === 'create' ? 'Member added' : 'Member updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save crew member'))
    },
  })

  const employeeId = watch('employeeId')
  const status = watch('status')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add crew member' : 'Edit crew member'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add an employee to this crew.'
              : `Update membership for ${member?.employee.name}.`}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          {mode === 'create' ? (
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select
                value={employeeId}
                onValueChange={(value) => setValue('employeeId', value, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.data.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} — {employee.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.employeeId ? <p className="text-xs text-red-600">{errors.employeeId.message}</p> : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-startDate">Start date</Label>
              <Input id="member-startDate" type="date" {...register('startDate')} />
              {errors.startDate ? <p className="text-xs text-red-600">{errors.startDate.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-endDate">End date (optional)</Label>
              <Input id="member-endDate" type="date" {...register('endDate')} />
              {errors.endDate ? <p className="text-xs text-red-600">{errors.endDate.message}</p> : null}
            </div>
          </div>

          {mode === 'edit' ? (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setValue('status', value as MemberFormValues['status'])}
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
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {mode === 'create' ? 'Add member' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
