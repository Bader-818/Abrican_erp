import { apiClient } from './client'
import type { DocumentRecord, PaginatedResult, RelatedEntityType } from '@/types'

export interface DocumentsQuery {
  page?: number
  pageSize?: number
  search?: string
  relatedEntityType?: RelatedEntityType
  employeeId?: string
  vehicleId?: string
  equipmentId?: string
  contractId?: string
  clientId?: string
  expiringWithinDays?: number
  expired?: boolean
}

export interface DocumentUploadPayload {
  relatedEntityType: RelatedEntityType
  employeeId?: string
  vehicleId?: string
  equipmentId?: string
  contractId?: string
  clientId?: string
  documentType: string
  issueDate?: string
  expiryDate?: string
  notes?: string
  file: File
}

export interface DocumentUpdatePayload {
  documentType?: string
  issueDate?: string
  expiryDate?: string
  notes?: string
}

export async function fetchDocuments(
  query: DocumentsQuery,
): Promise<PaginatedResult<DocumentRecord>> {
  const { data } = await apiClient.get<PaginatedResult<DocumentRecord>>('/documents', {
    params: query,
  })
  return data
}

export async function uploadDocument(payload: DocumentUploadPayload): Promise<DocumentRecord> {
  const form = new FormData()
  form.append('relatedEntityType', payload.relatedEntityType)
  if (payload.employeeId) form.append('employeeId', payload.employeeId)
  if (payload.vehicleId) form.append('vehicleId', payload.vehicleId)
  if (payload.equipmentId) form.append('equipmentId', payload.equipmentId)
  if (payload.contractId) form.append('contractId', payload.contractId)
  if (payload.clientId) form.append('clientId', payload.clientId)
  form.append('documentType', payload.documentType)
  if (payload.issueDate) form.append('issueDate', payload.issueDate)
  if (payload.expiryDate) form.append('expiryDate', payload.expiryDate)
  if (payload.notes) form.append('notes', payload.notes)
  form.append('file', payload.file)

  const { data } = await apiClient.post<DocumentRecord>('/documents', form)
  return data
}

export async function updateDocument(
  id: string,
  payload: DocumentUpdatePayload,
): Promise<DocumentRecord> {
  const { data } = await apiClient.patch<DocumentRecord>(`/documents/${id}`, payload)
  return data
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`)
}

/** Downloads the file through the auth-gated endpoint and triggers a browser save. */
export async function downloadDocument(doc: { id: string; documentType: string }): Promise<void> {
  const { data } = await apiClient.get<Blob>(`/documents/${doc.id}/download`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = doc.documentType
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
