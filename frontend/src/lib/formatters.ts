import { format, formatDistanceToNow } from 'date-fns'

export function formatDate(value: string | Date | null | undefined, pattern = 'dd MMM yyyy'): string {
  if (!value) return '—'
  return format(new Date(value), pattern)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return format(new Date(value), 'dd MMM yyyy, HH:mm')
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

export function formatCurrency(value: number | string | null | undefined, currency = 'SAR'): string {
  if (value === null || value === undefined) return '—'
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numeric)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)
}

export function formatPermissionLabel(key: string): string {
  return key
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .join(' › ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatRoleName(name: string): string {
  return name
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
