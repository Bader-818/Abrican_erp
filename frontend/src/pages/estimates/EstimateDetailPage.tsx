import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import {
  approveEstimate,
  convertEstimate,
  fetchEstimate,
  fetchEstimatePdf,
  rejectEstimate,
  sendEstimate,
} from '@/api/estimates.api'
import { createInvoiceFromEstimate } from '@/api/invoices.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { openBlobInNewTab } from '@/lib/open-blob'

export function EstimateDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('estimates.manage')
  const canApprove = hasPermission('estimates.approve')
  const canInvoice = hasPermission('invoices.manage')

  const { data: estimate, isLoading } = useQuery({
    queryKey: ['estimate', id],
    queryFn: () => fetchEstimate(id),
    enabled: !!id,
  })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['estimate', id] })
    void queryClient.invalidateQueries({ queryKey: ['estimates'] })
  }

  const action = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      refresh()
      toast.success('Estimate updated')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Action failed')),
  })

  const invoiceMutation = useMutation({
    mutationFn: () => createInvoiceFromEstimate({ estimateId: id }),
    onSuccess: (invoice) => {
      toast.success(`Invoice ${invoice.invoiceNumber} created`)
      navigate(`/invoices/${invoice.id}`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to create invoice')),
  })

  const pdfMutation = useMutation({
    mutationFn: () => fetchEstimatePdf(id),
    onSuccess: (blob) => openBlobInNewTab(blob),
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to open PDF')),
  })

  if (isLoading || !estimate) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  const s = estimate.status

  return (
    <div className="space-y-6">
      <Link to="/estimates" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to estimates
      </Link>

      <PageHeader
        title={`${estimate.estimateNumber}`}
        description={estimate.title}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}>
              <Download className="h-4 w-4" /> Quotation PDF
            </Button>
            {canManage && s === 'DRAFT' ? (
              <Button onClick={() => action.mutate(() => sendEstimate(id))} disabled={action.isPending}>
                Send to client
              </Button>
            ) : null}
            {canApprove && s === 'SENT' ? (
              <>
                <Button onClick={() => action.mutate(() => approveEstimate(id))} disabled={action.isPending}>
                  Approve
                </Button>
                <Button variant="outline" onClick={() => action.mutate(() => rejectEstimate(id))} disabled={action.isPending}>
                  Reject
                </Button>
              </>
            ) : null}
            {canManage && s === 'APPROVED' ? (
              <Button onClick={() => action.mutate(() => convertEstimate(id))} disabled={action.isPending}>
                Convert to job
              </Button>
            ) : null}
            {canInvoice && (s === 'APPROVED' || s === 'CONVERTED') ? (
              <Button onClick={() => invoiceMutation.mutate()} disabled={invoiceMutation.isPending}>
                <FileText className="h-4 w-4" /> Create invoice
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Detail label="Status"><StatusBadge status={estimate.status} /></Detail>
        <Detail label="Client">{estimate.client.name}</Detail>
        <Detail label="Contract">{estimate.contract?.contractNumber ?? '—'}</Detail>
        <Detail label="Job type">{estimate.jobType}</Detail>
        <Detail label="Location">{estimate.location}</Detail>
        <Detail label="Valid until">{formatDate(estimate.validUntil)}</Detail>
        <Detail label="Planned start">{formatDate(estimate.plannedStartDate)}</Detail>
        <Detail label="Planned end">{formatDate(estimate.plannedEndDate)}</Detail>
        <Detail label="Linked job">
          {estimate.job ? (
            <Link to={`/jobs/${estimate.job.id}`} className="text-blue-700 hover:underline">
              {estimate.job.jobCode}
            </Link>
          ) : (
            '—'
          )}
        </Detail>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Hours</th>
              <th className="px-4 py-2 text-right">Unit price</th>
              <th className="px-4 py-2 text-right">Subtotal</th>
              <th className="px-4 py-2 text-right">VAT</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {estimate.lineItems.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{l.description}</td>
                <td className="px-4 py-2 capitalize text-slate-500">{l.lineKind.toLowerCase()}</td>
                <td className="px-4 py-2 text-right">{Number(l.quantity)}</td>
                <td className="px-4 py-2 text-right">{Number(l.hours)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(l.unitPrice)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(l.lineSubtotal)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(l.lineVat)}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={5} />
              <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(estimate.subtotal)}</td>
              <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(estimate.vatAmount)}</td>
              <td className="px-4 py-2 text-right text-base font-semibold">{formatCurrency(estimate.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {estimate.notes ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Notes</p>
          {estimate.notes}
        </div>
      ) : null}
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-900">{children}</div>
    </div>
  )
}
