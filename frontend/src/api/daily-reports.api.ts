import { apiClient } from './client'
import type { ApprovalStatus, DailyReportDetail, DailyReportSummary, PaginatedResult } from '@/types'

export interface DailyReportsQuery {
  page?: number
  pageSize?: number
  jobId?: string
  supervisorId?: string
  approvalStatus?: ApprovalStatus
  from?: string
  to?: string
}

export interface DailyReportPayload {
  jobId?: string
  reportDate?: string
  supervisorId?: string
  workPerformed?: string
  progressPct?: number
  clientRep?: string
  weather?: string
  issues?: string
  materialsUsed?: string
  equipmentUsed?: string
  vehiclesUsed?: string
}

export async function fetchDailyReports(query: DailyReportsQuery): Promise<PaginatedResult<DailyReportSummary>> {
  const { data } = await apiClient.get<PaginatedResult<DailyReportSummary>>('/daily-reports', { params: query })
  return data
}

export async function fetchDailyReport(id: string): Promise<DailyReportDetail> {
  const { data } = await apiClient.get<DailyReportDetail>(`/daily-reports/${id}`)
  return data
}

export async function createDailyReport(payload: DailyReportPayload): Promise<DailyReportDetail> {
  const { data } = await apiClient.post<DailyReportDetail>('/daily-reports', payload)
  return data
}

export async function updateDailyReport(id: string, payload: DailyReportPayload): Promise<DailyReportDetail> {
  const { data } = await apiClient.patch<DailyReportDetail>(`/daily-reports/${id}`, payload)
  return data
}

export async function deleteDailyReport(id: string): Promise<void> {
  await apiClient.delete(`/daily-reports/${id}`)
}

export async function submitDailyReport(id: string): Promise<DailyReportDetail> {
  const { data } = await apiClient.post<DailyReportDetail>(`/daily-reports/${id}/submit`)
  return data
}

export async function approveDailyReport(id: string): Promise<DailyReportDetail> {
  const { data } = await apiClient.post<DailyReportDetail>(`/daily-reports/${id}/approve`)
  return data
}

export async function rejectDailyReport(id: string, reason?: string): Promise<DailyReportDetail> {
  const { data } = await apiClient.post<DailyReportDetail>(`/daily-reports/${id}/reject`, { reason })
  return data
}
