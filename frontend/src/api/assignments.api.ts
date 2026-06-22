import { apiClient } from './client'
import type {
  Assignment,
  AssignmentStatus,
  ConflictInfo,
  PaginatedResult,
  ResourceType,
  UtilizationReport,
} from '@/types'

export interface AssignmentsQuery {
  page?: number
  pageSize?: number
  jobId?: string
  resourceType?: ResourceType
  status?: AssignmentStatus
  employeeId?: string
  crewId?: string
  vehicleId?: string
  equipmentId?: string
  from?: string
  to?: string
}

export interface AssignmentPayload {
  jobId?: string
  resourceType?: ResourceType
  employeeId?: string
  crewId?: string
  vehicleId?: string
  equipmentId?: string
  startDatetime?: string
  endDatetime?: string
  plannedHours?: number
  overrideReason?: string
}

export interface UpdateAssignmentPayload {
  startDatetime?: string
  endDatetime?: string
  plannedHours?: number
  actualHours?: number
  status?: AssignmentStatus
  overrideReason?: string
}

export interface BulkAssignmentItem {
  resourceType: ResourceType
  employeeId?: string
  crewId?: string
  vehicleId?: string
  equipmentId?: string
}

export interface BulkAssignmentPayload {
  jobId: string
  startDatetime: string
  endDatetime: string
  plannedHours?: number
  overrideReason?: string
  items: BulkAssignmentItem[]
}

/** Per-resource conflicts returned in the 409 body when a bulk assign is blocked. */
export interface BulkConflict {
  resourceType: ResourceType
  resourceId: string
  conflicts: ConflictInfo[]
  availabilityIssue: string | null
}

export interface CheckConflictsPayload {
  resourceType: ResourceType
  employeeId?: string
  crewId?: string
  vehicleId?: string
  equipmentId?: string
  startDatetime: string
  endDatetime: string
  excludeAssignmentId?: string
}

export async function fetchAssignments(
  query: AssignmentsQuery,
): Promise<PaginatedResult<Assignment>> {
  const { data } = await apiClient.get<PaginatedResult<Assignment>>('/assignments', { params: query })
  return data
}

export async function fetchAssignment(id: string): Promise<Assignment> {
  const { data } = await apiClient.get<Assignment>(`/assignments/${id}`)
  return data
}

export async function createAssignment(payload: AssignmentPayload): Promise<Assignment> {
  const { data } = await apiClient.post<Assignment>('/assignments', payload)
  return data
}

export async function createAssignmentsBulk(payload: BulkAssignmentPayload): Promise<Assignment[]> {
  const { data } = await apiClient.post<Assignment[]>('/assignments/bulk', payload)
  return data
}

export async function updateAssignment(
  id: string,
  payload: UpdateAssignmentPayload,
): Promise<Assignment> {
  const { data } = await apiClient.patch<Assignment>(`/assignments/${id}`, payload)
  return data
}

export async function deleteAssignment(id: string): Promise<void> {
  await apiClient.delete(`/assignments/${id}`)
}

export async function checkConflicts(
  payload: CheckConflictsPayload,
): Promise<{ conflicts: ConflictInfo[] }> {
  const { data } = await apiClient.post<{ conflicts: ConflictInfo[] }>(
    '/assignments/check-conflicts',
    payload,
  )
  return data
}

export async function fetchUtilization(query: {
  from: string
  to: string
  resourceType?: ResourceType
}): Promise<UtilizationReport> {
  const { data } = await apiClient.get<UtilizationReport>('/assignments/utilization', {
    params: query,
  })
  return data
}
