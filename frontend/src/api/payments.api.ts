import { apiClient } from './client'
import type { AgingReport, PaginatedResult, Payment, PaymentMethod } from '@/types'

export interface PaymentsQuery {
  page?: number
  pageSize?: number
  invoiceId?: string
  clientId?: string
}

export interface PaymentPayload {
  invoiceId: string
  amount: number
  paymentDate?: string
  method?: PaymentMethod
  referenceNumber?: string
  notes?: string
}

export async function fetchPayments(query: PaymentsQuery): Promise<PaginatedResult<Payment>> {
  const { data } = await apiClient.get<PaginatedResult<Payment>>('/payments', { params: query })
  return data
}

export async function createPayment(payload: PaymentPayload): Promise<Payment> {
  const { data } = await apiClient.post<Payment>('/payments', payload)
  return data
}

export async function fetchAging(): Promise<AgingReport> {
  const { data } = await apiClient.get<AgingReport>('/payments/aging')
  return data
}
