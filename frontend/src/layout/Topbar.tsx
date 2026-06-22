import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, LogOut, ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { fetchUnreadCount } from '@/api/notifications.api'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { initials } from '@/lib/formatters'

export function Topbar() {
  const { user, logout, logoutAll } = useAuth()
  const navigate = useNavigate()

  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
  })

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  async function handleLogoutAll() {
    try {
      await logoutAll()
      toast.success('Signed out of all sessions')
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="lg:hidden">
        <Logo className="h-9" />
      </div>
      <div className="ml-auto flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="relative">
          <Link to="/notifications" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {data && data.count > 0 ? (
              <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {data.count > 99 ? '99+' : data.count}
              </span>
            ) : null}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Avatar>
                <AvatarFallback>{user ? initials(user.name) : '?'}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-900">{user?.name}</span>
                <span className="text-xs text-slate-500">{user?.roleName}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings/security">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Security settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleLogoutAll}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Sign out of all sessions
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
