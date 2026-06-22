import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Spinner } from '@/components/Spinner'
import { RejectDialog } from '@/components/RejectDialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import {
  approveDailyReport,
  fetchDailyReport,
  rejectDailyReport,
  submitDailyReport,
} from '@/api/daily-reports.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/formatters'

export function DailyReportDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('daily_reports.manage')
  const canApprove = hasPermission('daily_reports.approve')
  const [rejecting, setRejecting] = useState(false)

  const { data: report, isLoading } = useQuery({
    queryKey: ['daily-report', id],
    queryFn: () => fetchDailyReport(id),
    enabled: !!id,
  })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['daily-report', id] })
    void queryClient.invalidateQueries({ queryKey: ['daily-reports'] })
  }
  const onErr = (verb: string) => (e: unknown) => toast.error(getApiErrorMessage(e, `Failed to ${verb}`))
  const submitM = useMutation({ mutationFn: () => submitDailyReport(id), onSuccess: () => { refresh(); toast.success('Submitted') }, onError: onErr('submit') })
  const approveM = useMutation({ mutationFn: () => approveDailyReport(id), onSuccess: () => { refresh(); toast.success('Approved') }, onError: onErr('approve') })
  const rejectM = useMutation({ mutationFn: (reason: string) => rejectDailyReport(id, reason), onSuccess: () => { refresh(); toast.success('Rejected'); setRejecting(false) }, onError: onErr('reject') })

  if (isLoading || !report) return <div className="flex justify-center py-20"><Spinner /></div>

  const s = report.approvalStatus
  const editable = s === 'DRAFT' || s === 'REJECTED'

  return (
    <div className="space-y-6">
      <Link to="/daily-reports" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to daily reports
      </Link>

      <PageHeader
        title={`Daily report · ${formatDate(report.reportDate)}`}
        description={`${report.job.jobCode} — ${report.job.title}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canManage && editable ? (
              <Button onClick={() => submitM.mutate()} disabled={submitM.isPending}>
                <Send className="h-4 w-4" /> Submit
              </Button>
            ) : null}
            {canApprove && s === 'SUBMITTED' ? (
              <>
                <Button onClick={() => approveM.mutate()} disabled={approveM.isPending}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button variant="outline" onClick={() => setRejecting(true)}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Detail label="Status"><StatusBadge status={s} /></Detail>
        <Detail label="Supervisor">{report.supervisor?.name ?? '—'}</Detail>
        <Detail label="Progress">{report.progressPct != null ? `${Number(report.progressPct)}%` : '—'}</Detail>
        <Detail label="Client rep">{report.clientRep ?? '—'}</Detail>
      </div>

      {report.approvalStatus === 'REJECTED' && report.rejectionReason ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="font-medium">Rejected:</span> {report.rejectionReason}
        </div>
      ) : null}

      <Section title="Work performed">{report.workPerformed}</Section>
      {report.issues ? <Section title="Issues / delays">{report.issues}</Section> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="Materials used">{report.materialsUsed ?? '—'}</Section>
        <Section title="Equipment used">{report.equipmentUsed ?? '—'}</Section>
        <Section title="Vehicles used">{report.vehiclesUsed ?? '—'}</Section>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Detail label="Weather / conditions">{report.weather ?? '—'}</Detail>
        <Detail label="Approved by">{report.approvedBy ? `${report.approvedBy.name} · ${formatDate(report.approvedAt)}` : '—'}</Detail>
      </div>

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Reject daily report"
        isLoading={rejectM.isPending}
        onConfirm={(reason) => rejectM.mutate(reason)}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{title}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-800">{children}</p>
    </div>
  )
}
