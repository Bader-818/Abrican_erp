import { apiClient } from './client'
import type {
  ContractDetail,
  ContractStatus,
  ContractSummary,
  PaginatedResult,
  RateCard,
} from '@/types'

export interface ContractsQuery {
  page?: number
  pageSize?: number
  search?: string
  clientId?: string
  status?: ContractStatus
}

export interface ContractPayload {
  clientId?: string
  contractNumber?: string
  title?: string
  scope?: string
  startDate?: string
  endDate?: string
  contractValue?: number
  paymentTermsDays?: number
  status?: ContractStatus
}

export interface RateCardPayload {
  serviceLine?: string
  itemCode?: string
  description?: string
  unit?: string
  unitPrice?: number
  currency?: string
  vatApplicable?: boolean
  effectiveDate?: string
}

export async function fetchContracts(query: ContractsQuery): Promise<PaginatedResult<ContractSummary>> {
  const { data } = await apiClient.get<PaginatedResult<ContractSummary>>('/contracts', { params: query })
  return data
}

export async function fetchContract(id: string): Promise<ContractDetail> {
  const { data } = await apiClient.get<ContractDetail>(`/contracts/${id}`)
  return data
}

export async function createContract(payload: ContractPayload): Promise<ContractDetail> {
  const { data } = await apiClient.post<ContractDetail>('/contracts', payload)
  return data
}

export async function updateContract(id: string, payload: ContractPayload): Promise<ContractDetail> {
  const { data } = await apiClient.patch<ContractDetail>(`/contracts/${id}`, payload)
  return data
}

export async function deleteContract(id: string): Promise<void> {
  await apiClient.delete(`/contracts/${id}`)
}

export async function createRateCard(contractId: string, payload: RateCardPayload): Promise<RateCard> {
  const { data } = await apiClient.post<RateCard>(`/contracts/${contractId}/rate-cards`, payload)
  return data
}

export async function updateRateCard(
  contractId: string,
  rateCardId: string,
  payload: RateCardPayload,
): Promise<RateCard> {
  const { data } = await apiClient.patch<RateCard>(
    `/contracts/${contractId}/rate-cards/${rateCardId}`,
    payload,
  )
  return data
}

export async function deleteRateCard(contractId: string, rateCardId: string): Promise<void> {
  await apiClient.delete(`/contracts/${contractId}/rate-cards/${rateCardId}`)
}
