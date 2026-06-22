import { JobStatus } from '@prisma/client';

/**
 * Job lifecycle state machine (Phase 1 implementation plan §4.3).
 *
 * Statuses from COSTING_REVIEW onward are reachable for state-machine
 * completeness, but are driven manually until Phase 2 (costing/invoicing)
 * automates them.
 */
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
};

export function isTransitionAllowed(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
