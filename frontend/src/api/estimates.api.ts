import { apiClient } from './client'
import type {
  BillingUnit,
  EstimateDetail,
  EstimateStatus,
  EstimateSummary,
  LineKind,
  PaginatedResult,
} from '@/types'

export interface EstimatesQuery {
  page?: number
  pageSize?: number
  search?: string
  clientId?: string
  contractId?: string
  status?: EstimateStatus
}

export interface EstimateLinePayload {
  contractRateCardId?: string
  lineKind?: LineKind
  description: string
  quantity: number
  hours?: number
  unit?: BillingUnit
  unitPrice: number
  vatRate?: number
}

export interface EstimatePayload {
  clientId: string
  contractId?: string
  title: string
  jobType: string
  location: string
  plannedStartDate: string
  plannedEndDate: string
  validUntil?: string
  notes?: string
  items: EstimateLinePayload[]
}

export async function fetchEstimates(query: EstimatesQuery): Promise<PaginatedResult<EstimateSummary>> {
  const { data } = await apiClient.get<PaginatedResult<EstimateSummary>>('/estimates', { params: query })
  return data
}

export async function fetchEstimate(id: string): Promise<EstimateDetail> {
  const { data } = await apiClient.get<EstimateDetail>(`/estimates/${id}`)
  return data
}

export async function createEstimate(payload: EstimatePayload): Promise<EstimateDetail> {
  const { data } = await apiClient.post<EstimateDetail>('/estimates', payload)
  return data
}

export async function updateEstimate(id: string, payload: Partial<EstimatePayload>): Promise<EstimateDetail> {
  const { data } = await apiClient.patch<EstimateDetail>(`/estimates/${id}`, payload)
  return data
}

export async function deleteEstimate(id: string): Promise<void> {
  await apiClient.delete(`/estimates/${id}`)
}

export async function sendEstimate(id: string): Promise<EstimateDetail> {
  const { data } = await apiClient.post<EstimateDetail>(`/estimates/${id}/send`)
  return data
}

export async function approveEstimate(id: string): Promise<EstimateDetail> {
  const { data } = await apiClient.post<EstimateDetail>(`/estimates/${id}/approve`)
  return data
}

export async function rejectEstimate(id: string, reason?: string): Promise<EstimateDetail> {
  const { data } = await apiClient.post<EstimateDetail>(`/estimates/${id}/reject`, { reason })
  return data
}

export async function convertEstimate(
  id: string,
  payload: { region?: string; purchaseOrderId?: string; description?: string } = {},
): Promise<EstimateDetail> {
  const { data } = await apiClient.post<EstimateDetail>(`/estimates/${id}/convert`, payload)
  return data
}

export async function fetchEstimatePdf(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/estimates/${id}/pdf`, { responseType: 'blob' })
  return data as Blob
}
