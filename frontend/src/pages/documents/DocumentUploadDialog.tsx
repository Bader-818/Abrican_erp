import { useEffect, useMemo, useState } from 'react'
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
import { fetchEmployees } from '@/api/employees.api'
import { fetchVehicles } from '@/api/vehicles.api'
import { fetchEquipment } from '@/api/equipment.api'
import { fetchContracts } from '@/api/contracts.api'
import { fetchClients } from '@/api/clients.api'
import { uploadDocument } from '@/api/documents.api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { RelatedEntityType } from '@/types'

const ENTITY_TYPES: { value: RelatedEntityType; label: string }[] = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'CLIENT', label: 'Client' },
  { value: 'COMPANY', label: 'Company-wide' },
]

const ENTITY_FIELD: Record<RelatedEntityType, string> = {
  EMPLOYEE: 'employeeId',
  VEHICLE: 'vehicleId',
  EQUIPMENT: 'equipmentId',
  CONTRACT: 'contractId',
  CLIENT: 'clientId',
  COMPANY: '',
}

export interface DocumentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocumentUploadDialog({ open, onOpenChange }: DocumentUploadDialogProps) {
  const queryClient = useQueryClient()

  const [relatedEntityType, setRelatedEntityType] = useState<RelatedEntityType>('EMPLOYEE')
  const [entityId, setEntityId] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setRelatedEntityType('EMPLOYEE')
      setEntityId('')
      setDocumentType('')
      setIssueDate('')
      setExpiryDate('')
      setNotes('')
      setFile(null)
      setError(null)
    }
  }, [open])

  const needsEntity = relatedEntityType !== 'COMPANY'

  const { data: employees } = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => fetchEmployees({ pageSize: 100 }),
    enabled: open && relatedEntityType === 'EMPLOYEE',
  })
  const { data: vehicles } = useQuery({
    queryKey: ['vehicles', 'options'],
    queryFn: () => fetchVehicles({ pageSize: 100 }),
    enabled: open && relatedEntityType === 'VEHICLE',
  })
  const { data: equipment } = useQuery({
    queryKey: ['equipment', 'options'],
    queryFn: () => fetchEquipment({ pageSize: 100 }),
    enabled: open && relatedEntityType === 'EQUIPMENT',
  })
  const { data: contracts } = useQuery({
    queryKey: ['contracts', 'options'],
    queryFn: () => fetchContracts({ pageSize: 100 }),
    enabled: open && relatedEntityType === 'CONTRACT',
  })
  const { data: clients } = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => fetchClients({ pageSize: 100 }),
    enabled: open && relatedEntityType === 'CLIENT',
  })

  const entityOptions = useMemo(() => {
    switch (relatedEntityType) {
      case 'EMPLOYEE':
        return (employees?.data ?? []).map((e) => ({ id: e.id, label: `${e.name} — ${e.role}` }))
      case 'VEHICLE':
        return (vehicles?.data ?? []).map((v) => ({ id: v.id, label: `${v.plateNumber} (${v.vehicleType})` }))
      case 'EQUIPMENT':
        return (equipment?.data ?? []).map((eq) => ({ id: eq.id, label: eq.name }))
      case 'CONTRACT':
        return (contracts?.data ?? []).map((c) => ({ id: c.id, label: `${c.contractNumber} — ${c.title}` }))
      case 'CLIENT':
        return (clients?.data ?? []).map((c) => ({ id: c.id, label: c.name }))
      case 'COMPANY':
        return []
    }
  }, [relatedEntityType, employees, vehicles, equipment, contracts, clients])

  const mutation = useMutation({
    mutationFn: () =>
      uploadDocument({
        relatedEntityType,
        [ENTITY_FIELD[relatedEntityType]]: needsEntity ? entityId : undefined,
        documentType,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        notes: notes || undefined,
        file: file!,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document uploaded')
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to upload document'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (needsEntity && !entityId) {
      setError('Select the related record')
      return
    }
    if (documentType.trim().length < 2) {
      setError('Document type is required')
      return
    }
    if (!file) {
      setError('Choose a file to upload')
      return
    }
    if (issueDate && expiryDate && new Date(expiryDate) < new Date(issueDate)) {
      setError('Expiry date cannot be before the issue date')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>Attach a file and link it to a record.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Linked to</Label>
              <Select
                value={relatedEntityType}
                onValueChange={(v) => {
                  setRelatedEntityType(v as RelatedEntityType)
                  setEntityId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsEntity ? (
              <div className="space-y-1.5">
                <Label>Record</Label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {entityOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="documentType">Document type</Label>
            <Input
              id="documentType"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              placeholder="e.g. Safety Passport, Insurance Policy"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="issueDate">Issue date</Label>
              <Input id="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiryDate">Expiry date</Label>
              <Input id="expiryDate" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
            />
            <p className="text-xs text-slate-500">PDF, Office, images or text. Max 10 MB.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
