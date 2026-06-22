import { apiClient } from './client'
import type {
  BillingUnit,
  InvoiceDetail,
  InvoiceStatus,
  InvoiceSummary,
  LineKind,
  PaginatedResult,
} from '@/types'

export interface InvoicesQuery {
  page?: number
  pageSize?: number
  search?: string
  clientId?: string
  jobId?: string
  status?: InvoiceStatus
  overdue?: boolean
}

export interface InvoiceLinePayload {
  sourceEstimateLineItemId?: string
  contractRateCardId?: string
  lineKind?: LineKind
  description: string
  quantity: number
  hours?: number
  unit?: BillingUnit
  unitPrice: number
  vatRate?: number
}

export interface UpdateInvoicePayload {
  purchaseOrderId?: string
  invoiceDate?: string
  dueDate?: string
  servicePeriodFrom?: string
  servicePeriodTo?: string
  notes?: string
  items?: InvoiceLinePayload[]
}

export async function fetchInvoices(query: InvoicesQuery): Promise<PaginatedResult<InvoiceSummary>> {
  const { data } = await apiClient.get<PaginatedResult<InvoiceSummary>>('/invoices', { params: query })
  return data
}

export async function fetchInvoice(id: string): Promise<InvoiceDetail> {
  const { data } = await apiClient.get<InvoiceDetail>(`/invoices/${id}`)
  return data
}

export async function createInvoiceFromEstimate(payload: {
  estimateId: string
  purchaseOrderId?: string
  invoiceDate?: string
  dueDate?: string
}): Promise<InvoiceDetail> {
  const { data } = await apiClient.post<InvoiceDetail>('/invoices/from-estimate', payload)
  return data
}

export async function updateInvoice(id: string, payload: UpdateInvoicePayload): Promise<InvoiceDetail> {
  const { data } = await apiClient.patch<InvoiceDetail>(`/invoices/${id}`, payload)
  return data
}

export async function deleteInvoice(id: string): Promise<void> {
  await apiClient.delete(`/invoices/${id}`)
}

export async function submitInvoiceForApproval(id: string): Promise<InvoiceDetail> {
  const { data } = await apiClient.post<InvoiceDetail>(`/invoices/${id}/submit-for-approval`)
  return data
}

export async function approveInvoice(id: string): Promise<InvoiceDetail> {
  const { data } = await apiClient.post<InvoiceDetail>(`/invoices/${id}/approve`)
  return data
}

export async function issueInvoice(id: string, overrideReason?: string): Promise<InvoiceDetail> {
  const { data } = await apiClient.post<InvoiceDetail>(`/invoices/${id}/issue`, { overrideReason })
  return data
}

export async function cancelInvoice(id: string): Promise<InvoiceDetail> {
  const { data } = await apiClient.post<InvoiceDetail>(`/invoices/${id}/cancel`)
  return data
}

export async function fetchInvoicePdf(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/invoices/${id}/pdf`, { responseType: 'blob' })
  return data as Blob
}
