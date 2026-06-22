import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/PageHeader'
import { Spinner } from '@/components/Spinner'
import { StatusBadge } from '@/components/StatusBadge'
import { fetchAging } from '@/api/payments.api'
import { formatCurrency, formatDate } from '@/lib/formatters'

export function ReceivablesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['aging'], queryFn: fetchAging })

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  const cards = [
    { label: '0–30 days', value: data.buckets.current, tone: 'text-slate-900' },
    { label: '31–60 days', value: data.buckets.d31_60, tone: 'text-amber-600' },
    { label: '61–90 days', value: data.buckets.d61_90, tone: 'text-orange-600' },
    { label: '90+ days', value: data.buckets.d90_plus, tone: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receivables"
        description={`Outstanding ${formatCurrency(data.totalOutstanding)} across ${data.invoices.length} open invoice(s), as of ${formatDate(data.asOf)}.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase text-slate-500">{c.label}</p>
            <p className={`mt-1 text-xl font-semibold ${c.tone}`}>{formatCurrency(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {data.invoices.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No outstanding invoices. 🎉</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Due date</th>
                <th className="px-4 py-2 text-right">Days past due</th>
                <th className="px-4 py-2 text-right">Outstanding</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <Link to={`/invoices/${inv.id}`} className="font-medium text-blue-700 hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{inv.client.name}</td>
                  <td className="px-4 py-2">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-2 text-right">{inv.daysPastDue > 0 ? inv.daysPastDue : '—'}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(inv.outstandingAmount)}</td>
                  <td className="px-4 py-2"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
