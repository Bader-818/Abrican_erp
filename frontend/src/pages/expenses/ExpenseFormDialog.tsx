import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { fetchVehicles } from '@/api/vehicles.api'
import { fetchEquipment } from '@/api/equipment.api'
import {
  createExpense,
  fetchExpense,
  updateExpense,
  uploadExpenseReceipt,
} from '@/api/expenses.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency } from '@/lib/formatters'
import type { ExpenseCategory, ExpenseSummary } from '@/types'

const CATEGORIES: ExpenseCategory[] = [
  'LABOR',
  'VEHICLE',
  'EQUIPMENT',
  'MATERIAL',
  'SUBCONTRACTOR',
  'ACCOMMODATION',
  'TRANSPORTATION',
  'ADMIN',
  'GOVERNMENT',
  'FINANCE',
  'OTHER_DIRECT',
  'OVERHEAD',
]
const NONE = '__none__'
const num = (v: string) => (v === '' ? 0 : Number(v))

export interface ExpenseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: ExpenseSummary | null
}

export function ExpenseFormDialog({ open, onOpenChange, expense }: ExpenseFormDialogProps) {
  const mode = expense ? 'edit' : 'create'
  const queryClient = useQueryClient()

  const [expenseDate, setExpenseDate] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('MATERIAL')
  const [vendor, setVendor] = useState('')
  const [description, setDescription] = useState('')
  const [amountBeforeVat, setAmount] = useState('')
  const [vatAmount, setVat] = useState('')
  const [vatTouched, setVatTouched] = useState(false)
  const [jobId, setJobId] = useState(NONE)
  const [vehicleId, setVehicleId] = useState(NONE)
  const [equipmentId, setEquipmentId] = useState(NONE)
  const [employeeId, setEmployeeId] = useState(NONE)
  const [reimbursable, setReimbursable] = useState(false)
  const [receipt, setReceipt] = useState<File | null>(null)

  const { data: jobs } = useQuery({ queryKey: ['jobs', 'options'], queryFn: () => fetchJobs({ pageSize: 100 }), enabled: open })
  const { data: employees } = useQuery({ queryKey: ['employees', 'options'], queryFn: () => fetchEmployees({ pageSize: 100 }), enabled: open })
  const { data: vehicles } = useQuery({ queryKey: ['vehicles', 'options'], queryFn: () => fetchVehicles({ pageSize: 100 }), enabled: open })
  const { data: equipment } = useQuery({ queryKey: ['equipment', 'options'], queryFn: () => fetchEquipment({ pageSize: 100 }), enabled: open })

  useEffect(() => {
    if (!open) return
    if (expense) {
      void fetchExpense(expense.id).then((e) => {
        setExpenseDate(e.expenseDate.slice(0, 10))
        setCategory(e.category)
        setVendor(e.vendor ?? '')
        setDescription(e.description ?? '')
        setAmount(String(Number(e.amountBeforeVat)))
        setVat(String(Number(e.vatAmount)))
        setVatTouched(true)
        setJobId(e.jobId ?? NONE)
        setVehicleId(e.vehicleId ?? NONE)
        setEquipmentId(e.equipmentId ?? NONE)
        setEmployeeId(e.employeeId ?? NONE)
        setReimbursable(e.reimbursable)
        setReceipt(null)
      })
    } else {
      setExpenseDate(new Date().toISOString().slice(0, 10))
      setCategory('MATERIAL')
      setVendor('')
      setDescription('')
      setAmount('')
      setVat('')
      setVatTouched(false)
      setJobId(NONE)
      setVehicleId(NONE)
      setEquipmentId(NONE)
      setEmployeeId(NONE)
      setReimbursable(false)
      setReceipt(null)
    }
  }, [open, expense])

  // Auto-fill VAT at 15% of the base until the user overrides it.
  const autoVat = Math.round(num(amountBeforeVat) * 0.15 * 100) / 100
  const effectiveVat = vatTouched ? num(vatAmount) : autoVat
  const total = Math.round((num(amountBeforeVat) + effectiveVat) * 100) / 100

  const opt = (v: string) => (v === NONE ? undefined : v)

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        expenseDate,
        category,
        amountBeforeVat: num(amountBeforeVat),
        vatAmount: effectiveVat,
        vendor: vendor.trim() || undefined,
        description: description.trim() || undefined,
        jobId: opt(jobId),
        vehicleId: opt(vehicleId),
        equipmentId: opt(equipmentId),
        employeeId: opt(employeeId),
        reimbursable,
      }
      const saved = mode === 'create' ? await createExpense(payload) : await updateExpense(expense!.id, payload)
      if (receipt) await uploadExpenseReceipt(saved.id, receipt)
      return saved
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success(mode === 'create' ? 'Expense created' : 'Expense updated')
      onOpenChange(false)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to save expense')),
  })

  function onSubmit() {
    if (!expenseDate) return toast.error('Pick a date')
    if (num(amountBeforeVat) <= 0) return toast.error('Enter an amount greater than zero')
    if (reimbursable && employeeId === NONE) return toast.error('Choose the employee to reimburse')
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New expense' : 'Edit expense'}</DialogTitle>
          <DialogDescription>Record a direct or overhead cost, optionally allocated to a job or asset.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="exp-date">Date</Label>
              <Input id="exp-date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="exp-base">Amount (excl. VAT)</Label>
              <Input id="exp-base" inputMode="decimal" value={amountBeforeVat} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-vat">VAT</Label>
              <Input
                id="exp-vat"
                inputMode="decimal"
                value={vatTouched ? vatAmount : String(autoVat)}
                onChange={(e) => { setVatTouched(true); setVat(e.target.value) }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Total</Label>
              <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900">
                {formatCurrency(total)}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-vendor">Vendor (optional)</Label>
            <Input id="exp-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">Description (optional)</Label>
            <Textarea id="exp-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Allocation (optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <Allocation label="Job" value={jobId} onChange={setJobId} options={(jobs?.data ?? []).map((j) => ({ id: j.id, label: `${j.jobCode} — ${j.title}` }))} />
              <Allocation label="Employee" value={employeeId} onChange={setEmployeeId} options={(employees?.data ?? []).map((e) => ({ id: e.id, label: e.name }))} />
              <Allocation label="Vehicle" value={vehicleId} onChange={setVehicleId} options={(vehicles?.data ?? []).map((v) => ({ id: v.id, label: `${v.plateNumber} (${v.vehicleType})` }))} />
              <Allocation label="Equipment" value={equipmentId} onChange={setEquipmentId} options={(equipment?.data ?? []).map((e) => ({ id: e.id, label: e.name }))} />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox id="exp-reimb" checked={reimbursable} onCheckedChange={(v) => setReimbursable(v === true)} className="mt-0.5" />
            <Label htmlFor="exp-reimb" className="font-normal leading-snug">
              Reimbursable — an employee paid out of pocket and should be compensated
              {reimbursable ? <span className="block text-xs text-slate-500">Select the employee above; they enter the reimbursement worklist once approved.</span> : null}
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-receipt">Receipt (optional)</Label>
            <Input id="exp-receipt" type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
            {mode === 'edit' && expense?.receiptName && !receipt ? (
              <p className="text-xs text-slate-500">Current: {expense.receiptName}. Choosing a new file replaces it.</p>
            ) : null}
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

function Allocation({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None</SelectItem>
          {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
