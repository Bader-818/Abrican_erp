import { Badge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusVariant = NonNullable<BadgeProps['variant']>

const STATUS_VARIANTS: Record<string, StatusVariant> = {
  // Generic
  ACTIVE: 'success',
  AVAILABLE: 'success',
  VALID: 'success',
  PAID: 'success',
  COMPLETED: 'success',
  APPROVED: 'success',
  CLOSED: 'default',
  INACTIVE: 'default',
  DRAFT: 'default',
  CANCELLED: 'default',

  // Warning
  PLANNED: 'warning',
  SCHEDULED: 'warning',
  ON_HOLD: 'warning',
  ASSIGNED: 'warning',
  IN_USE: 'warning',
  PARTIALLY_PAID: 'warning',
  EXPIRING_30: 'warning',
  EXPIRING_60: 'warning',
  EXPIRING_90: 'warning',
  COSTING_REVIEW: 'warning',
  READY_FOR_INVOICE: 'warning',
  INVOICED: 'warning',
  ON_LEAVE: 'warning',
  SICK: 'warning',
  CONSUMED: 'warning',
  // Finance
  SENT: 'warning',
  CONVERTED: 'success',
  PENDING_APPROVAL: 'warning',
  SUBMITTED: 'warning',
  POSTED: 'success',
  // Reimbursement
  COMPENSATED: 'success',
  PENDING: 'warning',
  DELAYED: 'warning',
  NOT_APPLICABLE: 'outline',

  // Danger
  EXPIRED: 'danger',
  TERMINATED: 'danger',
  MAINTENANCE: 'danger',
  OUT_OF_SERVICE: 'danger',
  REJECTED: 'danger',
  OVERDUE: 'danger',
  DECLINED: 'danger',

  // Info / brand
  NO_EXPIRY: 'outline',
  // Vehicle class
  LIGHT: 'outline',
  HEAVY: 'warning',
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: string
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const variant = STATUS_VARIANTS[status] ?? 'default'
  const label = status.replace(/_/g, ' ')

  return (
    <Badge variant={variant} className={cn('gap-1.5 capitalize', className)} {...props}>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
      {label.toLowerCase()}
    </Badge>
  )
}
