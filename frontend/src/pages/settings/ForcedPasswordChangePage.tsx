import { Logo } from '@/components/Logo'
import { ChangePasswordForm } from './ChangePasswordForm'

/**
 * Full-screen gate shown when an admin has flagged the account to change its
 * password before continuing. On success, `refreshUser()` clears the flag and
 * the normal app renders.
 */
export function ForcedPasswordChangePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <Logo className="mx-auto h-14" />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Set a new password</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your password was reset by an administrator. Choose a new one to continue.
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  )
}
