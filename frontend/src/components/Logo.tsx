import logoUrl from '@/assets/abrican-logo.png'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
}

/** Abrican brand mark, used in the sidebar, mobile topbar, and login screen. */
export function Logo({ className }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="Abrican"
      className={cn('h-9 w-auto object-contain', className)}
    />
  )
}
