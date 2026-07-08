import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { fetchContract, fetchContracts } from '@/api/contracts.api'
import { createEstimate } from '@/api/estimates.api'
import type { EstimateLinePayload } from '@/api/estimates.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency } from '@/lib/formatters'
import type { BillingUnit, LineKind, RateCard } from '@/types'

const NONE = 'NONE'
const LINE_KINDS: LineKind[] = ['LABOR', 'EQUIPMENT', 'MATERIAL', 'STANDBY', 'OTHER']
const UNITS: BillingUnit[] = ['HOUR', 'DAY', 'TRIP', 'METER', 'UNIT', 'LUMP_SUM']

// Map a contract rate-card unit (MH/EH/EA/VAL…) to the estimate's BillingUnit.
const UNIT_MAP: Record<string, BillingUnit> = {
  MH: 'HOUR',
  EH: 'HOUR',
  HOUR: 'HOUR',
  DAY: 'DAY',
  TRIP: 'TRIP',
  METER: 'METER',
  EA: 'UNIT',
  UNIT: 'UNIT',
  VAL: 'LUMP_SUM',
  LUMP_SUM: 'LUMP_SUM',
}

function lineKindFor(card: RateCard): LineKind {
  if (/standby/i.test(card.description)) return 'STANDBY'
  if (/labor/i.test(card.serviceLine)) return 'LABOR'
  if (/equipment|floodlight|flange/i.test(card.serviceLine)) return 'EQUIPMENT'
  return 'OTHER'
}

/** Natural order by item code so 2.2 < 2.10; blank codes sort last. */
function byItemCode(a: RateCard, b: RateCard): number {
  if (!a.itemCode) return b.itemCode ? 1 : 0
  if (!b.itemCode) return -1
  const pa = a.itemCode.split('.').map(Number)
  const pb = b.itemCode.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

interface LineRow {
  contractRateCardId?: string
  lineKind: LineKind
  description: string
  quantity: string
  hours: string
  unit: BillingUnit
  unitPrice: string
  vatRate: string
  estimatedUnitCost: string
}

function emptyLine(): LineRow {
  return { lineKind: 'LABOR', description: '', quantity: '1', hours: '1', unit: 'HOUR', unitPrice: '', vatRate: '15', estimatedUnitCost: '' }
}

/** Build a pre-filled line from a contract rate-card item (price editable after). */
function lineFromRateCard(card: RateCard): LineRow {
  return {
    contractRateCardId: card.id,
    lineKind: lineKindFor(card),
    description: card.itemCode ? `${card.itemCode} ${card.description}` : card.description,
    quantity: '1',
    hours: '1',
    unit: UNIT_MAP[card.unit] ?? 'UNIT',
    unitPrice: String(Number(card.unitPrice)),
    vatRate: card.vatApplicable ? '15' : '0',
    estimatedUnitCost: '',
  }
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
  const [lines, setLines] = useState<LineRow[]>([])

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
      setLines([])
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

  // Rate card of the selected contract — the source of "fixed" line pricing.
  const { data: selectedContract } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => fetchContract(contractId),
    enabled: open && contractId !== NONE,
  })
  const rateCards = [...(selectedContract?.rateCards ?? [])].sort(byItemCode)

  const totals = useMemo(() => {
    let subtotal = 0
    let vat = 0
    let estCost = 0
    let hasCost = false
    for (const l of lines) {
      const sub = num(l.quantity) * num(l.hours) * num(l.unitPrice)
      subtotal += sub
      vat += (sub * num(l.vatRate)) / 100
      if (l.estimatedUnitCost.trim()) {
        hasCost = true
        estCost += num(l.quantity) * num(l.hours) * num(l.estimatedUnitCost)
      }
    }
    const estMarginPct = hasCost && subtotal > 0 ? ((subtotal - estCost) / subtotal) * 100 : null
    return { subtotal, vat, total: subtotal + vat, estCost, hasCost, estMarginPct }
  }, [lines])

  function updateLine(index: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const mutation = useMutation({
    mutationFn: () => {
      // Only submit complete lines — drop blank/half-filled rows.
      const items: EstimateLinePayload[] = lines
        .filter((l) => l.description.trim() && num(l.quantity) > 0)
        .map((l) => ({
        contractRateCardId: l.contractRateCardId,
        lineKind: l.lineKind,
        description: l.description.trim(),
        quantity: num(l.quantity),
        hours: num(l.hours),
        unit: l.unit,
        unitPrice: num(l.unitPrice),
        vatRate: num(l.vatRate),
        estimatedUnitCost: l.estimatedUnitCost.trim() ? num(l.estimatedUnitCost) : undefined,
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
            <div className="flex items-center justify-between gap-2">
              <Label>Line items</Label>
              <div className="flex items-center gap-2">
                {contractId !== NONE && rateCards.length > 0 ? (
                  <Select
                    value=""
                    onValueChange={(id) => {
                      const card = rateCards.find((r) => r.id === id)
                      if (card) setLines((p) => [...p, lineFromRateCard(card)])
                    }}
                  >
                    <SelectTrigger className="h-9 w-80">
                      <SelectValue placeholder="Add from contract rate card…" />
                    </SelectTrigger>
                    <SelectContent>
                      {rateCards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {(c.itemCode ? `${c.itemCode} · ` : '') + c.description} — {formatCurrency(c.unitPrice)}/{c.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>
                  <Plus className="h-4 w-4" /> Add line
                </Button>
              </div>
            </div>
            {lines.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-500">
                No line items yet.{' '}
                {contractId !== NONE && rateCards.length > 0
                  ? 'Pick fixed-price items from the contract rate card above, or use “Add line” for a custom price.'
                  : 'Add a custom line — or choose a contract to pull its fixed rate card.'}
              </div>
            ) : (
              <div className="space-y-2">
                {lines.map((line, index) => {
                  const sub = num(line.quantity) * num(line.hours) * num(line.unitPrice)
                  const locked = !!line.contractRateCardId // contract rate → price & VAT fixed
                  return (
                    <div key={index} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start gap-2">
                        <Select value={line.lineKind} onValueChange={(v) => updateLine(index, { lineKind: v as LineKind })}>
                          <SelectTrigger className="h-9 w-32 shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LINE_KINDS.map((k) => (
                              <SelectItem key={k} value={k}>{k.toLowerCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="flex-1"
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                          placeholder="Description (e.g. Operator)"
                        />
                        {line.contractRateCardId ? (
                          <span className="mt-2 shrink-0 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            contract rate
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove line"
                          className="shrink-0"
                          onClick={() => setLines((p) => p.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pl-1">
                        <Field label="Qty">
                          <Input className="h-9 w-20 text-right" inputMode="decimal" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
                        </Field>
                        <span className="pb-2 text-slate-400">×</span>
                        <Field label="Hours">
                          <Input className="h-9 w-20 text-right" inputMode="decimal" value={line.hours} onChange={(e) => updateLine(index, { hours: e.target.value })} />
                        </Field>
                        <Field label="Unit">
                          <Select value={line.unit} onValueChange={(v) => updateLine(index, { unit: v as BillingUnit })}>
                            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => (
                                <SelectItem key={u} value={u}>{u.toLowerCase().replace('_', ' ')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Unit price (SAR)">
                          <Input
                            className={`h-9 w-28 text-right${locked ? ' bg-slate-100 text-slate-500' : ''}`}
                            inputMode="decimal"
                            placeholder="0.00"
                            readOnly={locked}
                            tabIndex={locked ? -1 : undefined}
                            title={locked ? 'Fixed contract rate — add a custom line to price it differently' : 'Custom price'}
                            value={line.unitPrice}
                            onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                          />
                        </Field>
                        <Field label="VAT %">
                          <Input
                            className="h-9 w-16 text-right bg-slate-100 text-slate-500"
                            inputMode="decimal"
                            readOnly
                            tabIndex={-1}
                            title="VAT is fixed at the standard rate"
                            value={line.vatRate}
                          />
                        </Field>
                        <Field label="Est. cost/unit">
                          <Input
                            className="h-9 w-24 text-right"
                            inputMode="decimal"
                            placeholder="—"
                            title="Optional internal cost per unit — projects margin, never shown to the client"
                            value={line.estimatedUnitCost}
                            onChange={(e) => updateLine(index, { estimatedUnitCost: e.target.value })}
                          />
                        </Field>
                        <div className="ml-auto pb-0.5 text-right">
                          <div className="text-xs text-slate-500">Line total</div>
                          <div className="font-semibold text-slate-900">{formatCurrency(sub)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="est-notes">Notes (optional)</Label>
            <Textarea id="est-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex flex-wrap justify-end gap-x-8 gap-y-1 rounded-md bg-slate-50 px-4 py-3 text-sm">
            {totals.hasCost ? (
              <>
                <div className="text-slate-500">Est. cost <span className="ml-2 font-medium text-slate-900">{formatCurrency(totals.estCost)}</span></div>
                <div className="text-slate-500">Est. margin <span className="ml-2 font-medium text-slate-900">{totals.estMarginPct === null ? '—' : `${totals.estMarginPct.toFixed(1)}%`}</span></div>
              </>
            ) : null}
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

/** Small labelled wrapper for a compact numeric/select input in a line row. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-xs text-slate-500">{label}</span>
      {children}
    </div>
  )
}
