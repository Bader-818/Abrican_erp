import type { JobStatus } from '@/types'

/** Mirror of the backend job lifecycle state machine (kept in sync manually). */
export const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ['PLANNED', 'CANCELLED'],
  PLANNED: ['APPROVED', 'CANCELLED', 'DRAFT'],
  APPROVED: ['SCHEDULED', 'ON_HOLD', 'CANCELLED'],
  SCHEDULED: ['ACTIVE', 'ON_HOLD', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['SCHEDULED', 'ACTIVE', 'CANCELLED'],
  COMPLETED: ['COSTING_REVIEW', 'ACTIVE'],
  COSTING_REVIEW: ['READY_FOR_INVOICE', 'COMPLETED'],
  READY_FOR_INVOICE: ['INVOICED', 'COSTING_REVIEW'],
  INVOICED: ['PARTIALLY_PAID', 'PAID'],
  PARTIALLY_PAID: ['PAID'],
  PAID: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  COSTING_REVIEW: 'Costing review',
  READY_FOR_INVOICE: 'Ready for invoice',
  INVOICED: 'Invoiced',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

/** Statuses whose day-to-day automation lands with Phase 2 (costing/invoicing). */
export const PHASE_2_STATUSES: JobStatus[] = [
  'COSTING_REVIEW',
  'READY_FOR_INVOICE',
  'INVOICED',
  'PARTIALLY_PAID',
  'PAID',
]

export const ALL_JOB_STATUSES = Object.keys(JOB_STATUS_LABELS) as JobStatus[]
