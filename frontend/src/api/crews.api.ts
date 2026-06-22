import { apiClient } from './client'
import type { CrewDetail, CrewMember, CrewMemberStatus, CrewStatus, CrewSummary, PaginatedResult } from '@/types'

export interface CrewsQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: CrewStatus
}

export interface CrewPayload {
  name?: string
  supervisorId?: string
  serviceCapability?: string
  status?: CrewStatus
}

export interface CrewMemberPayload {
  employeeId?: string
  startDate?: string
  endDate?: string
  status?: CrewMemberStatus
}

export async function fetchCrews(query: CrewsQuery): Promise<PaginatedResult<CrewSummary>> {
  const { data } = await apiClient.get<PaginatedResult<CrewSummary>>('/crews', { params: query })
  return data
}

export async function fetchCrew(id: string): Promise<CrewDetail> {
  const { data } = await apiClient.get<CrewDetail>(`/crews/${id}`)
  return data
}

export async function createCrew(payload: CrewPayload): Promise<CrewDetail> {
  const { data } = await apiClient.post<CrewDetail>('/crews', payload)
  return data
}

export async function updateCrew(id: string, payload: CrewPayload): Promise<CrewDetail> {
  const { data } = await apiClient.patch<CrewDetail>(`/crews/${id}`, payload)
  return data
}

export async function deleteCrew(id: string): Promise<void> {
  await apiClient.delete(`/crews/${id}`)
}

export async function addCrewMember(crewId: string, payload: CrewMemberPayload): Promise<CrewMember> {
  const { data } = await apiClient.post<CrewMember>(`/crews/${crewId}/members`, payload)
  return data
}

export async function updateCrewMember(
  crewId: string,
  memberId: string,
  payload: CrewMemberPayload,
): Promise<CrewMember> {
  const { data } = await apiClient.patch<CrewMember>(`/crews/${crewId}/members/${memberId}`, payload)
  return data
}

export async function deleteCrewMember(crewId: string, memberId: string): Promise<void> {
  await apiClient.delete(`/crews/${crewId}/members/${memberId}`)
}
