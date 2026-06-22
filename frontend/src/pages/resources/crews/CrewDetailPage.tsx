import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { deleteCrewMember, fetchCrew } from '@/api/crews.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/formatters'
import type { CrewMember } from '@/types'
import { CrewFormDialog } from './CrewFormDialog'
import { CrewMemberFormDialog } from './CrewMemberFormDialog'

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value ?? '—'}</dd>
    </div>
  )
}

export function CrewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('crews.manage')
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [memberFormOpen, setMemberFormOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<CrewMember | null>(null)
  const [deletingMember, setDeletingMember] = useState<CrewMember | null>(null)

  const { data: crew, isLoading } = useQuery({
    queryKey: ['crews', id],
    queryFn: () => fetchCrew(id!),
    enabled: !!id,
  })

  const deleteMemberMutation = useMutation({
    mutationFn: (memberId: string) => deleteCrewMember(id!, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crews'] })
      toast.success('Member removed')
      setDeletingMember(null)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to remove member'))
      setDeletingMember(null)
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (!crew) {
    return <p className="py-16 text-center text-sm text-slate-500">Crew not found.</p>
  }

  const memberColumns: ColumnDef<CrewMember, unknown>[] = [
    { header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.employee.name}</span> },
    { header: 'Role', cell: ({ row }) => row.original.employee.role },
    {
      header: 'Availability',
      cell: ({ row }) => <StatusBadge status={row.original.employee.availabilityStatus} />,
    },
    { header: 'From', cell: ({ row }) => formatDate(row.original.startDate) },
    { header: 'To', cell: ({ row }) => formatDate(row.original.endDate) },
    { header: 'Membership', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  if (canManage) {
    memberColumns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit member"
            onClick={() => {
              setEditingMember(row.original)
              setMemberFormOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove member"
            onClick={() => setDeletingMember(row.original)}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/resources/crews"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to crews
        </Link>
      </div>

      <PageHeader
        title={crew.name}
        description={crew.serviceCapability ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={crew.status} className="text-sm" />
            {canManage ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit crew
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
          <DetailField label="Supervisor" value={crew.supervisor?.name} />
          <DetailField label="Members" value={crew._count.members} />
          <DetailField label="Assignments" value={crew._count.assignments} />
        </dl>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Members</h2>
          {canManage ? (
            <Button
              onClick={() => {
                setEditingMember(null)
                setMemberFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Add member
            </Button>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <DataTable columns={memberColumns} data={crew.members} emptyMessage="No members yet" />
        </div>
      </div>

      {canManage ? (
        <>
          <CrewFormDialog open={editOpen} onOpenChange={setEditOpen} crew={crew} />
          <CrewMemberFormDialog
            open={memberFormOpen}
            onOpenChange={setMemberFormOpen}
            crewId={crew.id}
            member={editingMember}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={!!deletingMember}
        onOpenChange={(open) => !open && setDeletingMember(null)}
        title="Remove crew member"
        description={`Remove "${deletingMember?.employee.name}" from this crew?`}
        confirmLabel="Remove"
        destructive
        isLoading={deleteMemberMutation.isPending}
        onConfirm={() => deletingMember && deleteMemberMutation.mutate(deletingMember.id)}
      />
    </div>
  )
}
