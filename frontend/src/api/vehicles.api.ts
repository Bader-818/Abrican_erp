import { apiClient } from './client'
import type { OwnershipType, PaginatedResult, Vehicle, VehicleClass, VehicleStatus } from '@/types'

export interface VehiclesQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: VehicleStatus
  ownershipType?: OwnershipType
}

export interface VehiclePayload {
  plateNumber?: string
  plateNumberAr?: string
  doorNumber?: string
  vehicleType?: string
  vehicleClass?: VehicleClass
  make?: string
  model?: string
  year?: number
  color?: string
  plateColor?: string
  ownershipType?: OwnershipType
  status?: VehicleStatus
  odometer?: number
  fuelType?: string
  registrationExpiry?: string
  insuranceExpiry?: string
  inspectionExpiry?: string
  operatingCardExpiry?: string
  aramcoStickerExpiry?: string
  costRate?: number
  notes?: string
}

export async function fetchVehicles(query: VehiclesQuery): Promise<PaginatedResult<Vehicle>> {
  const { data } = await apiClient.get<PaginatedResult<Vehicle>>('/vehicles', { params: query })
  return data
}

export async function createVehicle(payload: VehiclePayload): Promise<Vehicle> {
  const { data } = await apiClient.post<Vehicle>('/vehicles', payload)
  return data
}

export async function updateVehicle(id: string, payload: VehiclePayload): Promise<Vehicle> {
  const { data } = await apiClient.patch<Vehicle>(`/vehicles/${id}`, payload)
  return data
}

export async function deleteVehicle(id: string): Promise<void> {
  await apiClient.delete(`/vehicles/${id}`)
}
