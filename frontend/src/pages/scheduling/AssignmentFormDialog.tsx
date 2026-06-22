import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { AlertTriangle, Plus, RotateCcw, X } from 'lucide-react'
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
import { useAuth } from '@/hooks/useAuth'
import { fetchJob, fetchJobs } from '@/api/jobs.api'
import { fetchEmployees } from '@/api/employees.api'
import { fetchCrews } from '@/api/crews.api'
import { fetchVehicles } from '@/api/vehicles.api'
import { fetchEquipment } from '@/api/equipment.api'
import { createAssignmentsBulk, type BulkConflict } from '@/api/assignments.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDateTime } from '@/lib/formatters'
import type { ResourceType } from '@/types'

const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'CREW', label: 'Crew' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'EQUIPMENT', label: 'Equipment' },
]

const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  EMPLOYEE: 'Employee',
  CREW: 'Crew',
  VEHICLE: 'Vehicle',
  EQUIPMENT: 'Equipment',
}

// --- Shift presets ----------------------------------------------------------
type ShiftKey = 'DAY12' | 'NIGHT12' | 'DAY10' | 'CUSTOM'

const SHIFTS: { value: ShiftKey; label: string; start?: string; end?: string }[] = [
  { value: 'DAY12', label: 'Day shift · 06:00–18:00 (12h)', start: '06:00', end: '18:00' },
  { value: 'NIGHT12', label: 'Night shift · 18:00–06:00 (12h)', start: '18:00', end: '06:00' },
  { value: 'DAY10', label: 'Day · 06:00–16:00 (10h)', start: '06:00', end: '16:00' },
  { value: 'CUSTOM', label: 'Custom hours…' },
]

function fieldFor(type: ResourceType): 'employeeId' | 'crewId' | 'vehicleId' | 'equipmentId' {
  switch (type) {
    case 'EMPLOYEE':
      return 'employeeId'
    case 'CREW':
      return 'crewId'
    case 'VEHICLE':
      return 'vehicleId'
    case 'EQUIPMENT':
      return 'equipmentId'
  }
}

const timeToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Whether the shift's end time is on the following day (crosses midnight). */
const isNightShift = (start: string, end: string) => timeToMin(end) <= timeToMin(start)

/** Shift length in hours, accounting for a midnight wrap. */
function shiftLengthHours(start: string, end: string): number {
  const s = timeToMin(start)
  const e = timeToMin(end)
  const mins = e > s ? e - s : 1440 - (s - e)
  return Math.round((mins / 60) * 100) / 100
}

/** Compose a local date (yyyy-mm-dd) + time (HH:MM) into an ISO string. */
function composeIso(date: string, time: string): string {
  if (!date) return ''
  return new Date(`${date}T${time}`).toISOString()
}

const daysBetween = (start: string, end: string) =>
  Math.round((new Date(`${end}T00:00`).getTime() - new Date(`${start}T00:00`).getTime()) / 86_400_000)

function addDaysStr(date: string, days: number): string {
  const d = new Date(`${date}T00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const todayStr = () => new Date().toISOString().slice(0, 10)

interface StagedResource {
  key: string
  resourceType: ResourceType
  resourceId: string
  label: string
}

export interface AssignmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Lock to a specific job (e.g. from the job detail page). */
  lockedJobId?: string
}

export function AssignmentFormDialog({ open, onOpenChange, lockedJobId }: AssignmentFormDialogProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canOverride = hasPermission('assignments.override')

  const [jobId, setJobId] = useState(lockedJobId ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [shift, setShift] = useState<ShiftKey>('DAY12')
  const [customStart, setCustomStart] = useState('06:00')
  const [customEnd, setCustomEnd] = useState('18:00')
  const [datesTouched, setDatesTouched] = useState(false)
  const [plannedHours, setPlannedHours] = useState('')
  const [hoursTouched, setHoursTouched] = useState(false)
  const [addType, setAddType] = useState<ResourceType>('EMPLOYEE')
  const [addId, setAddId] = useState('')
  const [staged, setStaged] = useState<StagedResource[]>([])
  const [overrideReason, setOverrideReason] = useState('')
  const [blocked, setBlocked] = useState<BulkConflict[] | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setJobId(lockedJobId ?? '')
      setStartDate('')
      setEndDate('')
      setShift('DAY12')
      setCustomStart('06:00')
      setCustomEnd('18:00')
      setDatesTouched(false)
      setPlannedHours('')
      setHoursTouched(false)
      setAddType('EMPLOYEE')
      setAddId('')
      setStaged([])
      setOverrideReason('')
      setBlocked(null)
      setFormError(null)
    }
  }, [open, lockedJobId])

  // --- option sources -------------------------------------------------------
  const { data: jobs } = useQuery({
    queryKey: ['jobs', 'options'],
    queryFn: () => fetchJobs({ pageSize: 100 }),
    enabled: open && !lockedJobId,
  })

  // Default the window to the selected job's planned dates (until the user edits).
  const { data: jobDetail } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetchJob(jobId),
    enabled: open && !!jobId,
  })

  useEffect(() => {
    if (!open || datesTouched) return
    if (jobDetail) {
      setStartDate(jobDetail.plannedStartDate.slice(0, 10))
      setEndDate(jobDetail.plannedEndDate.slice(0, 10))
    } else if (!jobId && !startDate) {
      setStartDate(todayStr())
      setEndDate(todayStr())
    }
  }, [open, jobDetail, jobId, datesTouched, startDate])

  const { data: employees } = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => fetchEmployees({ pageSize: 100 }),
    enabled: open && addType === 'EMPLOYEE',
  })
  const { data: crews } = useQuery({
    queryKey: ['crews', 'options'],
    queryFn: () => fetchCrews({ pageSize: 100 }),
    enabled: open && addType === 'CREW',
  })
  const { data: vehicles } = useQuery({
    queryKey: ['vehicles', 'options'],
    queryFn: () => fetchVehicles({ pageSize: 100 }),
    enabled: open && addType === 'VEHICLE',
  })
  const { data: equipment } = useQuery({
    queryKey: ['equipment', 'options'],
    queryFn: () => fetchEquipment({ pageSize: 100 }),
    enabled: open && addType === 'EQUIPMENT',
  })

  const resourceOptions = useMemo(() => {
    switch (addType) {
      case 'EMPLOYEE':
        return (employees?.data ?? []).map((e) => ({ id: e.id, label: `${e.name} — ${e.role}` }))
      case 'CREW':
        return (crews?.data ?? []).map((c) => ({ id: c.id, label: c.name }))
      case 'VEHICLE':
        return (vehicles?.data ?? []).map((v) => ({ id: v.id, label: `${v.plateNumber} (${v.vehicleType})` }))
      case 'EQUIPMENT':
        return (equipment?.data ?? []).map((eq) => ({ id: eq.id, label: `${eq.name} (${eq.equipmentType})` }))
    }
  }, [addType, employees, crews, vehicles, equipment])

  // --- derived window -------------------------------------------------------
  const times = useMemo(() => {
    if (shift === 'CUSTOM') return { start: customStart, end: customEnd }
    const preset = SHIFTS.find((s) => s.value === shift)!
    return { start: preset.start!, end: preset.end! }
  }, [shift, customStart, customEnd])

  const night = isNightShift(times.start, times.end)
  const shiftLen = shiftLengthHours(times.start, times.end)

  const shiftCount = useMemo(() => {
    if (!startDate || !endDate) return 0
    const diff = daysBetween(startDate, endDate)
    if (diff < 0) return 0
    return Math.max(1, night ? diff : diff + 1)
  }, [startDate, endDate, night])

  const autoHours = useMemo(() => Math.round(shiftCount * shiftLen * 100) / 100, [shiftCount, shiftLen])

  // Keep planned hours in sync with the window until the user overrides it.
  useEffect(() => {
    if (!hoursTouched) {
      setPlannedHours(autoHours > 0 ? String(autoHours) : '')
    }
  }, [autoHours, hoursTouched])

  const startIso = composeIso(startDate, times.start)
  const endIso = composeIso(endDate, times.end)
  const datesValid = !!startIso && !!endIso && new Date(endIso) > new Date(startIso)

  function setStart(date: string) {
    setDatesTouched(true)
    setStartDate(date)
    if (endDate && new Date(`${endDate}T00:00`) < new Date(`${date}T00:00`)) setEndDate(date)
  }
  function setEnd(date: string) {
    setDatesTouched(true)
    setEndDate(date)
  }
  function applyDuration(days: number) {
    const base = startDate || todayStr()
    setDatesTouched(true)
    setStartDate(base)
    setEndDate(addDaysStr(base, days - 1))
  }

  function addResource() {
    if (!addId) return
    const key = `${addType}:${addId}`
    if (staged.some((s) => s.key === key)) {
      setFormError('That resource is already in the list')
      return
    }
    const label = resourceOptions.find((o) => o.id === addId)?.label ?? addId
    setStaged((prev) => [...prev, { key, resourceType: addType, resourceId: addId, label }])
    setAddId('')
    setFormError(null)
    setBlocked(null)
  }

  function removeResource(key: string) {
    setStaged((prev) => prev.filter((s) => s.key !== key))
    setBlocked(null)
  }

  const mutation = useMutation({
    mutationFn: () =>
      createAssignmentsBulk({
        jobId,
        startDatetime: startIso,
        endDatetime: endIso,
        plannedHours: plannedHours === '' ? undefined : Number(plannedHours),
        overrideReason: overrideReason || undefined,
        items: staged.map((s) => ({ resourceType: s.resourceType, [fieldFor(s.resourceType)]: s.resourceId })),
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['assignments'] })
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
      void queryClient.invalidateQueries({ queryKey: ['utilization'] })
      toast.success(`${created.length} resource${created.length === 1 ? '' : 's'} assigned`)
      onOpenChange(false)
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 409 && error.response.data?.conflicts) {
        setBlocked(error.response.data.conflicts as BulkConflict[])
        return
      }
      toast.error(getApiErrorMessage(error, 'Failed to assign resources'))
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!jobId) return setFormError('Select a job')
    if (!datesValid) return setFormError('Enter a valid window (the end must be after the start)')
    if (plannedHours !== '' && !/^\d+(\.\d{1,2})?$/.test(plannedHours)) {
      return setFormError('Planned hours must be a valid number')
    }
    if (staged.length === 0) return setFormError('Add at least one resource')
    mutation.mutate()
  }

  const hasConflicts = !!blocked && blocked.length > 0
  const overrideBlockedByPermission = hasConflicts && !canOverride
  const overrideRequiredButMissing = hasConflicts && !overrideReason

  const labelFor = (resourceType: ResourceType, resourceId: string) =>
    staged.find((s) => s.resourceType === resourceType && s.resourceId === resourceId)?.label ??
    `${RESOURCE_TYPE_LABEL[resourceType]} ${resourceId.slice(0, 8)}`

  const unit = night ? 'night' : 'day'
  const windowSummary = datesValid
    ? `${shiftCount} ${unit}${shiftCount > 1 ? 's' : ''} · ${autoHours} h per resource`
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign resources</DialogTitle>
          <DialogDescription>
            Add one or more resources to a job for a shared time window.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {!lockedJobId ? (
            <div className="space-y-1.5">
              <Label>Job</Label>
              <Select value={jobId} onValueChange={(v) => { setJobId(v); setDatesTouched(false) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs?.data.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobCode} — {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* When ---------------------------------------------------------- */}
          <div className="space-y-3 rounded-md border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">When</Label>
              <div className="flex gap-1">
                {[
                  { label: '1 day', days: 1 },
                  { label: '3 days', days: 3 },
                  { label: '1 week', days: 7 },
                ].map((d) => (
                  <Button
                    key={d.days}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => applyDuration(d.days)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-xs text-slate-500">Start date</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs text-slate-500">
                  {night ? 'End date (next morning)' : 'End date'}
                </Label>
                <Input id="endDate" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Shift</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as ShiftKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {shift === 'CUSTOM' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="customStart" className="text-xs text-slate-500">Start time</Label>
                  <Input id="customStart" type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customEnd" className="text-xs text-slate-500">End time</Label>
                  <Input id="customEnd" type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              </div>
            ) : null}

            {windowSummary ? (
              <p className="text-xs text-slate-500">
                {windowSummary}
                {night ? ' · crosses midnight' : ''}
              </p>
            ) : null}
          </div>

          {/* Planned hours ------------------------------------------------- */}
          <div className="space-y-1.5">
            <Label htmlFor="plannedHours">Planned hours per resource</Label>
            <div className="flex items-center gap-2">
              <Input
                id="plannedHours"
                inputMode="decimal"
                className="w-40"
                value={plannedHours}
                onChange={(e) => {
                  setHoursTouched(true)
                  setPlannedHours(e.target.value)
                }}
              />
              {hoursTouched && autoHours > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-slate-500"
                  onClick={() => {
                    setHoursTouched(false)
                    setPlannedHours(String(autoHours))
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset to auto
                </Button>
              ) : !hoursTouched && autoHours > 0 ? (
                <span className="text-xs text-slate-400">auto from {shiftCount} {unit}{shiftCount > 1 ? 's' : ''} × {shiftLen}h</span>
              ) : null}
            </div>
          </div>

          {/* Add-resource row */}
          <div className="space-y-1.5">
            <Label>Resources</Label>
            <div className="flex items-end gap-2">
              <div className="w-36 shrink-0">
                <Select
                  value={addType}
                  onValueChange={(v) => {
                    setAddType(v as ResourceType)
                    setAddId('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={addId} onValueChange={setAddId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={addResource} disabled={!addId} aria-label="Add resource">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Staged list */}
          {staged.length > 0 ? (
            <ul className="space-y-1.5 rounded-md border border-slate-200 p-2">
              {staged.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {RESOURCE_TYPE_LABEL[s.resourceType]}
                    </span>{' '}
                    {s.label}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeResource(s.key)}
                    aria-label="Remove resource"
                  >
                    <X className="h-4 w-4 text-slate-500" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">No resources added yet.</p>
          )}

          {/* Conflict panel (after a blocked submit) */}
          {hasConflicts ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                {blocked!.length} resource{blocked!.length > 1 ? 's are' : ' is'} unavailable for this window
              </div>
              <ul className="space-y-1 text-xs text-amber-800">
                {blocked!.map((b) => (
                  <li key={`${b.resourceType}:${b.resourceId}`}>
                    <span className="font-medium">{labelFor(b.resourceType, b.resourceId)}</span>
                    {b.availabilityIssue ? ` — ${b.availabilityIssue}` : ''}
                    {b.conflicts.length > 0
                      ? ` — overlaps ${b.conflicts
                          .map((c) => `${c.jobCode} (${formatDateTime(c.startDatetime)})`)
                          .join(', ')}`
                      : ''}
                  </li>
                ))}
              </ul>
              {overrideBlockedByPermission ? (
                <p className="text-xs font-medium text-red-700">
                  You do not have permission to override conflicts.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="overrideReason" className="text-amber-900">
                    Override reason (required to proceed)
                  </Label>
                  <Textarea
                    id="overrideReason"
                    rows={2}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          ) : null}

          {formError ? <p className="text-xs text-red-600">{formError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                staged.length === 0 ||
                overrideBlockedByPermission ||
                overrideRequiredButMissing
              }
            >
              {mutation.isPending ? <Spinner /> : null}
              {hasConflicts ? 'Override & assign' : `Assign ${staged.length || ''}`.trim()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
