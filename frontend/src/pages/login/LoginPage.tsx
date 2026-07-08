import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FullPageSpinner, Spinner } from '@/components/Spinner'
import { Logo } from '@/components/Logo'
import { getApiErrorMessage } from '@/lib/api-error'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  totp: z.string().optional(),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { user, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mfaStep, setMfaStep] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', totp: '' },
  })

  if (isLoading) return <FullPageSpinner />
  if (user) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'
    return <Navigate to={from} replace />
  }

  async function onSubmit(values: LoginFormValues) {
    try {
      const result = await login(values.email, values.password, values.totp || undefined)
      if (result.mfaRequired) {
        setMfaStep(true)
        return
      }
      navigate('/dashboard', { replace: true })
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, mfaStep ? 'Invalid authentication code' : 'Invalid email or password'),
      )
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
      {/* Soft brand wash behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand-100/60 to-transparent"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="mb-6 text-center">
          <Logo className="mx-auto h-16" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
            {mfaStep ? 'Two-factor verification' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mfaStep ? 'Enter your authenticator code' : 'Sign in to your account'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Email + password stay mounted (the MFA step resubmits them) but
              are hidden once we move to the code step. */}
          <div className={mfaStep ? 'hidden' : 'space-y-4'}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@abrican.com"
                {...register('email')}
              />
              {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
              {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
            </div>
          </div>

          {mfaStep ? (
            <div className="space-y-1.5">
              <Label htmlFor="totp">Authentication code</Label>
              <Input
                id="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                autoFocus
                {...register('totp')}
              />
              <p className="text-xs text-slate-400">Open your authenticator app and enter the 6-digit code.</p>
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            {mfaStep ? 'Verify' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
