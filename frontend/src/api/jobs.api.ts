import { apiClient } from './client'
import type { JobDetail, JobStatus, JobSummary, PaginatedResult } from '@/types'

export interface JobsQuery {
  page?: number
  pageSize?: number
  search?: string
  clientId?: string
  contractId?: string
  purchaseOrderId?: string
  status?: JobStatus
  serviceType?: string
  region?: string
}

export interface JobPayload {
  title?: string
  clientId?: string
  contractId?: string | null
  purchaseOrderId?: string | null
  serviceType?: string
  location?: string
  region?: string
  plannedStartDate?: string
  plannedEndDate?: string
  jobValue?: number
  costBudget?: number
  description?: string
}

export interface ChangeJobStatusPayload {
  toStatus: JobStatus
  reason?: string
  overrideReason?: string
}

export async function fetchJobs(query: JobsQuery): Promise<PaginatedResult<JobSummary>> {
  const { data } = await apiClient.get<PaginatedResult<JobSummary>>('/jobs', { params: query })
  return data
}

export async function fetchJob(id: string): Promise<JobDetail> {
  const { data } = await apiClient.get<JobDetail>(`/jobs/${id}`)
  return data
}

export async function createJob(payload: JobPayload): Promise<JobDetail> {
  const { data } = await apiClient.post<JobDetail>('/jobs', payload)
  return data
}

export async function updateJob(id: string, payload: JobPayload): Promise<JobDetail> {
  const { data } = await apiClient.patch<JobDetail>(`/jobs/${id}`, payload)
  return data
}

export async function deleteJob(id: string): Promise<void> {
  await apiClient.delete(`/jobs/${id}`)
}

export async function changeJobStatus(id: string, payload: ChangeJobStatusPayload): Promise<JobDetail> {
  const { data } = await apiClient.post<JobDetail>(`/jobs/${id}/status`, payload)
  return data
}
