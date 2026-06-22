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
import { createDailyReport, fetchDailyReport, updateDailyReport } from '@/api/daily-reports.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { DailyReportSummary } from '@/types'

const NONE = 'NONE'

export interface DailyReportFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report?: DailyReportSummary | null
}

export function DailyReportFormDialog({ open, onOpenChange, report }: DailyReportFormDialogProps) {
  const mode = report ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const [jobId, setJobId] = useState('')
  const [reportDate, setReportDate] = useState('')
  const [supervisorId, setSupervisorId] = useState(NONE)
  const [workPerformed, setWorkPerformed] = useState('')
  const [progressPct, setProgressPct] = useState('')
  const [clientRep, setClientRep] = useState('')
  const [weather, setWeather] = useState('')
  const [issues, setIssues] = useState('')
  const [materialsUsed, setMaterials] = useState('')
  const [equipmentUsed, setEquipment] = useState('')
  const [vehiclesUsed, setVehicles] = useState('')

  const { data: jobs } = useQuery({ queryKey: ['jobs', 'options'], queryFn: () => fetchJobs({ pageSize: 100 }), enabled: open })
  const { data: employees } = useQuery({ queryKey: ['employees', 'options'], queryFn: () => fetchEmployees({ pageSize: 100 }), enabled: open })

  useEffect(() => {
    if (!open) return
    if (report) {
      // Load full detail to prefill the editable fields.
      void fetchDailyReport(report.id).then((d) => {
        setJobId(d.job.id)
        setReportDate(d.reportDate.slice(0, 10))
        setSupervisorId(d.supervisor?.id ?? NONE)
        setWorkPerformed(d.workPerformed)
        setProgressPct(d.progressPct != null ? String(Number(d.progressPct)) : '')
        setClientRep(d.clientRep ?? '')
        setWeather(d.weather ?? '')
        setIssues(d.issues ?? '')
        setMaterials(d.materialsUsed ?? '')
        setEquipment(d.equipmentUsed ?? '')
        setVehicles(d.vehiclesUsed ?? '')
      })
    } else {
      setJobId('')
      setReportDate(new Date().toISOString().slice(0, 10))
      setSupervisorId(NONE)
      setWorkPerformed('')
      setProgressPct('')
      setClientRep('')
      setWeather('')
      setIssues('')
      setMaterials('')
      setEquipment('')
      setVehicles('')
    }
  }, [open, report])

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        reportDate,
        supervisorId: supervisorId === NONE ? undefined : supervisorId,
        workPerformed: workPerformed.trim(),
        progressPct: progressPct === '' ? undefined : Number(progressPct),
        clientRep: clientRep.trim() || undefined,
        weather: weather.trim() || undefined,
        issues: issues.trim() || undefined,
        materialsUsed: materialsUsed.trim() || undefined,
        equipmentUsed: equipmentUsed.trim() || undefined,
        vehiclesUsed: vehiclesUsed.trim() || undefined,
      }
      return mode === 'create'
        ? createDailyReport({ jobId, ...payload })
        : updateDailyReport(report!.id, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['daily-reports'] })
      toast.success(mode === 'create' ? 'Daily report created' : 'Daily report updated')
      onOpenChange(false)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to save daily report')),
  })

  function onSubmit() {
    if (mode === 'create' && !jobId) return toast.error('Select a job')
    if (!reportDate) return toast.error('Pick a date')
    if (!workPerformed.trim()) return toast.error('Describe the work performed')
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New daily report' : 'Edit daily report'}</DialogTitle>
          <DialogDescription>Record what happened on site. Submit it for approval when ready.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Job</Label>
              <Select value={jobId} onValueChange={setJobId} disabled={mode === 'edit'}>
                <SelectTrigger><SelectValue placeholder="Select a job" /></SelectTrigger>
                <SelectContent>
                  {jobs?.data.map((j) => <SelectItem key={j.id} value={j.id}>{j.jobCode} — {j.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-date">Date</Label>
              <Input id="dr-date" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Supervisor</Label>
              <Select value={supervisorId} onValueChange={setSupervisorId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {employees?.data.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-progress">Progress %</Label>
              <Input id="dr-progress" inputMode="decimal" value={progressPct} onChange={(e) => setProgressPct(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dr-work">Work performed</Label>
            <Textarea id="dr-work" rows={3} value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dr-rep">Client representative</Label>
              <Input id="dr-rep" value={clientRep} onChange={(e) => setClientRep(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-weather">Weather / conditions</Label>
              <Input id="dr-weather" value={weather} onChange={(e) => setWeather(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dr-issues">Issues / delays</Label>
            <Textarea id="dr-issues" rows={2} value={issues} onChange={(e) => setIssues(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dr-mat">Materials used</Label>
              <Textarea id="dr-mat" rows={2} value={materialsUsed} onChange={(e) => setMaterials(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-eq">Equipment used</Label>
              <Textarea id="dr-eq" rows={2} value={equipmentUsed} onChange={(e) => setEquipment(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-veh">Vehicles used</Label>
              <Textarea id="dr-veh" rows={2} value={vehiclesUsed} onChange={(e) => setVehicles(e.target.value)} />
            </div>
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
