import { apiClient } from './client'
import type {
  ApprovalStatus,
  ExpenseCategory,
  ExpenseDetail,
  ExpenseSummary,
  PaginatedResult,
  PaymentMethod,
  ReimbursementStatus,
  ReimbursementSummary,
} from '@/types'

export interface ExpensesQuery {
  page?: number
  pageSize?: number
  category?: ExpenseCategory
  approvalStatus?: ApprovalStatus
  reimbursementStatus?: ReimbursementStatus
  jobId?: string
  employeeId?: string
  from?: string
  to?: string
}

export interface ExpensePayload {
  expenseDate?: string
  category?: ExpenseCategory
  amountBeforeVat?: number
  vatAmount?: number
  vendor?: string
  description?: string
  currency?: string
  jobId?: string
  vehicleId?: string
  equipmentId?: string
  employeeId?: string
  reimbursable?: boolean
}

export interface ReimbursePayload {
  status: Extract<ReimbursementStatus, 'COMPENSATED' | 'DELAYED' | 'DECLINED'>
  note?: string
  method?: PaymentMethod
  reference?: string
  date?: string
}

export async function fetchExpenses(query: ExpensesQuery): Promise<PaginatedResult<ExpenseSummary>> {
  const { data } = await apiClient.get<PaginatedResult<ExpenseSummary>>('/expenses', { params: query })
  return data
}

export async function fetchExpense(id: string): Promise<ExpenseDetail> {
  const { data } = await apiClient.get<ExpenseDetail>(`/expenses/${id}`)
  return data
}

export async function createExpense(payload: ExpensePayload): Promise<ExpenseDetail> {
  const { data } = await apiClient.post<ExpenseDetail>('/expenses', payload)
  return data
}

export async function updateExpense(id: string, payload: ExpensePayload): Promise<ExpenseDetail> {
  const { data } = await apiClient.patch<ExpenseDetail>(`/expenses/${id}`, payload)
  return data
}

export async function deleteExpense(id: string): Promise<void> {
  await apiClient.delete(`/expenses/${id}`)
}

export async function submitExpense(id: string): Promise<ExpenseDetail> {
  const { data } = await apiClient.post<ExpenseDetail>(`/expenses/${id}/submit`)
  return data
}

export async function approveExpense(id: string): Promise<ExpenseDetail> {
  const { data } = await apiClient.post<ExpenseDetail>(`/expenses/${id}/approve`)
  return data
}

export async function rejectExpense(id: string, reason?: string): Promise<ExpenseDetail> {
  const { data } = await apiClient.post<ExpenseDetail>(`/expenses/${id}/reject`, { reason })
  return data
}

export async function postExpense(id: string): Promise<ExpenseDetail> {
  const { data } = await apiClient.post<ExpenseDetail>(`/expenses/${id}/post`)
  return data
}

export async function reimburseExpense(id: string, payload: ReimbursePayload): Promise<ExpenseDetail> {
  const { data } = await apiClient.post<ExpenseDetail>(`/expenses/${id}/reimburse`, payload)
  return data
}

export async function uploadExpenseReceipt(id: string, file: File): Promise<ExpenseDetail> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<ExpenseDetail>(`/expenses/${id}/receipt`, form)
  return data
}

export async function fetchExpenseReceipt(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/expenses/${id}/receipt`, { responseType: 'blob' })
  return data as Blob
}

export async function fetchReimbursementSummary(): Promise<ReimbursementSummary> {
  const { data } = await apiClient.get<ReimbursementSummary>('/expenses/reimbursements/summary')
  return data
}
