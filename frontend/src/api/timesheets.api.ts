import { apiClient } from './client'
import type { ApprovalStatus, PaginatedResult, TimesheetDetail, TimesheetSummary } from '@/types'

export interface TimesheetsQuery {
  page?: number
  pageSize?: number
  jobId?: string
  employeeId?: string
  crewId?: string
  approvalStatus?: ApprovalStatus
  from?: string
  to?: string
}

export interface TimesheetPayload {
  jobId?: string
  employeeId?: string
  crewId?: string
  workDate?: string
  regularHours?: number
  overtimeHours?: number
  standbyHours?: number
  travelHours?: number
  notes?: string
}

export async function fetchTimesheets(query: TimesheetsQuery): Promise<PaginatedResult<TimesheetSummary>> {
  const { data } = await apiClient.get<PaginatedResult<TimesheetSummary>>('/timesheets', { params: query })
  return data
}

export async function fetchTimesheet(id: string): Promise<TimesheetDetail> {
  const { data } = await apiClient.get<TimesheetDetail>(`/timesheets/${id}`)
  return data
}

export async function createTimesheet(payload: TimesheetPayload): Promise<TimesheetDetail> {
  const { data } = await apiClient.post<TimesheetDetail>('/timesheets', payload)
  return data
}

export async function updateTimesheet(id: string, payload: TimesheetPayload): Promise<TimesheetDetail> {
  const { data } = await apiClient.patch<TimesheetDetail>(`/timesheets/${id}`, payload)
  return data
}

export async function deleteTimesheet(id: string): Promise<void> {
  await apiClient.delete(`/timesheets/${id}`)
}

export async function submitTimesheet(id: string): Promise<TimesheetDetail> {
  const { data } = await apiClient.post<TimesheetDetail>(`/timesheets/${id}/submit`)
  return data
}

export async function approveTimesheet(id: string): Promise<TimesheetDetail> {
  const { data } = await apiClient.post<TimesheetDetail>(`/timesheets/${id}/approve`)
  return data
}

export async function rejectTimesheet(id: string, reason?: string): Promise<TimesheetDetail> {
  const { data } = await apiClient.post<TimesheetDetail>(`/timesheets/${id}/reject`, { reason })
  return data
}
