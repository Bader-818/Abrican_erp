import { useEffect, useState } from 'react'
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
import { fetchJobs } from '@/api/jobs.api'
import { fetchEmployees } from '@/api/employees.api'
import { fetchCrews } from '@/api/crews.api'
import { createTimesheet, fetchTimesheet, updateTimesheet } from '@/api/timesheets.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { TimesheetSummary } from '@/types'

type ResourceKind = 'EMPLOYEE' | 'CREW'
const num = (v: string) => (v === '' ? 0 : Number(v))

export interface TimesheetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  timesheet?: TimesheetSummary | null
}

export function TimesheetFormDialog({ open, onOpenChange, timesheet }: TimesheetFormDialogProps) {
  const mode = timesheet ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const [jobId, setJobId] = useState('')
  const [kind, setKind] = useState<ResourceKind>('EMPLOYEE')
  const [resourceId, setResourceId] = useState('')
  const [workDate, setWorkDate] = useState('')
  const [regularHours, setRegular] = useState('8')
  const [overtimeHours, setOvertime] = useState('0')
  const [standbyHours, setStandby] = useState('0')
  const [travelHours, setTravel] = useState('0')
  const [notes, setNotes] = useState('')

  const { data: jobs } = useQuery({ queryKey: ['jobs', 'options'], queryFn: () => fetchJobs({ pageSize: 100 }), enabled: open })
  const { data: employees } = useQuery({ queryKey: ['employees', 'options'], queryFn: () => fetchEmployees({ pageSize: 100 }), enabled: open && kind === 'EMPLOYEE' })
  const { data: crews } = useQuery({ queryKey: ['crews', 'options'], queryFn: () => fetchCrews({ pageSize: 100 }), enabled: open && kind === 'CREW' })

  useEffect(() => {
    if (!open) return
    if (timesheet) {
      void fetchTimesheet(timesheet.id).then((t) => {
        setJobId(t.job.id)
        setKind(t.crew ? 'CREW' : 'EMPLOYEE')
        setResourceId(t.employee?.id ?? t.crew?.id ?? '')
        setWorkDate(t.workDate.slice(0, 10))
        setRegular(String(Number(t.regularHours)))
        setOvertime(String(Number(t.overtimeHours)))
        setStandby(String(Number(t.standbyHours)))
        setTravel(String(Number(t.travelHours)))
        setNotes(t.notes ?? '')
      })
    } else {
      setJobId('')
      setKind('EMPLOYEE')
      setResourceId('')
      setWorkDate(new Date().toISOString().slice(0, 10))
      setRegular('8')
      setOvertime('0')
      setStandby('0')
      setTravel('0')
      setNotes('')
    }
  }, [open, timesheet])

  const totalHours = num(regularHours) + num(overtimeHours) + num(standbyHours) + num(travelHours)

  const mutation = useMutation({
    mutationFn: () => {
      const hours = {
        regularHours: num(regularHours),
        overtimeHours: num(overtimeHours),
        standbyHours: num(standbyHours),
        travelHours: num(travelHours),
        notes: notes.trim() || undefined,
      }
      if (mode === 'create') {
        return createTimesheet({
          jobId,
          workDate,
          ...(kind === 'EMPLOYEE' ? { employeeId: resourceId } : { crewId: resourceId }),
          ...hours,
        })
      }
      return updateTimesheet(timesheet!.id, { workDate, ...hours })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timesheets'] })
      toast.success(mode === 'create' ? 'Timesheet created' : 'Timesheet updated')
      onOpenChange(false)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to save timesheet')),
  })

  function onSubmit() {
    if (mode === 'create') {
      if (!jobId) return toast.error('Select a job')
      if (!resourceId) return toast.error('Select a resource')
    }
    if (!workDate) return toast.error('Pick a date')
    if (totalHours <= 0) return toast.error('Enter at least some hours')
    mutation.mutate()
  }

  const resources = kind === 'EMPLOYEE' ? employees?.data ?? [] : crews?.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New timesheet' : 'Edit timesheet'}</DialogTitle>
          <DialogDescription>Log labor hours against a job for a day.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'create' ? (
            <>
              <div className="space-y-1.5">
                <Label>Job</Label>
                <Select value={jobId} onValueChange={setJobId}>
                  <SelectTrigger><SelectValue placeholder="Select a job" /></SelectTrigger>
                  <SelectContent>
                    {jobs?.data.map((j) => <SelectItem key={j.id} value={j.id}>{j.jobCode} — {j.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Resource type</Label>
                  <Select value={kind} onValueChange={(v) => { setKind(v as ResourceKind); setResourceId('') }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      <SelectItem value="CREW">Crew</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{kind === 'EMPLOYEE' ? 'Employee' : 'Crew'}</Label>
                  <Select value={resourceId} onValueChange={setResourceId}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {resources.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="ts-date">Date</Label>
            <Input id="ts-date" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className="w-48" />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ts-reg">Regular</Label>
              <Input id="ts-reg" inputMode="decimal" value={regularHours} onChange={(e) => setRegular(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts-ot">Overtime</Label>
              <Input id="ts-ot" inputMode="decimal" value={overtimeHours} onChange={(e) => setOvertime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts-sb">Standby</Label>
              <Input id="ts-sb" inputMode="decimal" value={standbyHours} onChange={(e) => setStandby(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts-tr">Travel</Label>
              <Input id="ts-tr" inputMode="decimal" value={travelHours} onChange={(e) => setTravel(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-slate-500">Total: <span className="font-medium text-slate-900">{totalHours}h</span></p>

          <div className="space-y-1.5">
            <Label htmlFor="ts-notes">Notes (optional)</Label>
            <Textarea id="ts-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : null}
            {mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
