import { NavLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Logo } from '@/components/Logo'
import { NAV_SECTIONS } from './nav-items'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { hasPermission } = useAuth()

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-6">
        <Logo className="h-10" />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => !item.permission || hasPermission(item.permission))
          if (items.length === 0) return null

          return (
            <div key={section.label}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.label}
              </p>
              <div className="mt-2 space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-100',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? (
                          <span
                            aria-hidden
                            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-600"
                          />
                        ) : null}
                        <item.icon
                          className={cn(
                            'h-4 w-4 transition-colors duration-100',
                            isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600',
                          )}
                        />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>
      <div className="shrink-0 border-t border-slate-200 px-6 py-3">
        <p className="text-[11px] text-slate-400">Abrican ERP · Phase 2</p>
      </div>
    </aside>
  )
}
