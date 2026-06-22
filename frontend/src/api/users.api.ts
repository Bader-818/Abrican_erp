import { apiClient } from './client'
import type { PaginatedResult, UserSummary, UserStatus } from '@/types'

export interface UsersQuery {
  page?: number
  pageSize?: number
  search?: string
  roleId?: string
  status?: UserStatus
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  roleId: string
  status?: UserStatus
}

export interface UpdateUserPayload {
  name?: string
  email?: string
  password?: string
  roleId?: string
  status?: UserStatus
}

export async function fetchUsers(query: UsersQuery): Promise<PaginatedResult<UserSummary>> {
  const { data } = await apiClient.get<PaginatedResult<UserSummary>>('/users', { params: query })
  return data
}

export async function fetchUser(id: string): Promise<UserSummary> {
  const { data } = await apiClient.get<UserSummary>(`/users/${id}`)
  return data
}

export async function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  const { data } = await apiClient.post<UserSummary>('/users', payload)
  return data
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserSummary> {
  const { data } = await apiClient.patch<UserSummary>(`/users/${id}`, payload)
  return data
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`)
}

export async function adminResetPassword(id: string, newPassword: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>(`/users/${id}/reset-password`, { newPassword })
  return data
}

export async function adminDisableMfa(id: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>(`/users/${id}/disable-mfa`)
  return data
}

export async function adminForceLogout(id: string): Promise<{ success: boolean; revoked: number }> {
  const { data } = await apiClient.post<{ success: boolean; revoked: number }>(`/users/${id}/logout-all`)
  return data
}
