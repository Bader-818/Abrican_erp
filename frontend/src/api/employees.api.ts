import { apiClient } from './client'
import type { AvailabilityStatus, Employee, EmployeeStatus, PaginatedResult } from '@/types'

export interface EmployeesQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: EmployeeStatus
  availabilityStatus?: AvailabilityStatus
}

export interface EmployeePayload {
  name?: string
  role?: string
  department?: string
  costRate?: number
  availabilityStatus?: AvailabilityStatus
  phone?: string
  email?: string
  status?: EmployeeStatus
}

export async function fetchEmployees(query: EmployeesQuery): Promise<PaginatedResult<Employee>> {
  const { data } = await apiClient.get<PaginatedResult<Employee>>('/employees', { params: query })
  return data
}

export async function createEmployee(payload: EmployeePayload): Promise<Employee> {
  const { data } = await apiClient.post<Employee>('/employees', payload)
  return data
}

export async function updateEmployee(id: string, payload: EmployeePayload): Promise<Employee> {
  const { data } = await apiClient.patch<Employee>(`/employees/${id}`, payload)
  return data
}

export async function deleteEmployee(id: string): Promise<void> {
  await apiClient.delete(`/employees/${id}`)
}
