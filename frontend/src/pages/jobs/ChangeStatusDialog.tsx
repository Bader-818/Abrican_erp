import { useEffect, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { changeJobStatus } from '@/api/jobs.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { ALLOWED_TRANSITIONS, JOB_STATUS_LABELS, PHASE_2_STATUSES } from '@/lib/job-status'
import type { JobDetail, JobStatus } from '@/types'

export interface ChangeStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: JobDetail
}

export function ChangeStatusDialog({ open, onOpenChange, job }: ChangeStatusDialogProps) {
  const { hasPermission } = useAuth()
  const canOverride = hasPermission('jobs.status_override')
  const queryClient = useQueryClient()

  const [toStatus, setToStatus] = useState<JobStatus | ''>('')
  const [reason, setReason] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideNeeded, setOverrideNeeded] = useState(false)

  const allowedTargets = ALLOWED_TRANSITIONS[job.status]
  // The assignment requirement only applies when activating a job that has none.
  const mayNeedOverride = toStatus === 'ACTIVE' && job._count.assignments === 0

  useEffect(() => {
    if (open) {
      setToStatus('')
      setReason('')
      setOverrideReason('')
      setOverrideNeeded(false)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () =>
      changeJobStatus(job.id, {
        toStatus: toStatus as JobStatus,
        reason: reason || undefined,
        overrideReason: overrideReason || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.success(`Job moved to ${JOB_STATUS_LABELS[toStatus as JobStatus]}`)
      onOpenChange(false)
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Failed to change status')
      if (message.includes('no active resource assignments') && canOverride) {
        setOverrideNeeded(true)
        toast.warning('This job has no assignments — provide an override reason to proceed.')
      } else {
        toast.error(message)
      }
    },
  })

  const showOverrideField = canOverride && (overrideNeeded || mayNeedOverride)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change job status</DialogTitle>
          <DialogDescription>
            {job.jobCode} is currently <strong>{JOB_STATUS_LABELS[job.status]}</strong>.
            {allowedTargets.length === 0 ? ' No further transitions are possible.' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>New status</Label>
            <Select value={toStatus} onValueChange={(value) => setToStatus(value as JobStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select the next status" />
              </SelectTrigger>
              <SelectContent>
                {allowedTargets.map((status) => (
                  <SelectItem key={status} value={status}>
                    {JOB_STATUS_LABELS[status]}
                    {PHASE_2_STATUSES.includes(status) ? ' (Phase 2)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status-reason">Reason (optional)</Label>
            <Textarea
              id="status-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          {showOverrideField ? (
            <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-3">
              <Label htmlFor="override-reason">Override reason</Label>
              <p className="text-xs text-amber-800">
                This job has no resource assignments. Activating it requires an override, which is
                recorded in the audit log.
              </p>
              <Textarea
                id="override-reason"
                rows={2}
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!toStatus || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner /> : null}
            Change status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
