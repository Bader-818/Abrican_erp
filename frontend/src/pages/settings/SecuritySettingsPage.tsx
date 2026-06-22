import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Laptop, ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/hooks/useAuth'
import {
  listSessions,
  mfaDisable,
  mfaEnable,
  mfaSetup,
  revokeSession,
  type MfaSetupResponse,
} from '@/api/auth.api'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDateTime, formatRelativeTime } from '@/lib/formatters'
import { ChangePasswordForm } from './ChangePasswordForm'

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  )
}

function MfaSection() {
  const { user, refreshUser } = useAuth()
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null)
  const [code, setCode] = useState('')

  const setupMutation = useMutation({
    mutationFn: mfaSetup,
    onSuccess: (data) => setSetup(data),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to start MFA setup')),
  })
  const enableMutation = useMutation({
    mutationFn: () => mfaEnable(code),
    onSuccess: async () => {
      toast.success('Two-factor authentication enabled')
      setSetup(null)
      setCode('')
      await refreshUser()
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Invalid code')),
  })
  const disableMutation = useMutation({
    mutationFn: () => mfaDisable(code),
    onSuccess: async () => {
      toast.success('Two-factor authentication disabled')
      setCode('')
      await refreshUser()
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Invalid code')),
  })

  if (user?.mfaEnabled) {
    return (
      <div className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> Two-factor authentication is enabled.
        </p>
        <p className="text-xs text-slate-500">Enter a current code to turn it off.</p>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="disable-code">Authenticator code</Label>
            <Input id="disable-code" className="w-40" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => disableMutation.mutate()} disabled={code.length !== 6 || disableMutation.isPending}>
            {disableMutation.isPending ? <Spinner /> : <ShieldOff className="h-4 w-4" />} Disable
          </Button>
        </div>
      </div>
    )
  }

  if (!setup) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Add a second factor with an authenticator app (Google Authenticator, Authy, 1Password…).
        </p>
        <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
          {setupMutation.isPending ? <Spinner /> : <ShieldCheck className="h-4 w-4" />} Set up authenticator
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Scan this QR with your authenticator app, then enter the 6-digit code.</p>
      <img src={setup.qrDataUrl} alt="MFA QR" className="h-44 w-44 rounded border border-slate-200" />
      <p className="text-xs text-slate-400">
        Can’t scan? Enter this key manually: <span className="font-mono">{setup.secret}</span>
      </p>
      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="enable-code">Authenticator code</Label>
          <Input id="enable-code" className="w-40" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <Button onClick={() => enableMutation.mutate()} disabled={code.length !== 6 || enableMutation.isPending}>
          {enableMutation.isPending ? <Spinner /> : null} Enable
        </Button>
        <Button variant="ghost" onClick={() => { setSetup(null); setCode('') }}>Cancel</Button>
      </div>
    </div>
  )
}

function SessionsSection() {
  const queryClient = useQueryClient()
  const { data: sessions, isLoading } = useQuery({ queryKey: ['sessions'], queryFn: listSessions })

  const revokeMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Session revoked')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to revoke session')),
  })

  if (isLoading) return <Spinner />
  if (!sessions || sessions.length === 0) return <p className="text-sm text-slate-500">No active sessions.</p>

  return (
    <ul className="divide-y divide-slate-100">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Laptop className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-700">
                {s.userAgent ?? 'Unknown device'} {s.current ? <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">This device</span> : null}
              </p>
              <p className="text-xs text-slate-400">
                {s.ipAddress ?? 'no IP'} · last used {formatRelativeTime(s.lastUsedAt ?? s.createdAt)} · expires {formatDateTime(s.expiresAt)}
              </p>
            </div>
          </div>
          {!s.current ? (
            <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate(s.id)} disabled={revokeMutation.isPending}>
              Revoke
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Manage your password, two-factor authentication, and active sessions." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Change password" description="You’ll be signed out of your other sessions.">
          <ChangePasswordForm />
        </Panel>
        <Panel title="Two-factor authentication" description="Require a one-time code at sign-in.">
          <MfaSection />
        </Panel>
      </div>
      <Panel title="Active sessions" description="Devices currently signed in to your account.">
        <SessionsSection />
      </Panel>
    </div>
  )
}
