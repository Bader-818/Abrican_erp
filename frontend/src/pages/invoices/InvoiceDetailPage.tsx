import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import {
  approveInvoice,
  cancelInvoice,
  fetchInvoice,
  fetchInvoicePdf,
  issueInvoice,
  submitInvoiceForApproval,
} from '@/api/invoices.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { openBlobInNewTab } from '@/lib/open-blob'
import { RecordPaymentDialog } from './RecordPaymentDialog'

export function InvoiceDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('invoices.manage')
  const canApprove = hasPermission('invoices.approve')
  const canPay = hasPermission('payments.manage')
  const [payOpen, setPayOpen] = useState(false)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetchInvoice(id),
    enabled: !!id,
  })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['invoice', id] })
    void queryClient.invalidateQueries({ queryKey: ['invoices'] })
  }

  const action = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      refresh()
      toast.success('Invoice updated')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Action failed')),
  })

  const pdfMutation = useMutation({
    mutationFn: () => fetchInvoicePdf(id),
    onSuccess: (blob) => openBlobInNewTab(blob),
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to open PDF')),
  })

  if (isLoading || !invoice) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  const s = invoice.status
  const canRecordPayment = canPay && (s === 'SUBMITTED' || s === 'PARTIALLY_PAID') && Number(invoice.outstandingAmount) > 0

  return (
    <div className="space-y-6">
      <Link to="/invoices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>

      <PageHeader
        title={invoice.invoiceNumber}
        description={invoice.client.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}>
              <Download className="h-4 w-4" /> Invoice PDF
            </Button>
            {canManage && s === 'DRAFT' ? (
              <Button onClick={() => action.mutate(() => submitInvoiceForApproval(id))} disabled={action.isPending}>
                Submit for approval
              </Button>
            ) : null}
            {canApprove && s === 'PENDING_APPROVAL' ? (
              <Button onClick={() => action.mutate(() => approveInvoice(id))} disabled={action.isPending}>
                Approve
              </Button>
            ) : null}
            {canApprove && s === 'APPROVED' ? (
              <Button onClick={() => action.mutate(() => issueInvoice(id))} disabled={action.isPending}>
                Issue invoice
              </Button>
            ) : null}
            {canManage && (s === 'DRAFT' || s === 'PENDING_APPROVAL' || s === 'APPROVED') ? (
              <Button variant="outline" onClick={() => action.mutate(() => cancelInvoice(id))} disabled={action.isPending}>
                Cancel
              </Button>
            ) : null}
            {canRecordPayment ? (
              <Button onClick={() => setPayOpen(true)}>
                <Wallet className="h-4 w-4" /> Record payment
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Detail label="Status"><StatusBadge status={invoice.status} /></Detail>
        <Detail label="Total">{formatCurrency(invoice.totalAmount)}</Detail>
        <Detail label="Paid">{formatCurrency(invoice.paidAmount)}</Detail>
        <Detail label="Outstanding">{formatCurrency(invoice.outstandingAmount)}</Detail>
        <Detail label="Invoice date">{formatDate(invoice.invoiceDate)}</Detail>
        <Detail label="Due date">{formatDate(invoice.dueDate)}</Detail>
        <Detail label="Client VAT">{invoice.clientVatNumber ?? '—'}</Detail>
        <Detail label="PO">{invoice.purchaseOrder?.poNumber ?? '—'}</Detail>
        <Detail label="Estimate">{invoice.estimate?.estimateNumber ?? '—'}</Detail>
        <Detail label="Job">
          {invoice.job ? (
            <Link to={`/jobs/${invoice.job.id}`} className="text-blue-700 hover:underline">{invoice.job.jobCode}</Link>
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
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Hours</th>
              <th className="px-4 py-2 text-right">Unit price</th>
              <th className="px-4 py-2 text-right">Subtotal</th>
              <th className="px-4 py-2 text-right">VAT</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{l.description}</td>
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
              <td colSpan={4} />
              <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(invoice.subtotal)}</td>
              <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(invoice.vatAmount)}</td>
              <td className="px-4 py-2 text-right text-base font-semibold">{formatCurrency(invoice.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500">Payments</p>
        {invoice.payments.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-2 capitalize text-slate-500">{p.method.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="px-4 py-2">{p.referenceNumber ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RecordPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoiceId={id}
        outstanding={invoice.outstandingAmount}
      />
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
