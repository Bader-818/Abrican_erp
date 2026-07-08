import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 py-12 text-center">
      <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
        <Inbox className="h-5 w-5 text-slate-400" />
      </span>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
