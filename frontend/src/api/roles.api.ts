import { apiClient } from './client'
import type { Permission, Role } from '@/types'

export interface CreateRolePayload {
  name: string
  description?: string
  permissionKeys: string[]
}

export interface UpdateRolePayload {
  name?: string
  description?: string
  permissionKeys?: string[]
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>('/roles')
  return data
}

export async function fetchPermissions(): Promise<Permission[]> {
  const { data } = await apiClient.get<Permission[]>('/roles/permissions')
  return data
}

export async function fetchRole(id: string): Promise<Role> {
  const { data } = await apiClient.get<Role>(`/roles/${id}`)
  return data
}

export async function createRole(payload: CreateRolePayload): Promise<Role> {
  const { data } = await apiClient.post<Role>('/roles', payload)
  return data
}

export async function updateRole(id: string, payload: UpdateRolePayload): Promise<Role> {
  const { data } = await apiClient.patch<Role>(`/roles/${id}`, payload)
  return data
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/roles/${id}`)
}
