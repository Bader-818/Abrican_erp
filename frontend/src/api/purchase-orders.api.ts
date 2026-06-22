import { apiClient } from './client'
import type { PaginatedResult, PurchaseOrder, PurchaseOrderStatus } from '@/types'

export interface PurchaseOrdersQuery {
  page?: number
  pageSize?: number
  search?: string
  clientId?: string
  contractId?: string
  status?: PurchaseOrderStatus
}

export interface PurchaseOrderPayload {
  clientId?: string
  contractId?: string | null
  poNumber?: string
  poValue?: number
  currency?: string
  issueDate?: string
  expiryDate?: string
  status?: PurchaseOrderStatus
}

export async function fetchPurchaseOrders(
  query: PurchaseOrdersQuery,
): Promise<PaginatedResult<PurchaseOrder>> {
  const { data } = await apiClient.get<PaginatedResult<PurchaseOrder>>('/purchase-orders', {
    params: query,
  })
  return data
}

export async function fetchPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await apiClient.get<PurchaseOrder>(`/purchase-orders/${id}`)
  return data
}

export async function createPurchaseOrder(payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
  const { data } = await apiClient.post<PurchaseOrder>('/purchase-orders', payload)
  return data
}

export async function updatePurchaseOrder(
  id: string,
  payload: PurchaseOrderPayload,
): Promise<PurchaseOrder> {
  const { data } = await apiClient.patch<PurchaseOrder>(`/purchase-orders/${id}`, payload)
  return data
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  await apiClient.delete(`/purchase-orders/${id}`)
}
