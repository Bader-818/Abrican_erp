import { apiClient } from './client'
import type { JobCostBreakdown } from '@/types'

/** Live cost/profit breakdown for a job (does not persist). */
export async function fetchJobCosting(jobId: string): Promise<JobCostBreakdown> {
  const { data } = await apiClient.get<JobCostBreakdown>(`/jobs/${jobId}/costing`)
  return data
}

/** Persist the cost review and advance COMPLETED → COSTING_REVIEW. */
export async function reviewJobCosting(jobId: string): Promise<JobCostBreakdown> {
  const { data } = await apiClient.post<JobCostBreakdown>(`/jobs/${jobId}/costing/review`)
  return data
}

/** COSTING_REVIEW → READY_FOR_INVOICE. */
export async function markJobReadyForInvoice(jobId: string): Promise<JobCostBreakdown> {
  const { data } = await apiClient.post<JobCostBreakdown>(`/jobs/${jobId}/costing/ready-for-invoice`)
  return data
}
