import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Trash2, Plus } from 'lucide-react'
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
import { fetchClients } from '@/api/clients.api'
import { fetchContracts } from '@/api/contracts.api'
import { createEstimate } from '@/api/estimates.api'
import type { EstimateLinePayload } from '@/api/estimates.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency } from '@/lib/formatters'
import type { BillingUnit, LineKind } from '@/types'

const NONE = 'NONE'
const LINE_KINDS: LineKind[] = ['LABOR', 'EQUIPMENT', 'MATERIAL', 'STANDBY', 'OTHER']
const UNITS: BillingUnit[] = ['HOUR', 'DAY', 'TRIP', 'METER', 'UNIT', 'LUMP_SUM']

interface LineRow {
  lineKind: LineKind
  description: string
  quantity: string
  hours: string
  unit: BillingUnit
  unitPrice: string
  vatRate: string
}

function emptyLine(): LineRow {
  return { lineKind: 'LABOR', description: '', quantity: '1', hours: '1', unit: 'HOUR', unitPrice: '', vatRate: '15' }
}

const num = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export interface EstimateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EstimateFormDialog({ open, onOpenChange }: EstimateFormDialogProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [clientId, setClientId] = useState('')
  const [contractId, setContractId] = useState(NONE)
  const [title, setTitle] = useState('')
  const [jobType, setJobType] = useState('')
  const [location, setLocation] = useState('')
  const [plannedStartDate, setStart] = useState('')
  const [plannedEndDate, setEnd] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([emptyLine()])

  useEffect(() => {
    if (open) {
      setClientId('')
      setContractId(NONE)
      setTitle('')
      setJobType('')
      setLocation('')
      setStart('')
      setEnd('')
      setValidUntil('')
      setNotes('')
      setLines([emptyLine()])
    }
  }, [open])

  const { data: clients } = useQuery({
    queryKey: ['clients', { pageSize: 100 }],
    queryFn: () => fetchClients({ pageSize: 100 }),
    enabled: open,
  })

  const { data: clientContracts } = useQuery({
    queryKey: ['contracts', { clientId, pageSize: 100 }],
    queryFn: () => fetchContracts({ clientId, pageSize: 100 }),
    enabled: open && !!clientId,
  })

  const totals = useMemo(() => {
    let subtotal = 0
    let vat = 0
    for (const l of lines) {
      const sub = num(l.quantity) * num(l.hours) * num(l.unitPrice)
      subtotal += sub
      vat += (sub * num(l.vatRate)) / 100
    }
    return { subtotal, vat, total: subtotal + vat }
  }, [lines])

  function updateLine(index: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const mutation = useMutation({
    mutationFn: () => {
      const items: EstimateLinePayload[] = lines.map((l) => ({
        lineKind: l.lineKind,
        description: l.description.trim(),
        quantity: num(l.quantity),
        hours: num(l.hours),
        unit: l.unit,
        unitPrice: num(l.unitPrice),
        vatRate: num(l.vatRate),
      }))
      return createEstimate({
        clientId,
        contractId: contractId === NONE ? undefined : contractId,
        title: title.trim(),
        jobType: jobType.trim(),
        location: location.trim(),
        plannedStartDate,
        plannedEndDate,
        validUntil: validUntil || undefined,
        notes: notes.trim() || undefined,
        items,
      })
    },
    onSuccess: (estimate) => {
      void queryClient.invalidateQueries({ queryKey: ['estimates'] })
      toast.success(`Estimate ${estimate.estimateNumber} created`)
      onOpenChange(false)
      navigate(`/estimates/${estimate.id}`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to create estimate')),
  })

  function onSubmit() {
    if (!clientId) return toast.error('Select a client')
    if (!title.trim() || !jobType.trim() || !location.trim()) return toast.error('Title, job type, and location are required')
    if (!plannedStartDate || !plannedEndDate) return toast.error('Planned dates are required')
    if (new Date(plannedEndDate) <= new Date(plannedStartDate)) return toast.error('End date must be after the start date')
    const valid = lines.filter((l) => l.description.trim() && num(l.quantity) > 0 && num(l.unitPrice) >= 0)
    if (valid.length === 0) return toast.error('Add at least one line with a description, quantity, and price')
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>New estimate</DialogTitle>
          <DialogDescription>
            Build a priced quotation. Each line is quantity × hours × unit price, with VAT applied per line.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select
                value={clientId}
                onValueChange={(v) => {
                  setClientId(v)
                  setContractId(NONE)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.data.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contract (optional)</Label>
              <Select value={contractId} onValueChange={setContractId} disabled={!clientId}>
                <SelectTrigger>
                  <SelectValue placeholder="No contract" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No contract</SelectItem>
                  {clientContracts?.data.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contractNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="est-title">Title</Label>
            <Input id="est-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="est-jobtype">Job type</Label>
              <Input id="est-jobtype" placeholder="e.g. Nitrogen Purging" value={jobType} onChange={(e) => setJobType(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="est-location">Location</Label>
              <Input id="est-location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="est-start">Planned start</Label>
              <Input id="est-start" type="date" value={plannedStartDate} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="est-end">Planned end</Label>
              <Input id="est-end" type="date" value={plannedEndDate} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="est-valid">Valid until (optional)</Label>
              <Input id="est-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>
                <Plus className="h-4 w-4" /> Add line
              </Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[110px_1fr_70px_70px_90px_100px_60px_28px] gap-2 px-1 text-xs font-medium text-slate-500">
                <span>Kind</span>
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Hours</span>
                <span>Unit</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">VAT%</span>
                <span />
              </div>
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-[110px_1fr_70px_70px_90px_100px_60px_28px] items-center gap-2">
                  <Select value={line.lineKind} onValueChange={(v) => updateLine(index, { lineKind: v as LineKind })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LINE_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>{k.toLowerCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} placeholder="e.g. Operator" />
                  <Input className="text-right" inputMode="decimal" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
                  <Input className="text-right" inputMode="decimal" value={line.hours} onChange={(e) => updateLine(index, { hours: e.target.value })} />
                  <Select value={line.unit} onValueChange={(v) => updateLine(index, { unit: v as BillingUnit })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u.toLowerCase().replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input className="text-right" inputMode="decimal" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} />
                  <Input className="text-right" inputMode="decimal" value={line.vatRate} onChange={(e) => updateLine(index, { vatRate: e.target.value })} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove line"
                    disabled={lines.length === 1}
                    onClick={() => setLines((p) => p.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="est-notes">Notes (optional)</Label>
            <Textarea id="est-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-8 rounded-md bg-slate-50 px-4 py-3 text-sm">
            <div className="text-slate-500">Subtotal <span className="ml-2 font-medium text-slate-900">{formatCurrency(totals.subtotal)}</span></div>
            <div className="text-slate-500">VAT <span className="ml-2 font-medium text-slate-900">{formatCurrency(totals.vat)}</span></div>
            <div className="text-slate-500">Total <span className="ml-2 text-base font-semibold text-slate-900">{formatCurrency(totals.total)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : null}
            Create estimate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
