import { Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ForcedPasswordChangePage } from '@/pages/settings/ForcedPasswordChangePage'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout() {
  const { user } = useAuth()

  // Block the whole app until a forced password change is completed.
  if (user?.mustChangePassword) {
    return <ForcedPasswordChangePage />
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
