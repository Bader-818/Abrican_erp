import { ShieldAlert } from 'lucide-react'

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <ShieldAlert className="h-10 w-10 text-amber-500" />
      <h1 className="text-lg font-semibold text-slate-900">Access denied</h1>
      <p className="text-sm text-slate-500">You don't have permission to view this page.</p>
    </div>
  )
}
