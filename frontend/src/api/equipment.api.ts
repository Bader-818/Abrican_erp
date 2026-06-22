import { apiClient } from './client'
import type { Equipment, EquipmentStatus, OwnershipType, PaginatedResult } from '@/types'

export interface EquipmentQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: EquipmentStatus
  ownershipType?: OwnershipType
}

export interface EquipmentPayload {
  name?: string
  equipmentType?: string
  serialNumber?: string
  status?: EquipmentStatus
  ownershipType?: OwnershipType
  costRate?: number
  currentLocation?: string
  calibrationExpiry?: string
  maintenanceDueDate?: string
  notes?: string
}

export async function fetchEquipment(query: EquipmentQuery): Promise<PaginatedResult<Equipment>> {
  const { data } = await apiClient.get<PaginatedResult<Equipment>>('/equipment', { params: query })
  return data
}

export async function createEquipment(payload: EquipmentPayload): Promise<Equipment> {
  const { data } = await apiClient.post<Equipment>('/equipment', payload)
  return data
}

export async function updateEquipment(id: string, payload: EquipmentPayload): Promise<Equipment> {
  const { data } = await apiClient.patch<Equipment>(`/equipment/${id}`, payload)
  return data
}

export async function deleteEquipment(id: string): Promise<void> {
  await apiClient.delete(`/equipment/${id}`)
}
